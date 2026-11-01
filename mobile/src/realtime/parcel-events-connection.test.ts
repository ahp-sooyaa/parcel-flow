import {
  BATCH_WINDOW_MS,
  CAPACITY_RETRY_MS,
  createParcelEventsConnection,
  SILENCE_TIMEOUT_MS,
} from "@/realtime/parcel-events-connection";

jest.mock("@/auth/client", () => ({
  authClient: { getCookie: jest.fn(() => "better-auth.session_token=abc") },
}));

const encoder = new TextEncoder();

/**
 * A response whose stream body the test writes to and closes by hand. It's a
 * plain object rather than a `Response`: wrapping the stream would pipe it
 * through Node's fetch internals, which don't run under fake timers.
 */
function streamResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(streamController) {
      controller = streamController;
    },
  });

  return {
    response: fakeResponse(200, body),
    write: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  };
}

function fakeResponse(status: number, body: Response["body"] = null) {
  // Only what the connection reads from a fetch response.
  const response: Pick<Response, "status" | "ok" | "body"> = {
    status,
    ok: status >= 200 && status < 300,
    body,
  };
  return response as Response;
}

const ready = "event: ready\ndata: {}\n\n";
const changed = (parcelId: string) =>
  `event: parcel-changed\ndata: ${JSON.stringify({ parcelId })}\n\n`;

let fetchMock: jest.SpyInstance;
const handlers = {
  onChanged: jest.fn(),
  onReconnected: jest.fn(),
  onUnauthorized: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  // No jitter, so the backoff delays are exact.
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  fetchMock = jest.spyOn(globalThis, "fetch");
  for (const handler of Object.values(handlers)) {
    handler.mockReset();
  }
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Lets the connection's pending promises (fetch, reads) settle. */
async function settle(ms = 0) {
  await jest.advanceTimersByTimeAsync(ms);
}

async function startWith(...responses: (Response | Error)[]) {
  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockRejectedValueOnce(response);
    } else {
      fetchMock.mockResolvedValueOnce(response);
    }
  }

  const connection = createParcelEventsConnection(handlers);
  connection.start();
  await settle();
  return connection;
}

describe("createParcelEventsConnection", () => {
  it("opens the stream with the session cookie", async () => {
    const stream = streamResponse();
    const connection = await startWith(stream.response);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://parcel-flow.test/api/mobile/v1/rider/parcels/events",
      expect.objectContaining({
        credentials: "omit",
        headers: { Accept: "text/event-stream", Cookie: "better-auth.session_token=abc" },
      }),
    );
    connection.stop();
  });

  it("batches parcel changes into one callback per window", async () => {
    const stream = streamResponse();
    const connection = await startWith(stream.response);

    stream.write(ready + changed("p1") + changed("p2"));
    stream.write(changed("p1"));
    await settle();
    expect(handlers.onChanged).not.toHaveBeenCalled();

    await settle(BATCH_WINDOW_MS);

    expect(handlers.onChanged).toHaveBeenCalledTimes(1);
    expect(handlers.onChanged).toHaveBeenCalledWith(["p1", "p2"]);
    // The first ready isn't a reconnect.
    expect(handlers.onReconnected).not.toHaveBeenCalled();
    connection.stop();
  });

  it("reconnects with backoff after the stream ends, and refetches once back", async () => {
    const first = streamResponse();
    const second = streamResponse();
    const connection = await startWith(first.response, new Error("offline"), second.response);

    first.write(ready);
    first.end();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await settle(1_000);
    // The second attempt failed; the next one waits twice as long.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await settle(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await settle(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    second.write(ready);
    await settle();
    expect(handlers.onReconnected).toHaveBeenCalledTimes(1);
    connection.stop();
  });

  it("restarts a stream that goes silent", async () => {
    const silent = streamResponse();
    const next = streamResponse();
    const connection = await startWith(silent.response, next.response);

    silent.write(ready);
    await settle(SILENCE_TIMEOUT_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await settle(1);
    await settle(1_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  it("stays connected while keepalives arrive", async () => {
    const stream = streamResponse();
    const connection = await startWith(stream.response);

    for (let index = 0; index < 5; index += 1) {
      await settle(20_000);
      stream.write(": keepalive\n\n");
    }
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    connection.stop();
  });

  it("stops without reconnecting, and drops pending changes", async () => {
    const stream = streamResponse();
    const connection = await startWith(stream.response);

    stream.write(ready + changed("p1"));
    await settle();
    connection.stop();
    await settle(CAPACITY_RETRY_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handlers.onChanged).not.toHaveBeenCalled();
  });

  it("can start again after a stop", async () => {
    const connection = await startWith(streamResponse().response, streamResponse().response);

    connection.stop();
    connection.start();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  it("signs out on 401 and gives up on 403", async () => {
    await startWith(fakeResponse(401));
    expect(handlers.onUnauthorized).toHaveBeenCalledTimes(1);

    await startWith(fakeResponse(403));
    await settle(CAPACITY_RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits a minute before retrying when the server is at capacity", async () => {
    const connection = await startWith(fakeResponse(204), streamResponse().response);

    await settle(CAPACITY_RETRY_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    connection.stop();
  });
});

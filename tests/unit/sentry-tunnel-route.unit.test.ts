import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

const dsn = "https://publickey@o123.ingest.us.sentry.io/456";
const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function envelope(header: unknown, rest = '{"type":"event"}\n{"message":"boom"}') {
  return `${JSON.stringify(header)}\n${rest}`;
}

function post(body: string) {
  return new Request("http://localhost:3000/api/monitoring", { method: "POST", body });
}

describe("POST /api/monitoring", async () => {
  const { POST } = await import("@/app/api/monitoring/route");
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
  });

  test("forwards our project's envelope to Sentry unchanged", async () => {
    const body = envelope({ dsn, sent_at: "2026-11-01T00:00:00.000Z" });

    const response = await POST(post(body));

    expect(response.status).toBe(200);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://o123.ingest.us.sentry.io/api/456/envelope/");
    expect(init?.method).toBe("POST");
    expect(await new Response(init?.body).text()).toBe(body);
  });

  test("passes Sentry's status back, such as a rate limit", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 429 }));

    expect((await POST(post(envelope({ dsn })))).status).toBe(429);
  });

  test.each([
    ["another host", { dsn: "https://key@evil.example.com/456" }],
    ["another project", { dsn: "https://publickey@o123.ingest.us.sentry.io/999" }],
    ["no DSN", { sent_at: "2026-11-01T00:00:00.000Z" }],
  ])("refuses an envelope for %s", async (_label, header) => {
    expect((await POST(post(envelope(header)))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("refuses a body that isn't an envelope", async () => {
    expect((await POST(post("not json"))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("answers 404 when Sentry isn't configured", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    expect((await POST(post(envelope({ dsn })))).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("answers 502 when Sentry can't be reached", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));

    expect((await POST(post(envelope({ dsn })))).status).toBe(502);
  });
});

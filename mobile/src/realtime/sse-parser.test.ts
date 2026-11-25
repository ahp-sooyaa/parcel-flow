import { createSseParser, type SseEvent } from "@/realtime/sse-parser";

function parse(...chunks: string[]) {
  const events: SseEvent[] = [];
  const parser = createSseParser((event) => events.push(event));

  for (const chunk of chunks) {
    parser.push(chunk);
  }

  return events;
}

describe("createSseParser", () => {
  it("reads named events", () => {
    expect(
      parse('event: ready\ndata: {}\n\nevent: parcel-changed\ndata: {"parcelId":"p1"}\n\n'),
    ).toEqual([
      { event: "ready", data: "{}" },
      { event: "parcel-changed", data: '{"parcelId":"p1"}' },
    ]);
  });

  it("joins events split across chunks, even mid-line", () => {
    expect(parse("event: parcel-", 'changed\ndata: {"parcel', 'Id":"p1"}\n', "\n")).toEqual([
      { event: "parcel-changed", data: '{"parcelId":"p1"}' },
    ]);
  });

  it("accepts CRLF line endings", () => {
    expect(parse("event: ready\r\ndata: {}\r\n\r\n")).toEqual([{ event: "ready", data: "{}" }]);
  });

  it("ignores keepalive comments", () => {
    expect(parse(": keepalive\n\n: keepalive\n\nevent: ready\ndata: {}\n\n")).toEqual([
      { event: "ready", data: "{}" },
    ]);
  });

  it("joins multi-line data and defaults the event name to message", () => {
    expect(parse("data: first\ndata: second\n\n")).toEqual([
      { event: "message", data: "first\nsecond" },
    ]);
  });

  it("waits for the blank line before dispatching", () => {
    expect(parse("event: ready\ndata: {}\n")).toEqual([]);
  });
});

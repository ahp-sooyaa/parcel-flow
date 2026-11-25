export type SseEvent = { event: string; data: string };

/**
 * A minimal Server-Sent Events parser for streams read with `fetch` (React
 * Native has no `EventSource`). Feed it decoded text in any chunking; it calls
 * `onEvent` for each complete event. Comments (`:` lines) are ignored, and an
 * event without an `event:` field is a `message`.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];

  function dispatch() {
    if (dataLines.length > 0 || eventName) {
      onEvent({ event: eventName || "message", data: dataLines.join("\n") });
    }

    eventName = "";
    dataLines = [];
  }

  function readLine(line: string) {
    if (line === "") {
      dispatch();
      return;
    }

    if (line.startsWith(":")) {
      return;
    }

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // A single space after the colon is part of the syntax, not the value.
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");

    if (field === "event") {
      eventName = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r\n|\n|\r/);
      // The last piece may be a partial line; keep it for the next chunk.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        readLine(line);
      }
    },
  };
}

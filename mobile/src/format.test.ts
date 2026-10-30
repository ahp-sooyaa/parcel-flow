import { formatMmk } from "@/format";

describe("formatMmk", () => {
  it.each([
    [0, "0 MMK"],
    [2500, "2,500 MMK"],
    [1250000, "1,250,000 MMK"],
  ])("formats %d as %s", (amount, expected) => {
    expect(formatMmk(amount)).toBe(expected);
  });
});

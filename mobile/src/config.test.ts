import { readApiUrl } from "@/config";

describe("readApiUrl", () => {
  it("accepts https and drops trailing slashes", () => {
    expect(readApiUrl(" https://parcel.example.com/ ", { allowHttp: false })).toBe(
      "https://parcel.example.com",
    );
  });

  it("accepts a LAN http address in development", () => {
    expect(readApiUrl("http://192.168.1.20:3000", { allowHttp: true })).toBe(
      "http://192.168.1.20:3000",
    );
  });

  it("rejects http in a release build", () => {
    expect(readApiUrl("http://192.168.1.20:3000", { allowHttp: false })).toBeNull();
  });

  it.each([undefined, "", "   ", "not a url", "ftp://parcel.example.com"])(
    "rejects %p",
    (value) => {
      expect(readApiUrl(value, { allowHttp: true })).toBeNull();
    },
  );
});

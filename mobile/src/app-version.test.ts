import { formatAppVersion } from "@/app-version";

describe("formatAppVersion", () => {
  it("shows the version and build number of an installed build", () => {
    expect(formatAppVersion({ isDev: false, version: "1.0.0", build: "7" })).toBe(
      "Version 1.0.0 (build 7)",
    );
  });

  it("shows the version alone when there is no build number", () => {
    expect(formatAppVersion({ isDev: false, version: "1.0.0", build: null })).toBe("Version 1.0.0");
  });

  it("does not show Expo Go's own version in development", () => {
    expect(formatAppVersion({ isDev: true, version: "58.0.0", build: "300" })).toBe(
      "Development build",
    );
  });

  it("says so when the version is unavailable", () => {
    expect(formatAppVersion({ isDev: false, version: null, build: null })).toBe("Version unknown");
  });
});

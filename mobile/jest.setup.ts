// Tests never talk to a real server; individual tests mock `fetch` and the auth client.
jest.mock("@/config", () => ({
  apiUrl: "http://parcel-flow.test",
  readApiUrl: jest.requireActual("@/config").readApiUrl,
}));

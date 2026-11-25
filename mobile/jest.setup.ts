// Tests never talk to a real server; individual tests mock `fetch` and the auth client.
jest.mock("@/config", () => ({
  apiUrl: "http://parcel-flow.test",
  readApiUrl: jest.requireActual("@/config").readApiUrl,
}));

// jest-expo's native stub returns no subscription; the query client's online
// listener needs one it can remove.
jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// A signed-out auth client by default. Tests that need sign-in or session
// behavior mock "@/auth/client" themselves, which overrides this.
jest.mock("@/auth/client", () => ({
  authClient: {
    getCookie: jest.fn(() => ""),
    signIn: { username: jest.fn() },
    signOut: jest.fn(async () => ({ data: { success: true }, error: null })),
    useSession: jest.fn(() => ({ data: null, isPending: false })),
  },
}));

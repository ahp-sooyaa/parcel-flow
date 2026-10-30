import { render, screen } from "@testing-library/react-native";

import RiderLayout from "@/app/(rider)/_layout";
import { authClient } from "@/auth/client";

jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");

  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Stack: () => <Text>rider screens</Text>,
  };
});

jest.mock("@/auth/client", () => ({
  authClient: { useSession: jest.fn() },
}));

const useSession = jest.mocked(authClient.useSession);

async function renderWithSession(state: { data: unknown; isPending: boolean }) {
  useSession.mockReturnValue(state as never);
  return await render(<RiderLayout />);
}

describe("RiderLayout auth gate", () => {
  it("shows a loading state while the stored session loads", async () => {
    await renderWithSession({ data: null, isPending: true });

    expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
    expect(screen.queryByText("redirect:/sign-in")).toBeNull();
  });

  it("sends a signed-out user to sign in", async () => {
    await renderWithSession({ data: null, isPending: false });

    expect(screen.getByText("redirect:/sign-in")).toBeOnTheScreen();
    expect(screen.queryByText("rider screens")).toBeNull();
  });

  it("shows rider screens with a session", async () => {
    await renderWithSession({ data: { user: { id: "rider-1" } }, isPending: false });

    expect(screen.getByText("rider screens")).toBeOnTheScreen();
  });
});

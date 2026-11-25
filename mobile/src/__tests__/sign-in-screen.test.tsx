import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SignInScreen from "@/app/sign-in";
import { authClient } from "@/auth/client";
import { signInRider } from "@/auth/sign-in";

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

jest.mock("@/auth/client", () => ({
  authClient: { useSession: jest.fn() },
}));

jest.mock("@/auth/sign-in", () => ({
  signInRider: jest.fn(),
}));

const useSession = jest.mocked(authClient.useSession);

function sessionState(state: { data: unknown; isPending: boolean }) {
  useSession.mockReturnValue(state as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionState({ data: null, isPending: false });
});

async function submit(username: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText("Username"), username);
  await fireEvent.changeText(screen.getByLabelText("Password"), password);
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInScreen", () => {
  it("shows the error, keeps the username and clears the password", async () => {
    jest
      .mocked(signInRider)
      .mockResolvedValue({ ok: false, message: "Incorrect username or password." });
    await render(<SignInScreen />);

    await submit("ko-aung", "wrong");

    expect(await screen.findByText("Incorrect username or password.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Username")).toHaveDisplayValue("ko-aung");
    expect(screen.getByLabelText("Password")).toHaveDisplayValue("");
  });

  it.each([
    "Your account is inactive. Contact an admin.",
    "The mobile app is only available to riders.",
  ])("shows %s", async (message) => {
    jest.mocked(signInRider).mockResolvedValue({ ok: false, message });
    await render(<SignInScreen />);

    await submit("ko-aung", "secret");

    expect(await screen.findByText(message)).toBeOnTheScreen();
  });

  it("asks for both fields before calling the server", async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter your username and password.")).toBeOnTheScreen();
    expect(signInRider).not.toHaveBeenCalled();
  });

  it("goes home when a session already exists", async () => {
    sessionState({ data: { user: { id: "rider-1" } }, isPending: false });
    await render(<SignInScreen />);

    expect(screen.getByText("redirect:/")).toBeOnTheScreen();
  });

  it("waits for /me before redirecting a new session", async () => {
    let finishSignIn: ((value: { ok: true }) => void) | undefined;
    jest.mocked(signInRider).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSignIn = resolve;
        }),
    );
    const view = await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText("Username"), "ko-aung");
    await fireEvent.changeText(screen.getByLabelText("Password"), "secret");
    // `press` settles only once the handler does, and sign-in is still in flight.
    const pressing = fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    // Better Auth stores the session before /me has confirmed the rider role.
    sessionState({ data: { user: { id: "rider-1" } }, isPending: false });
    await view.rerender(<SignInScreen />);
    expect(screen.queryByText("redirect:/")).toBeNull();

    finishSignIn?.({ ok: true });
    await pressing;
    await waitFor(() => expect(screen.getByText("redirect:/")).toBeOnTheScreen());
  });
});

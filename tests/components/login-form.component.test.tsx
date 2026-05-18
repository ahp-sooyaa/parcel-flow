import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const loginActionMock = mock(async (_state: unknown, _formData: FormData) => ({
  username: "daw-hnin",
  message: "Username or password is incorrect.",
}));

void mock.module("@/features/auth/server/login", () => ({
  loginAction: loginActionMock,
}));

describe("LoginForm", async () => {
  const { LoginForm } = await import("@/features/auth/components/login-form");

  test("renders the username and password fields with the expected form semantics", async () => {
    render(<LoginForm />);
    const user = userEvent.setup();

    const usernameInput = getInput("Username");
    const passwordInput = getInput("Password");

    expect(usernameInput.getAttribute("name")).toBe("username");
    expect(usernameInput.getAttribute("autocomplete")).toBe("username");
    expect(passwordInput.getAttribute("name")).toBe("password");
    expect(passwordInput.getAttribute("type")).toBe("password");
    expect(passwordInput.getAttribute("autocomplete")).toBe("current-password");
    await user.type(usernameInput, "daw-hnin");
    await user.type(passwordInput, "secret-pass");
    expect(usernameInput.value).toBe("daw-hnin");
    expect(passwordInput.value).toBe("secret-pass");
    expect(getButton("Sign in").disabled).toBe(false);
  });
});

function getButton(name: string) {
  const element = screen.getByRole("button", { name });

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`${name} is not a button.`);
  }

  return element;
}

function getInput(label: string) {
  const element = screen.getByLabelText(label);

  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`${label} is not an input.`);
  }

  return element;
}

import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signOutActionMock = mock(async () => {});

void mock.module("@/features/auth/server/actions", () => ({
  signOutAction: signOutActionMock,
}));

describe("DashboardAccountMenu", async () => {
  const { DashboardAccountMenu } = await import("@/components/shared/dashboard-account-menu");

  test("shows account details and signs the user out from the menu", async () => {
    const menuProps = {
      name: "Daw Hnin",
      role: "office_admin" as const,
      userId: "user-1",
      username: "daw-hnin",
    };

    render(<DashboardAccountMenu {...menuProps} />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Open account menu" });

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Enter" });

    await screen.findByText("Daw Hnin");
    await screen.findByText("Office Admin");

    await user.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(signOutActionMock).toHaveBeenCalledTimes(1);
  });
});

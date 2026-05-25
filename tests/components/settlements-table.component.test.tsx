import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

describe("SettlementsTable", async () => {
  const { SettlementsTable } = await import("@/features/settlements/components/settlements-table");

  test("renders an empty state when no settlements exist", () => {
    render(<SettlementsTable settlements={[]} actorRole="super_admin" />);

    expect(screen.getByText("No settlements.")).toBeTruthy();
  });
});

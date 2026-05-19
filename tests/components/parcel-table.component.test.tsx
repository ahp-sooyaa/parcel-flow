import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelListItem } from "../fixtures/builders";

describe("ParcelTable", async () => {
  const { ParcelTable } = await import("@/features/parcels/components/parcel-table");

  test("renders empty state", () => {
    render(<ParcelTable parcels={[]} />);

    expect(screen.getByText("No parcels match the current search and filters.")).toBeTruthy();
  });

  test("disables assignment selection for already assigned parcels", () => {
    render(
      <ParcelTable
        enableSelection
        parcels={[
          buildParcelListItem({ id: "eligible", parcelCode: "PF-ELIGIBLE", riderName: null }),
          buildParcelListItem({
            id: "assigned",
            parcelCode: "PF-ASSIGNED",
            riderName: "Assigned Rider",
          }),
        ]}
      />,
    );

    expect(screen.getByLabelText("Select PF-ELIGIBLE").getAttribute("data-disabled")).toBeNull();
    expect(
      screen.getByLabelText("Select PF-ASSIGNED").getAttribute("data-disabled"),
    ).not.toBeNull();
  });

  test("emits selected parcel IDs when selection changes", async () => {
    const user = userEvent.setup();
    const onSelectedParcelIdsChange = mock(() => undefined);
    render(
      <ParcelTable
        enableSelection
        parcels={[buildParcelListItem({ id: "parcel-1", parcelCode: "PF-000001" })]}
        selectedParcelIds={[]}
        onSelectedParcelIdsChange={onSelectedParcelIdsChange}
      />,
    );

    await user.click(screen.getByLabelText("Select PF-000001"));

    expect(onSelectedParcelIdsChange).toHaveBeenCalledWith(["parcel-1"]);
  });

  test("select-all only includes eligible parcel ids", async () => {
    const user = userEvent.setup();
    const onSelectedParcelIdsChange = mock(() => undefined);
    render(
      <ParcelTable
        enableSelection
        parcels={[
          buildParcelListItem({ id: "at-office", parcelCode: "PF-AT-OFFICE", status: "at_office" }),
          buildParcelListItem({ id: "postpone", parcelCode: "PF-POSTPONE", status: "postpone" }),
          buildParcelListItem({
            id: "delivered",
            parcelCode: "PF-DELIVERED",
            status: "delivered",
          }),
        ]}
        selectedParcelIds={[]}
        onSelectedParcelIdsChange={onSelectedParcelIdsChange}
      />,
    );

    await user.click(screen.getByLabelText("Select all parcels"));

    expect(onSelectedParcelIdsChange).toHaveBeenCalledWith(["at-office", "postpone"]);
  });
});

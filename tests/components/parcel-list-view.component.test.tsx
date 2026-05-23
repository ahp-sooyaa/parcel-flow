import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelFailureNoteEntry, buildParcelListItem } from "../fixtures/builders";

describe("ParcelListView", async () => {
  const { ParcelListView } = await import("@/features/parcels/components/parcel-list-view");

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("filters the admin list to active failure-note parcels in the need review tab", async () => {
    const user = userEvent.setup();

    render(
      <ParcelListView
        actorRole="office_admin"
        parcels={[
          buildParcelListItem({
            id: "needs-review",
            parcelCode: "PF-REVIEW",
            status: "on_the_way",
            riderName: "Ko Rider",
            failureNotes: [buildParcelFailureNoteEntry({ note: "Receiver asked to retry." })],
            hasUnresolvedFailureReview: true,
          }),
          buildParcelListItem({
            id: "normal",
            parcelCode: "PF-NORMAL",
            status: "at_office",
          }),
        ]}
        merchants={[]}
        riders={[]}
        townships={[]}
      />,
    );

    expect(screen.getByText("PF-REVIEW")).toBeTruthy();
    expect(screen.getByText("PF-NORMAL")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /need review/i }));

    await waitFor(() => {
      expect(screen.getByText("PF-REVIEW")).toBeTruthy();
      expect(screen.queryByText("PF-NORMAL")).toBeNull();
    });
  });
});

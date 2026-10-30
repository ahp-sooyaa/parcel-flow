import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { apiGet, MobileApiError } from "@/api/client";
import { queryClient } from "@/api/query-client";
import ParcelListScreen from "@/app/(rider)/index";
import { buildListItem, renderWithQueryClient } from "./test-utils";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));

jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  apiGet: jest.fn(),
}));

const apiGetMock = jest.mocked(apiGet);
const tabCounts = { to_deliver: 2, delivered: 7, returned: 0 };

function respondWith(parcels: ReturnType<typeof buildListItem>[], extra = {}) {
  return { parcels, page: 1, totalPages: 1, totalCount: parcels.length, tabCounts, ...extra };
}

beforeEach(() => {
  queryClient.clear();
  apiGetMock.mockReset();
});

describe("ParcelListScreen", () => {
  it("shows parcel cards and the count on each tab", async () => {
    apiGetMock.mockResolvedValue(
      respondWith([
        buildListItem({ id: "p1", parcelCode: "PF-1", receiverName: "Daw Mya" }),
        buildListItem({
          id: "p2",
          parcelCode: "PF-2",
          receiverName: "U Ba",
          amountToCollect: 5000,
        }),
      ]),
    );

    await renderWithQueryClient(<ParcelListScreen />);

    expect(await screen.findByText("Daw Mya")).toBeOnTheScreen();
    expect(screen.getByText("U Ba")).toBeOnTheScreen();
    expect(screen.getByText("5,000 MMK")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "To deliver (2)" })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Delivered (7)" })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Returned (0)" })).toBeOnTheScreen();
    expect(apiGetMock).toHaveBeenCalledWith(
      "/rider/parcels?tab=to_deliver&page=1",
      expect.anything(),
    );
  });

  it("loads the selected tab", async () => {
    apiGetMock.mockResolvedValue(respondWith([buildListItem()]));
    await renderWithQueryClient(<ParcelListScreen />);
    await screen.findByText("Daw Mya");

    apiGetMock.mockResolvedValue(
      respondWith([buildListItem({ id: "p9", receiverName: "Ko Zaw", statusLabel: "Delivered" })]),
    );
    await fireEvent.press(screen.getByRole("tab", { name: "Delivered (7)" }));

    expect(await screen.findByText("Ko Zaw")).toBeOnTheScreen();
    expect(apiGetMock).toHaveBeenLastCalledWith(
      "/rider/parcels?tab=delivered&page=1",
      expect.anything(),
    );
  });

  it("shows the tab's empty message", async () => {
    apiGetMock.mockResolvedValue(respondWith([]));

    await renderWithQueryClient(<ParcelListScreen />);

    expect(await screen.findByText("No parcels to deliver right now.")).toBeOnTheScreen();
  });

  it("shows the error and retries", async () => {
    apiGetMock.mockRejectedValue(
      new MobileApiError(0, "Can't reach Parcel Flow. Check your connection."),
    );
    await renderWithQueryClient(<ParcelListScreen />);

    // The query client retries once before showing the error.
    expect(
      await screen.findByText("Can't reach Parcel Flow. Check your connection.", undefined, {
        timeout: 4000,
      }),
    ).toBeOnTheScreen();

    apiGetMock.mockResolvedValue(respondWith([buildListItem()]));
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Daw Mya")).toBeOnTheScreen());
  });
});

import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { apiGet, apiPost, MobileApiError } from "@/api/client";
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
  apiPost: jest.fn(),
}));

const apiGetMock = jest.mocked(apiGet);
const apiPostMock = jest.mocked(apiPost);
const tabCounts = { to_deliver: 2, delivered: 7, returned: 0 };

function respondWith(parcels: ReturnType<typeof buildListItem>[], extra = {}) {
  return { parcels, page: 1, totalPages: 1, totalCount: parcels.length, tabCounts, ...extra };
}

beforeEach(() => {
  queryClient.clear();
  apiGetMock.mockReset();
  apiPostMock.mockReset();
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

describe("ParcelListScreen start delivery", () => {
  const atOfficeA = buildListItem({
    id: "a1",
    parcelCode: "PF-A1",
    receiverName: "Daw Mya",
    status: "at_office",
    statusLabel: "At Office",
    amountToCollect: 10_000,
  });
  const atOfficeB = buildListItem({
    id: "a2",
    parcelCode: "PF-A2",
    receiverName: "U Ba",
    status: "at_office",
    statusLabel: "At Office",
    amountToCollect: 5_000,
  });
  const onTheWay = buildListItem({ id: "w1", parcelCode: "PF-W1", receiverName: "Ko Zaw" });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderList() {
    apiGetMock.mockResolvedValue(respondWith([atOfficeA, atOfficeB, onTheWay]));
    await renderWithQueryClient(<ParcelListScreen />);
    await screen.findByText("Daw Mya");
  }

  it("offers start delivery and selection only on at-office cards", async () => {
    await renderList();

    expect(screen.getAllByRole("button", { name: "Start delivery" })).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: "Select PF-A1" })).toBeOnTheScreen();
    expect(screen.getByRole("checkbox", { name: "Select PF-A2" })).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox", { name: "Select PF-W1" })).not.toBeOnTheScreen();
  });

  it("starts one parcel from its card without confirming, then refetches", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    apiPostMock.mockResolvedValue({ parcelIds: ["a1"] });
    await renderList();
    const callsBefore = apiGetMock.mock.calls.length;

    await fireEvent.press(screen.getAllByRole("button", { name: "Start delivery" })[0]);

    expect(await screen.findByText("Parcel moved to on the way.")).toBeOnTheScreen();
    expect(apiPostMock).toHaveBeenCalledWith(
      "/rider/parcels/start-delivery",
      { parcelIds: ["a1"] },
      expect.anything(),
    );
    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(apiGetMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("shows the selected count and total, and confirms before starting several", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    apiPostMock.mockResolvedValue({ parcelIds: ["a1", "a2"] });
    await renderList();

    await fireEvent.press(screen.getByRole("checkbox", { name: "Select PF-A1" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Select PF-A2" }));

    expect(screen.getByText("2 selected · 15,000 MMK to collect")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Start delivery (2)" }));

    expect(alertSpy).toHaveBeenCalledWith(
      "Start delivery for 2 parcels?",
      "15,000 MMK to collect.",
      expect.any(Array),
    );
    expect(apiPostMock).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
    await act(async () => {
      buttons.find((button) => button.text === "Start")?.onPress?.();
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      "/rider/parcels/start-delivery",
      { parcelIds: ["a1", "a2"] },
      expect.anything(),
    );
    expect(await screen.findByText("Selected parcels moved to on the way.")).toBeOnTheScreen();
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderList();

    await fireEvent.press(screen.getByRole("checkbox", { name: "Select PF-A1" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Select PF-A2" }));
    await fireEvent.press(screen.getByRole("button", { name: "Start delivery (2)" }));

    const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
    await act(async () => {
      buttons.find((button) => button.text === "Cancel")?.onPress?.();
    });

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(screen.getByText("2 selected · 15,000 MMK to collect")).toBeOnTheScreen();
  });

  it("starts a single selected parcel from the bar without confirming", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    apiPostMock.mockResolvedValue({ parcelIds: ["a2"] });
    await renderList();

    await fireEvent.press(screen.getByRole("checkbox", { name: "Select PF-A2" }));
    await fireEvent.press(screen.getByRole("button", { name: "Start delivery (1)" }));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(apiPostMock).toHaveBeenCalledWith(
      "/rider/parcels/start-delivery",
      { parcelIds: ["a2"] },
      expect.anything(),
    );
  });

  it("shows the server's message when a start is rejected", async () => {
    apiPostMock.mockRejectedValue(
      new MobileApiError(409, "Only assigned at-office parcels can be started for delivery."),
    );
    await renderList();

    await fireEvent.press(screen.getAllByRole("button", { name: "Start delivery" })[0]);

    expect(
      await screen.findByText("Only assigned at-office parcels can be started for delivery."),
    ).toBeOnTheScreen();
  });

  it("clears the selection when switching tabs", async () => {
    await renderList();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Select PF-A1" }));
    expect(screen.getByText("1 selected · 10,000 MMK to collect")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Delivered (7)" }));
    await fireEvent.press(await screen.findByRole("tab", { name: "To deliver (2)" }));
    await screen.findByText("Daw Mya");

    expect(screen.queryByText(/selected ·/)).not.toBeOnTheScreen();
  });
});

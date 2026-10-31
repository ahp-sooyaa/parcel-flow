import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import { apiGet, apiPost, MobileApiError } from "@/api/client";
import { riderParcelsQueryKey } from "@/api/parcels";
import { queryClient } from "@/api/query-client";
import ParcelDetailScreen from "@/app/(rider)/parcels/[parcelId]";
import { buildDetail, buildListItem, renderWithQueryClient } from "./test-utils";

const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000001";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ parcelId: "0f7a3c2e-2222-4b1c-8d9e-000000000001" }),
}));

jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

const apiGetMock = jest.mocked(apiGet);
const apiPostMock = jest.mocked(apiPost);

beforeEach(() => {
  queryClient.clear();
  apiGetMock.mockReset();
  apiPostMock.mockReset();
});

describe("ParcelDetailScreen", () => {
  it("shows the parcel's details", async () => {
    apiGetMock.mockResolvedValue(
      buildDetail({ specialNotes: "Call before arriving", activeFailureNote: "Not home" }),
    );

    await renderWithQueryClient(<ParcelDetailScreen />);

    expect(await screen.findByText("Golden Leaf Tea")).toBeOnTheScreen();
    expect(screen.getByText("PF-000123-000045")).toBeOnTheScreen();
    expect(screen.getByText("Daw Mya")).toBeOnTheScreen();
    expect(screen.getByText("No. 12, Bogyoke Road")).toBeOnTheScreen();
    expect(screen.getByText("28,000 MMK")).toBeOnTheScreen();
    expect(screen.getByText("25,000 MMK")).toBeOnTheScreen();
    expect(screen.getByText("3,000 MMK")).toBeOnTheScreen();
    expect(screen.getByText("Cash on delivery")).toBeOnTheScreen();
    expect(screen.getByText("1.5 kg")).toBeOnTheScreen();
    expect(screen.getByText("Call before arriving")).toBeOnTheScreen();
    expect(screen.getByText("Failure note: Not home")).toBeOnTheScreen();
    expect(apiGetMock).toHaveBeenCalledWith(`/rider/parcels/${parcelId}`, expect.anything());
  });

  it("shows the cached list row while the detail loads", async () => {
    queryClient.setQueryData(riderParcelsQueryKey("to_deliver"), {
      pages: [
        {
          parcels: [buildListItem({ id: parcelId, receiverName: "From the list" })],
          page: 1,
          totalPages: 1,
          totalCount: 1,
          tabCounts: { to_deliver: 1, delivered: 0, returned: 0 },
        },
      ],
      pageParams: [1],
    });
    apiGetMock.mockReturnValue(new Promise(() => undefined));

    await renderWithQueryClient(<ParcelDetailScreen />);

    expect(screen.getByText("From the list")).toBeOnTheScreen();
    expect(screen.getByText("Loading parcel details…")).toBeOnTheScreen();
  });

  it("calls the receiver when the phone number is tapped", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    apiGetMock.mockResolvedValue(buildDetail());
    await renderWithQueryClient(<ParcelDetailScreen />);

    await fireEvent.press(await screen.findByRole("link", { name: "Call 09400000000" }));

    expect(openURL).toHaveBeenCalledWith("tel:09400000000");
  });

  it("explains when the parcel is no longer assigned", async () => {
    apiGetMock.mockRejectedValue(new MobileApiError(404, "Parcel not found."));

    await renderWithQueryClient(<ParcelDetailScreen />);

    expect(
      await screen.findByText("This parcel is no longer assigned to you.", undefined, {
        timeout: 4000,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Back to parcels" })).toBeOnTheScreen();
  });
});

describe("ParcelDetailScreen start delivery", () => {
  it("shows start delivery only for an at-office parcel", async () => {
    apiGetMock.mockResolvedValue(buildDetail());

    await renderWithQueryClient(<ParcelDetailScreen />);
    await screen.findByText("Golden Leaf Tea");

    expect(screen.queryByRole("button", { name: "Start delivery" })).not.toBeOnTheScreen();
  });

  it("starts the parcel and refetches its detail", async () => {
    apiGetMock.mockResolvedValue(buildDetail({ status: "at_office", statusLabel: "At Office" }));
    apiPostMock.mockResolvedValue({ parcelIds: [parcelId] });
    await renderWithQueryClient(<ParcelDetailScreen />);
    await screen.findByText("Golden Leaf Tea");

    apiGetMock.mockResolvedValue(buildDetail());
    await fireEvent.press(screen.getByRole("button", { name: "Start delivery" }));

    expect(await screen.findByText("Parcel moved to on the way.")).toBeOnTheScreen();
    expect(apiPostMock).toHaveBeenCalledWith(
      "/rider/parcels/start-delivery",
      { parcelIds: [parcelId] },
      expect.anything(),
    );
    expect(await screen.findByText("On The Way")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Start delivery" })).not.toBeOnTheScreen();
  });

  it("shows the server's message when the start is rejected", async () => {
    apiGetMock.mockResolvedValue(buildDetail({ status: "at_office", statusLabel: "At Office" }));
    apiPostMock.mockRejectedValue(
      new MobileApiError(409, "Only assigned at-office parcels can be started for delivery."),
    );
    await renderWithQueryClient(<ParcelDetailScreen />);
    await screen.findByText("Golden Leaf Tea");

    await fireEvent.press(screen.getByRole("button", { name: "Start delivery" }));

    expect(
      await screen.findByText("Only assigned at-office parcels can be started for delivery."),
    ).toBeOnTheScreen();
  });
});

describe("ParcelDetailScreen mark delivered", () => {
  it("opens the Mark delivered screen for an on-the-way parcel", async () => {
    const { router } = jest.requireMock<{ router: { push: jest.Mock } }>("expo-router");
    apiGetMock.mockResolvedValue(buildDetail({ id: parcelId, status: "on_the_way" }));
    await renderWithQueryClient(<ParcelDetailScreen />);
    await screen.findByText("Golden Leaf Tea");

    await fireEvent.press(screen.getByRole("button", { name: "Mark delivered" }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/deliver/[parcelId]",
      params: { parcelId },
    });
  });

  it("hides Mark delivered while a failure note is active", async () => {
    apiGetMock.mockResolvedValue(
      buildDetail({ status: "on_the_way", hasActiveFailureNote: true, activeFailureNote: "Out" }),
    );
    await renderWithQueryClient(<ParcelDetailScreen />);
    await screen.findByText("Golden Leaf Tea");

    expect(screen.queryByRole("button", { name: "Mark delivered" })).not.toBeOnTheScreen();
  });
});

import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import { apiGet, apiPostForm, MobileApiError } from "@/api/client";
import { queryClient } from "@/api/query-client";
import MarkDeliveredScreen from "@/app/(rider)/deliver/[parcelId]";
import { chooseProofPhoto, takeProofPhoto } from "@/delivery/proof-photo";
import { buildDetail, renderWithQueryClient } from "./test-utils";

const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000001";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ parcelId: "0f7a3c2e-2222-4b1c-8d9e-000000000001" }),
}));

jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  apiGet: jest.fn(),
  apiPostForm: jest.fn(),
}));

jest.mock("@/delivery/proof-photo", () => ({
  takeProofPhoto: jest.fn(),
  chooseProofPhoto: jest.fn(),
  proofPhotoUploadPart: (photo: { uri: string }) => ({ part: photo.uri }),
}));

const apiGetMock = jest.mocked(apiGet);
const apiPostFormMock = jest.mocked(apiPostForm);
const takeProofPhotoMock = jest.mocked(takeProofPhoto);
const chooseProofPhotoMock = jest.mocked(chooseProofPhoto);
const cameraPhoto = { uri: "file:///cache/camera.jpg", width: 1200, height: 1600 };
const galleryPhoto = { uri: "file:///cache/gallery.jpg", width: 1600, height: 1200 };

beforeEach(() => {
  queryClient.clear();
  apiGetMock.mockReset();
  apiGetMock.mockResolvedValue(buildDetail({ status: "on_the_way", amountToCollect: 28_000 }));
  apiPostFormMock.mockReset();
  takeProofPhotoMock.mockReset();
  takeProofPhotoMock.mockResolvedValue({ status: "picked", photo: cameraPhoto });
  chooseProofPhotoMock.mockReset();
  chooseProofPhotoMock.mockResolvedValue({ status: "picked", photo: galleryPhoto });
});

async function renderScreen() {
  await renderWithQueryClient(<MarkDeliveredScreen />);
  await screen.findByText("28,000 MMK");
}

function confirmButton() {
  return screen.getByRole("button", { name: "Confirm delivered" });
}

describe("MarkDeliveredScreen", () => {
  it("shows the parcel and amount, with confirm disabled until there's a photo", async () => {
    await renderScreen();

    expect(screen.getByText("PF-000123-000045")).toBeOnTheScreen();
    expect(screen.getByText("Daw Mya")).toBeOnTheScreen();
    expect(confirmButton()).toBeDisabled();
  });

  it("takes a photo, shows the preview, and retakes", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));

    expect(await screen.findByLabelText("Delivery proof preview")).toHaveProp("source", {
      uri: cameraPhoto.uri,
    });
    expect(confirmButton()).toBeEnabled();

    await fireEvent.press(screen.getByRole("button", { name: "Retake" }));
    expect(takeProofPhotoMock).toHaveBeenCalledTimes(2);
  });

  it("uses a photo from the gallery", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Choose from gallery" }));

    expect(await screen.findByLabelText("Delivery proof preview")).toHaveProp("source", {
      uri: galleryPhoto.uri,
    });
  });

  it("explains a denied camera and still offers the gallery", async () => {
    takeProofPhotoMock.mockResolvedValue({ status: "denied" });
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    await renderScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));

    expect(
      await screen.findByText("Parcel Flow needs camera access to take the proof photo."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Open settings" }));
    expect(openSettings).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose from gallery" })).toBeOnTheScreen();
    openSettings.mockRestore();
  });

  it("uploads the photo and shows the success state", async () => {
    apiPostFormMock.mockResolvedValue({ parcelId });
    // Node's FormData would stringify the part, so check what was appended.
    const append = jest.spyOn(FormData.prototype, "append");
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    await screen.findByLabelText("Delivery proof preview");

    await fireEvent.press(confirmButton());

    expect(await screen.findByText("Parcel marked delivered.")).toBeOnTheScreen();
    expect(apiPostFormMock.mock.calls[0]?.[0]).toBe(`/rider/parcels/${parcelId}/deliver`);
    expect(append).toHaveBeenCalledWith("proofImage", { part: cameraPhoto.uri });
    append.mockRestore();

    const { router } = jest.requireMock<{ router: { back: jest.Mock } }>("expo-router");
    await fireEvent.press(screen.getByRole("button", { name: "Done" }));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows a rejection and keeps the photo for another try", async () => {
    apiPostFormMock.mockRejectedValue(
      new MobileApiError(500, "Couldn't save the delivery photo. Try again."),
    );
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    await screen.findByLabelText("Delivery proof preview");

    await fireEvent.press(confirmButton());

    expect(
      await screen.findByText("Couldn't save the delivery photo. Try again."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Delivery proof preview")).toBeOnTheScreen();
    expect(confirmButton()).toBeEnabled();
  });

  it("offers no photo controls for a parcel that isn't on the way", async () => {
    apiGetMock.mockResolvedValue(buildDetail({ status: "delivered", statusLabel: "Delivered" }));

    await renderWithQueryClient(<MarkDeliveredScreen />);

    expect(
      await screen.findByText("This parcel is delivered, so it can't be marked delivered."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Take photo" })).not.toBeOnTheScreen();
  });

  it("offers no photo controls while a failure note is active", async () => {
    apiGetMock.mockResolvedValue(
      buildDetail({ status: "on_the_way", hasActiveFailureNote: true, activeFailureNote: "Out" }),
    );

    await renderWithQueryClient(<MarkDeliveredScreen />);

    expect(await screen.findByText(/has a delivery failure note/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Take photo" })).not.toBeOnTheScreen();
  });

  it("shows when the parcel is no longer assigned", async () => {
    apiGetMock.mockRejectedValue(new MobileApiError(404, "Parcel not found."));

    await renderWithQueryClient(<MarkDeliveredScreen />);

    // The query client retries once before giving up.
    expect(
      await screen.findByText("This parcel is no longer assigned to you.", {}, { timeout: 4000 }),
    ).toBeOnTheScreen();
  });
});

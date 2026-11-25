import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, type AlertButton } from "react-native";

import { apiDelete, apiGet, apiPatch, apiPost, MobileApiError } from "@/api/client";
import { queryClient } from "@/api/query-client";
import FailureNoteScreen from "@/app/(rider)/failure/[parcelId]";
import { addQuickReason } from "@/delivery/failure-reasons";
import { buildDetail, renderWithQueryClient } from "./test-utils";

const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000001";
const notePath = `/rider/parcels/${parcelId}/failure-note`;

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ parcelId: "0f7a3c2e-2222-4b1c-8d9e-000000000001" }),
}));

jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));

const apiGetMock = jest.mocked(apiGet);
const apiPostMock = jest.mocked(apiPost);
const apiPatchMock = jest.mocked(apiPatch);
const apiDeleteMock = jest.mocked(apiDelete);
const backMock = jest.mocked(router.back);

beforeEach(() => {
  queryClient.clear();
  for (const mock of [apiGetMock, apiPostMock, apiPatchMock, apiDeleteMock, backMock]) {
    mock.mockReset();
  }
  apiGetMock.mockResolvedValue(buildDetail());
});

function noteInput() {
  return screen.getByLabelText("Failure note");
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

async function renderReport() {
  await renderWithQueryClient(<FailureNoteScreen />);
  await screen.findByLabelText("Failure note");
}

async function renderEdit(note = "Receiver not home.") {
  apiGetMock.mockResolvedValue(
    buildDetail({ hasActiveFailureNote: true, activeFailureNote: note }),
  );
  await renderWithQueryClient(<FailureNoteScreen />);
  await screen.findByDisplayValue(note);
}

describe("addQuickReason", () => {
  it("fills an empty note and appends to one with text", () => {
    expect(addQuickReason("  ", "Wrong address")).toBe("Wrong address");
    expect(addQuickReason("Called twice. ", "Wrong address")).toBe("Called twice.\nWrong address");
  });

  it("stays within the note limit", () => {
    expect(addQuickReason("x".repeat(499), "Wrong address")).toHaveLength(500);
  });
});

describe("FailureNoteScreen", () => {
  it("reports a failure with the trimmed note and closes", async () => {
    apiPostMock.mockResolvedValue({ parcelId, activeFailureNote: "Wrong address." });
    await renderReport();

    expect(screen.getByText("PF-000123-000045")).toBeOnTheScreen();
    expect(button("Report failure")).toBeDisabled();

    await fireEvent.changeText(noteInput(), "  Wrong address.  ");

    expect(screen.getByText("18/500")).toBeOnTheScreen();
    await fireEvent.press(button("Report failure"));

    await waitFor(() => expect(backMock).toHaveBeenCalled());
    expect(apiPostMock.mock.calls[0]?.slice(0, 2)).toEqual([notePath, { note: "Wrong address." }]);
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
  });

  it("keeps a blank note disabled", async () => {
    await renderReport();

    await fireEvent.changeText(noteInput(), "   ");

    expect(button("Report failure")).toBeDisabled();
  });

  it("fills the note from quick reasons", async () => {
    await renderReport();

    await fireEvent.press(button("Receiver didn't answer the phone"));
    await fireEvent.press(button("Wrong or incomplete address"));

    expect(noteInput()).toHaveDisplayValue(
      "Receiver didn't answer the phone\nWrong or incomplete address",
    );
    expect(button("Report failure")).toBeEnabled();
  });

  it("edits the note with PATCH, and needs a change first", async () => {
    apiPatchMock.mockResolvedValue({ parcelId, activeFailureNote: "Wrong address." });
    await renderEdit();

    expect(button("Save note")).toBeDisabled();

    await fireEvent.changeText(noteInput(), "Wrong address.");
    await fireEvent.press(button("Save note"));

    await waitFor(() => expect(backMock).toHaveBeenCalled());
    expect(apiPatchMock.mock.calls[0]?.slice(0, 2)).toEqual([notePath, { note: "Wrong address." }]);
  });

  it("deletes the note after confirming", async () => {
    apiDeleteMock.mockResolvedValue({ parcelId, activeFailureNote: null });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderEdit();

    await fireEvent.press(button("Delete note"));

    const buttons = (alert.mock.calls[0]?.[2] ?? []) as AlertButton[];
    expect(alert.mock.calls[0]?.[0]).toBe("Delete this failure note?");
    expect(apiDeleteMock).not.toHaveBeenCalled();

    buttons.find((choice) => choice.text === "Delete")?.onPress?.();

    await waitFor(() => expect(backMock).toHaveBeenCalled());
    expect(apiDeleteMock.mock.calls[0]?.[0]).toBe(notePath);
    alert.mockRestore();
  });

  it("does nothing when the delete is cancelled", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderEdit();

    await fireEvent.press(button("Delete note"));
    const buttons = (alert.mock.calls[0]?.[2] ?? []) as AlertButton[];
    buttons.find((choice) => choice.text === "Cancel")?.onPress?.();

    expect(apiDeleteMock).not.toHaveBeenCalled();
    expect(backMock).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it("shows a save error and keeps the text", async () => {
    apiPostMock.mockRejectedValue(
      new MobileApiError(409, "Only on-the-way parcels can be reported as failed."),
    );
    await renderReport();
    await fireEvent.changeText(noteInput(), "Wrong address.");

    await fireEvent.press(button("Report failure"));

    expect(
      await screen.findByText("Only on-the-way parcels can be reported as failed."),
    ).toBeOnTheScreen();
    expect(noteInput()).toHaveDisplayValue("Wrong address.");
    expect(backMock).not.toHaveBeenCalled();
  });

  it("switches to editing when a note was reported elsewhere, keeping typed text", async () => {
    apiPostMock.mockRejectedValue(
      new MobileApiError(409, "This parcel already has an active failure note."),
    );
    await renderReport();
    await fireEvent.changeText(noteInput(), "Wrong address.");
    apiGetMock.mockResolvedValue(
      buildDetail({ hasActiveFailureNote: true, activeFailureNote: "Receiver not home." }),
    );

    await fireEvent.press(button("Report failure"));

    expect(
      await screen.findByText(
        "A failure note was already reported for this parcel. Saving replaces it.",
      ),
    ).toBeOnTheScreen();
    expect(button("Save note")).toBeEnabled();
    expect(noteInput()).toHaveDisplayValue("Wrong address.");
  });

  it("explains a parcel that's no longer on the way", async () => {
    apiGetMock.mockResolvedValue(buildDetail({ status: "delivered", statusLabel: "Delivered" }));
    await renderWithQueryClient(<FailureNoteScreen />);

    expect(
      await screen.findByText("This parcel is delivered, so its failure note can't be changed."),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("Failure note")).toBeNull();
  });

  it("explains a parcel that's no longer assigned", async () => {
    apiGetMock.mockRejectedValue(new MobileApiError(404, "Parcel not found."));
    await renderWithQueryClient(<FailureNoteScreen />);

    // The query retries once before giving up.
    expect(
      await screen.findByText("This parcel is no longer assigned to you.", undefined, {
        timeout: 4000,
      }),
    ).toBeOnTheScreen();
  });
});

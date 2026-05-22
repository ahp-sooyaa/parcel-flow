import { describe, expect, test } from "bun:test";

import {
  appendActiveParcelFailureNote,
  deactivateLatestActiveParcelFailureNote,
  getActiveParcelFailureNote,
  parseParcelFailureNotes,
  removeLatestActiveParcelFailureNote,
} from "@/features/parcels/server/failure-notes";

describe("parcel failure note helpers", () => {
  test("parses valid note history and ignores invalid values", () => {
    expect(
      parseParcelFailureNotes([
        {
          note: "Receiver was not available.",
          status: "active",
        },
      ]),
    ).toEqual([
      {
        note: "Receiver was not available.",
        status: "active",
      },
    ]);
    expect(parseParcelFailureNotes("Receiver was not available.")).toEqual([]);
  });

  test("returns the latest active failure note", () => {
    const notes = [
      {
        note: "First attempt failed.",
        status: "inactive" as const,
      },
      {
        note: "Second attempt failed.",
        status: "active" as const,
      },
    ];

    expect(getActiveParcelFailureNote(notes)).toEqual(notes[1]);
  });

  test("appends and deactivates active notes", () => {
    const appendedNotes = appendActiveParcelFailureNote([], "Receiver asked for tomorrow.");

    expect(appendedNotes).toEqual([
      {
        note: "Receiver asked for tomorrow.",
        status: "active",
      },
    ]);
    expect(deactivateLatestActiveParcelFailureNote(appendedNotes)).toEqual([
      {
        note: "Receiver asked for tomorrow.",
        status: "inactive",
      },
    ]);
  });

  test("removes the latest active note for delete compatibility", () => {
    expect(
      removeLatestActiveParcelFailureNote([
        {
          note: "Old failure.",
          status: "inactive",
        },
        {
          note: "Current failure.",
          status: "active",
        },
      ]),
    ).toEqual([
      {
        note: "Old failure.",
        status: "inactive",
      },
    ]);
  });
});

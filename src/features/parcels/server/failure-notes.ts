import { z } from "zod";

export const parcelFailureNoteStatusSchema = z.enum(["active", "inactive"]);

export const parcelFailureNoteEntrySchema = z.object({
  note: z.string().trim().min(1),
  status: parcelFailureNoteStatusSchema,
});

export const parcelFailureNotesSchema = z.array(parcelFailureNoteEntrySchema);

export type ParcelFailureNoteEntry = z.infer<typeof parcelFailureNoteEntrySchema>;

export function parseParcelFailureNotes(value: unknown): ParcelFailureNoteEntry[] {
  const result = parcelFailureNotesSchema.safeParse(value);

  if (!result.success) {
    return [];
  }

  return result.data;
}

export function getActiveParcelFailureNote(
  notes: ParcelFailureNoteEntry[],
): ParcelFailureNoteEntry | null {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];

    if (note?.status === "active") {
      return note;
    }
  }

  return null;
}

export function appendActiveParcelFailureNote(
  notes: ParcelFailureNoteEntry[],
  note: string,
): ParcelFailureNoteEntry[] {
  return [
    ...notes,
    {
      note: note.trim(),
      status: "active",
    },
  ];
}

export function deactivateLatestActiveParcelFailureNote(
  notes: ParcelFailureNoteEntry[],
): ParcelFailureNoteEntry[] | null {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];

    if (note?.status !== "active") {
      continue;
    }

    return notes.map((entry, entryIndex) =>
      entryIndex === index
        ? {
            ...entry,
            status: "inactive" as const,
          }
        : entry,
    );
  }

  return null;
}

export function removeLatestActiveParcelFailureNote(
  notes: ParcelFailureNoteEntry[],
): ParcelFailureNoteEntry[] | null {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];

    if (note?.status !== "active") {
      continue;
    }

    return notes.filter((_, entryIndex) => entryIndex !== index);
  }

  return null;
}

import { MOBILE_FAILURE_NOTE_MAX_LENGTH } from "@parcel-flow/contract";

// App-side shortcuts only: the server stores whatever text the rider saves.
export const QUICK_FAILURE_REASONS = [
  "Receiver didn't answer the phone",
  "Receiver not at the address",
  "Wrong or incomplete address",
  "Receiver refused the parcel",
  "Receiver asked for another day",
] as const;

/** Fills an empty note with the reason, or adds it on a new line. */
export function addQuickReason(note: string, reason: string) {
  const next = note.trim() === "" ? reason : `${note.trimEnd()}\n${reason}`;
  return next.slice(0, MOBILE_FAILURE_NOTE_MAX_LENGTH);
}

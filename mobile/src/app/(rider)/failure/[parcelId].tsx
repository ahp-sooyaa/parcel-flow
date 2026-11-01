import type { MobileRiderParcelListItemDto } from "@parcel-flow/contract";
import {
  MOBILE_FAILURE_NOTE_MAX_LENGTH,
  mobileFailureNoteRequestSchema,
} from "@parcel-flow/contract";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";

import {
  useDeleteFailureNote,
  useReportFailure,
  useRiderParcel,
  useUpdateFailureNote,
} from "@/api/parcels";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { NotEligible, ParcelSummary, parcelLoadState } from "@/components/parcel-modal-states";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { addQuickReason, QUICK_FAILURE_REASONS } from "@/delivery/failure-reasons";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function FailureNoteScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const parcel = useRiderParcel(parcelId);
  const [openedMode, setOpenedMode] = useState<"report" | "edit" | null>(null);
  const summary = parcel.data ?? parcel.preview;
  const existingNote = parcel.data?.activeFailureNote ?? null;
  // The list row only says whether a note exists; its text comes with the detail.
  const hasNote = parcel.data ? existingNote !== null : (summary?.hasActiveFailureNote ?? false);
  const title = hasNote ? "Edit failure note" : "Report failure";

  // Remember which form the rider opened, to tell them if a note turns up meanwhile.
  if (summary && openedMode === null && (parcel.data || !hasNote)) {
    setOpenedMode(hasNote ? "edit" : "report");
  }

  const screenOptions = <Stack.Screen options={{ title }} />;
  const loadState = parcelLoadState(parcel, {
    screenOptions,
    ready: summary !== undefined && (!hasNote || parcel.data !== undefined),
  });

  if (loadState || !summary) {
    return loadState;
  }

  if (summary.status !== "on_the_way") {
    return (
      <NotEligible
        message={`This parcel is ${summary.statusLabel.toLowerCase()}, so its failure note can't be changed.`}
        options={screenOptions}
      />
    );
  }

  return (
    <FailureNoteForm
      alreadyReported={openedMode === "report" && hasNote}
      existingNote={existingNote}
      parcel={summary}
      title={title}
    />
  );
}

type FailureNoteFormProps = {
  parcel: MobileRiderParcelListItemDto;
  /** The saved note's text, or null when reporting a new failure. */
  existingNote: string | null;
  /** The rider opened the screen to report, but a note was reported meanwhile. */
  alreadyReported: boolean;
  title: string;
};

function FailureNoteForm({
  parcel,
  existingNote,
  alreadyReported,
  title,
}: Readonly<FailureNoteFormProps>) {
  const report = useReportFailure(parcel.id);
  const update = useUpdateFailureNote(parcel.id);
  const remove = useDeleteFailureNote(parcel.id);
  const [draft, setDraft] = useState(existingNote ?? "");
  const [seededFrom, setSeededFrom] = useState(existingNote);
  const [error, setError] = useState<string | null>(null);
  const hasNote = existingNote !== null;
  const saving = report.isPending || update.isPending || remove.isPending;

  // Start from the saved note, without replacing anything the rider has typed.
  if (existingNote !== seededFrom) {
    setSeededFrom(existingNote);

    if (existingNote !== null && draft.trim() === "") {
      setDraft(existingNote);
    }
  }

  // Don't let Android's back button abandon a save half way.
  useEffect(() => {
    if (!saving) {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [saving]);

  const parsed = mobileFailureNoteRequestSchema.safeParse({ note: draft });
  const unchanged = parsed.success && parsed.data.note === existingNote;
  const canSave = parsed.success && !unchanged;

  const callbacks = {
    onSuccess: () => router.back(),
    onError: (mutationError: Error) => setError(mutationError.message),
  };

  function save() {
    if (!parsed.success) {
      return;
    }

    setError(null);

    if (hasNote) {
      update.mutate(parsed.data.note, callbacks);
    } else {
      report.mutate(parsed.data.note, callbacks);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete this failure note?", "Mark delivered will be available again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setError(null);
          remove.mutate(undefined, callbacks);
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title, gestureEnabled: !saving }} />

      <ParcelSummary callable parcel={parcel} />

      {alreadyReported ? (
        <Notice
          message="A failure note was already reported for this parcel. Saving replaces it."
          tone="warning"
        />
      ) : null}
      {error ? <Notice message={error} /> : null}

      <View style={styles.reasons}>
        <Text style={styles.sectionTitle}>Quick reasons</Text>
        <View style={styles.chips}>
          {QUICK_FAILURE_REASONS.map((reason) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              key={reason}
              onPress={() => setDraft((current) => addQuickReason(current, reason))}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipLabel}>{reason}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.noteField}>
        <TextField
          autoCapitalize="sentences"
          autoCorrect
          editable={!saving}
          label="Failure note"
          maxLength={MOBILE_FAILURE_NOTE_MAX_LENGTH}
          multiline
          onChangeText={setDraft}
          placeholder="What happened at the doorstep?"
          value={draft}
        />
        <Text style={styles.count}>
          {draft.length}/{MOBILE_FAILURE_NOTE_MAX_LENGTH}
        </Text>
      </View>

      <Button
        busy={report.isPending || update.isPending}
        disabled={!canSave || saving}
        label={hasNote ? "Save note" : "Report failure"}
        onPress={save}
      />

      {hasNote ? (
        <Button
          busy={remove.isPending}
          disabled={saving}
          label="Delete note"
          onPress={confirmDelete}
          variant="danger"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  reasons: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.inkMute,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipPressed: {
    backgroundColor: colors.hairline,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.ink,
  },
  noteField: {
    gap: spacing.xxs,
  },
  count: {
    ...typography.micro,
    color: colors.inkMute,
    textAlign: "right",
  },
});

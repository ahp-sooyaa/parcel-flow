import {
  MOBILE_FAILURE_NOTE_MAX_LENGTH,
  mobileFailureNoteRequestSchema,
} from "@parcel-flow/contract";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { MobileApiError } from "@/api/client";
import {
  useDeleteFailureNote,
  useReportFailure,
  useRiderParcel,
  useUpdateFailureNote,
} from "@/api/parcels";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { addQuickReason, QUICK_FAILURE_REASONS } from "@/delivery/failure-reasons";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function FailureNoteScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const parcel = useRiderParcel(parcelId);
  const report = useReportFailure(parcelId);
  const update = useUpdateFailureNote(parcelId);
  const remove = useDeleteFailureNote(parcelId);
  const [draft, setDraft] = useState("");
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  const [openedMode, setOpenedMode] = useState<"report" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = parcel.data ?? parcel.preview;
  const existingNote = parcel.data?.activeFailureNote ?? null;
  // The list row only says whether a note exists; its text comes with the detail.
  const hasNote = parcel.data ? existingNote !== null : (summary?.hasActiveFailureNote ?? false);
  const saving = report.isPending || update.isPending || remove.isPending;

  // Remember which form the rider opened, to tell them if a note turns up meanwhile.
  if (summary && openedMode === null && (parcel.data || !hasNote)) {
    setOpenedMode(hasNote ? "edit" : "report");
  }

  // Start from the saved note, without replacing anything the rider has typed.
  if (existingNote !== null && existingNote !== seededFrom) {
    setSeededFrom(existingNote);

    if (draft.trim() === "") {
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

  const screenOptions = (
    <Stack.Screen
      options={{ title: hasNote ? "Edit failure note" : "Report failure", gestureEnabled: !saving }}
    />
  );

  if (parcel.isError && parcel.error instanceof MobileApiError && parcel.error.status === 404) {
    return (
      <NotEligible message="This parcel is no longer assigned to you." options={screenOptions} />
    );
  }

  if (!summary || (hasNote && !parcel.data)) {
    if (parcel.isError) {
      return (
        <Screen>
          {screenOptions}
          <Notice message={parcel.error.message} />
          <Button label="Try again" onPress={() => void parcel.refetch()} variant="secondary" />
        </Screen>
      );
    }

    return <LoadingScreen />;
  }

  if (summary.status !== "on_the_way") {
    return (
      <NotEligible
        message={`This parcel is ${summary.statusLabel.toLowerCase()}, so its failure note can't be changed.`}
        options={screenOptions}
      />
    );
  }

  const parsed = mobileFailureNoteRequestSchema.safeParse({ note: draft });
  const unchanged = hasNote && parsed.success && parsed.data.note === existingNote;
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
      {screenOptions}

      <View style={styles.summary}>
        <Text style={styles.code}>{summary.parcelCode}</Text>
        <Text style={styles.receiver}>{summary.receiverName}</Text>
        <Pressable
          accessibilityHint="Opens the phone dialer"
          accessibilityLabel={`Call ${summary.receiverPhoneNumber}`}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`tel:${summary.receiverPhoneNumber}`)}
        >
          <Text style={styles.phone}>{summary.receiverPhoneNumber}</Text>
        </Pressable>
        <Text style={styles.address}>{summary.receiverAddress}</Text>
      </View>

      {openedMode === "report" && hasNote ? (
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

function NotEligible({
  message,
  options,
}: Readonly<{ message: string; options: React.ReactNode }>) {
  return (
    <Screen>
      {options}
      <Notice message={message} tone="warning" />
      <Button label="Back" onPress={() => router.back()} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.xxs,
  },
  code: {
    ...typography.caption,
    color: colors.inkMute,
    fontFamily: "monospace",
  },
  receiver: {
    ...typography.headingLg,
    color: colors.ink,
  },
  phone: {
    ...typography.bodyMd,
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  address: {
    ...typography.bodyMd,
    color: colors.ink,
  },
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

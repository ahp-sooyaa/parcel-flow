import type {
  MobileRiderParcelDetailDto,
  MobileRiderParcelListItemDto,
} from "@parcel-flow/contract";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MobileApiError } from "@/api/client";
import { useReturnToMerchant, useRiderParcel, useStartDelivery } from "@/api/parcels";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { PhoneLink } from "@/components/phone-link";
import { Screen } from "@/components/screen";
import { StatusBadge } from "@/components/status-badge";
import { confirmReturn } from "@/delivery/return-to-merchant";
import { formatMmk } from "@/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const parcelTypeLabels = { cod: "Cash on delivery", non_cod: "Prepaid" } as const;

type ActionResult = { tone: "success" | "danger"; message: string };

export default function ParcelDetailScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const parcel = useRiderParcel(parcelId);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const detail = parcel.data;
  // The list row shows right away; the full detail fills in when it arrives.
  const summary = detail ?? parcel.preview;

  if (parcel.isError && parcel.error instanceof MobileApiError && parcel.error.status === 404) {
    return (
      <Screen>
        <Notice message="This parcel is no longer assigned to you." tone="warning" />
        <Button label="Back to parcels" onPress={() => router.back()} variant="secondary" />
      </Screen>
    );
  }

  if (!summary) {
    if (parcel.isError) {
      return (
        <Screen>
          <Notice message={parcel.error.message} />
          <Button label="Try again" onPress={() => void parcel.refetch()} variant="secondary" />
        </Screen>
      );
    }

    return <LoadingScreen />;
  }

  // Nothing is collected on a return, so it shows where the parcel goes instead.
  const isReturn = summary.status === "canceled_returned";

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.code}>{summary.parcelCode}</Text>
        <StatusBadge label={summary.statusLabel} status={summary.status} />
      </View>

      {actionResult ? <Notice message={actionResult.message} tone={actionResult.tone} /> : null}

      {isReturn ? (
        <ReturnSection detail={detail} onResult={setActionResult} parcel={summary} />
      ) : (
        <DeliveryActions detail={detail} onResult={setActionResult} parcel={summary} />
      )}

      <Section title="Receiver">
        <Text style={styles.primaryText}>{summary.receiverName}</Text>
        <PhoneLink phoneNumber={summary.receiverPhoneNumber} />
        <Text style={styles.bodyText}>{summary.receiverAddress}</Text>
        <Text style={styles.mutedText}>{summary.townshipName}</Text>
      </Section>

      {isReturn ? null : (
        <Section title="Collection">
          <Row label="Amount to collect" value={formatMmk(summary.amountToCollect)} strong />
          {detail ? (
            <>
              <Row label="COD amount" value={formatMmk(detail.codAmount)} />
              <Row label="Delivery fee" value={formatMmk(detail.deliveryFee)} />
            </>
          ) : null}
        </Section>
      )}

      {detail ? (
        <Section title="Parcel">
          <Row label="Merchant" value={detail.merchantName} />
          <Row label="Type" value={parcelTypeLabels[detail.parcelType]} />
          <Row label="Weight" value={`${detail.weightKg} kg`} />
          {detail.specialNotes ? (
            <View style={styles.notes}>
              <Text style={styles.rowLabel}>Special notes</Text>
              <Text style={styles.bodyText}>{detail.specialNotes}</Text>
            </View>
          ) : null}
        </Section>
      ) : (
        <Text style={styles.mutedText}>Loading parcel details…</Text>
      )}
    </Screen>
  );
}

type ActionProps = {
  parcel: MobileRiderParcelListItemDto;
  detail: MobileRiderParcelDetailDto | undefined;
  onResult: (result: ActionResult | null) => void;
};

/** Start delivery, Mark delivered and the failure note, by status. */
function DeliveryActions({ parcel, detail, onResult }: Readonly<ActionProps>) {
  const startDelivery = useStartDelivery();

  function start() {
    onResult(null);
    startDelivery.mutate([parcel.id], {
      onSuccess: () => onResult({ tone: "success", message: "Parcel moved to on the way." }),
      onError: (error) => onResult({ tone: "danger", message: error.message }),
    });
  }

  function openFailureNote() {
    router.push({ pathname: "/failure/[parcelId]", params: { parcelId: parcel.id } });
  }

  if (parcel.status === "at_office") {
    return <Button busy={startDelivery.isPending} label="Start delivery" onPress={start} />;
  }

  if (parcel.status !== "on_the_way") {
    return null;
  }

  if (!parcel.hasActiveFailureNote) {
    return (
      <>
        <Button
          label="Mark delivered"
          onPress={() =>
            router.push({ pathname: "/deliver/[parcelId]", params: { parcelId: parcel.id } })
          }
        />
        <Button label="Report failure" onPress={openFailureNote} variant="secondary" />
      </>
    );
  }

  return detail?.activeFailureNote ? (
    <View style={[styles.section, styles.failureSection]}>
      <Text style={styles.sectionTitle}>Failure reported</Text>
      <Text style={styles.bodyText}>{detail.activeFailureNote}</Text>
      <Text style={styles.mutedText}>
        An admin will review this parcel. Delete the note if you can still deliver it.
      </Text>
      <Button label="Edit note" onPress={openFailureNote} variant="secondary" />
    </View>
  ) : null;
}

/** Where a `canceled_returned` parcel goes back to, and "Mark returned". */
function ReturnSection({ parcel, detail, onResult }: Readonly<ActionProps>) {
  const returnToMerchant = useReturnToMerchant();
  const contact = detail?.merchantReturnContact ?? null;

  function markReturned() {
    onResult(null);
    returnToMerchant.mutate(parcel.id, {
      onSuccess: () => onResult({ tone: "success", message: "Parcel returned to merchant." }),
      onError: (error) => onResult({ tone: "danger", message: error.message }),
    });
  }

  return (
    <Section title="Return to merchant">
      <Text style={styles.primaryText}>{parcel.merchantName}</Text>
      {contact?.phoneNumber ? <PhoneLink phoneNumber={contact.phoneNumber} /> : null}
      {contact ? <Text style={styles.bodyText}>{contact.address}</Text> : null}
      <View style={styles.sectionAction}>
        <Button
          busy={returnToMerchant.isPending}
          label="Mark returned"
          onPress={() => confirmReturn(parcel, markReturned)}
        />
      </View>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  code: {
    ...typography.bodyMd,
    color: colors.ink,
    fontFamily: "monospace",
  },
  section: {
    gap: spacing.xs,
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  failureSection: {
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  sectionAction: {
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.inkMute,
    letterSpacing: 1,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  primaryText: {
    ...typography.headingLg,
    color: colors.ink,
  },
  bodyText: {
    ...typography.bodyMd,
    color: colors.ink,
  },
  mutedText: {
    ...typography.caption,
    color: colors.inkMute,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.inkMute,
  },
  rowValue: {
    ...typography.bodyMd,
    color: colors.ink,
    flexShrink: 1,
    textAlign: "right",
  },
  rowValueStrong: {
    fontWeight: "700",
  },
  notes: {
    gap: spacing.xxs,
    paddingTop: spacing.xs,
  },
});

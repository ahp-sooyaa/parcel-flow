import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MobileApiError } from "@/api/client";
import { useMarkDelivered, useRiderParcel } from "@/api/parcels";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import {
  chooseProofPhoto,
  takeProofPhoto,
  type ProofPhoto,
  type ProofPhotoResult,
} from "@/delivery/proof-photo";
import { formatMmk } from "@/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function MarkDeliveredScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const parcel = useRiderParcel(parcelId);
  const markDelivered = useMarkDelivered(parcelId);
  const [photo, setPhoto] = useState<ProofPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);
  const summary = parcel.data ?? parcel.preview;
  const saving = markDelivered.isPending;

  // Don't let Android's back button abandon an upload half way.
  useEffect(() => {
    if (!saving) {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [saving]);

  async function pickPhoto(pick: () => Promise<ProofPhotoResult>) {
    setPhotoError(null);
    setPreparing(true);

    try {
      const result = await pick();

      if (result.status === "denied") {
        setCameraDenied(true);
      } else if (result.status === "picked") {
        setCameraDenied(false);
        setPhoto(result.photo);
      }
    } catch {
      setPhotoError("Couldn't get the photo. Try again.");
    } finally {
      setPreparing(false);
    }
  }

  function confirm() {
    if (!photo) {
      return;
    }

    markDelivered.mutate(photo, { onSuccess: () => setDelivered(true) });
  }

  const screenOptions = <Stack.Screen options={{ gestureEnabled: !saving }} />;

  if (delivered) {
    return (
      <Screen>
        {screenOptions}
        <Notice message="Parcel marked delivered." tone="success" />
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (parcel.isError && parcel.error instanceof MobileApiError && parcel.error.status === 404) {
    return (
      <NotEligible message="This parcel is no longer assigned to you." options={screenOptions} />
    );
  }

  if (!summary) {
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
        message={`This parcel is ${summary.statusLabel.toLowerCase()}, so it can't be marked delivered.`}
        options={screenOptions}
      />
    );
  }

  if (summary.hasActiveFailureNote) {
    return (
      <NotEligible
        message="This parcel has a delivery failure note. Resolve it before marking the parcel delivered."
        options={screenOptions}
      />
    );
  }

  return (
    <Screen>
      {screenOptions}

      <View style={styles.summary}>
        <Text style={styles.code}>{summary.parcelCode}</Text>
        <Text style={styles.receiver}>{summary.receiverName}</Text>
        <Text style={styles.address}>{summary.receiverAddress}</Text>
      </View>

      <View style={styles.collect}>
        <Text style={styles.collectLabel}>Collect</Text>
        <Text style={styles.collectAmount}>{formatMmk(summary.amountToCollect)}</Text>
      </View>

      {markDelivered.isError ? <Notice message={markDelivered.error.message} /> : null}
      {photoError ? <Notice message={photoError} /> : null}

      <View style={styles.photoSection}>
        <Text style={styles.sectionTitle}>Delivery proof photo</Text>

        <PhotoPicker
          cameraDenied={cameraDenied}
          onTake={() => void pickPhoto(takeProofPhoto)}
          photo={photo}
          preparing={preparing}
          saving={saving}
        />

        {!preparing && !saving ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={spacing.sm}
            onPress={() => void pickPhoto(chooseProofPhoto)}
          >
            <Text style={styles.link}>Choose from gallery</Text>
          </Pressable>
        ) : null}
      </View>

      <Button
        busy={saving}
        disabled={!photo || preparing}
        label="Confirm delivered"
        onPress={confirm}
      />
    </Screen>
  );
}

type PhotoPickerProps = {
  photo: ProofPhoto | null;
  preparing: boolean;
  saving: boolean;
  cameraDenied: boolean;
  onTake: () => void;
};

/** The photo preview with "Retake", or "Take photo" (with the camera-denied notice). */
function PhotoPicker({
  photo,
  preparing,
  saving,
  cameraDenied,
  onTake,
}: Readonly<PhotoPickerProps>) {
  if (preparing) {
    return (
      <View style={styles.preparing}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Preparing photo…</Text>
      </View>
    );
  }

  if (photo) {
    return (
      <>
        <Image
          accessibilityLabel="Delivery proof preview"
          resizeMode="cover"
          source={{ uri: photo.uri }}
          style={styles.preview}
        />
        <Button disabled={saving} label="Retake" onPress={onTake} variant="secondary" />
      </>
    );
  }

  return (
    <>
      {cameraDenied ? (
        <View style={styles.denied}>
          <Notice
            message="Parcel Flow needs camera access to take the proof photo."
            tone="warning"
          />
          <Button
            label="Open settings"
            onPress={() => void Linking.openSettings()}
            variant="secondary"
          />
        </View>
      ) : null}
      <Button label="Take photo" onPress={onTake} />
    </>
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
  address: {
    ...typography.bodyMd,
    color: colors.ink,
  },
  collect: {
    alignItems: "center",
    gap: spacing.xxs,
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  collectLabel: {
    ...typography.micro,
    color: colors.inkMute,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  collectAmount: {
    ...typography.headingLg,
    color: colors.ink,
    fontWeight: "700",
  },
  photoSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.inkMute,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  preparing: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  preview: {
    aspectRatio: 3 / 4,
    width: "100%",
    backgroundColor: colors.hairline,
    borderRadius: radii.lg,
  },
  denied: {
    gap: spacing.sm,
  },
  link: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  muted: {
    ...typography.caption,
    color: colors.inkMute,
  },
});

import type { MobileRiderParcelListItemDto } from "@parcel-flow/contract";
import { Alert } from "react-native";

/**
 * Asks before marking a return complete: the app can't undo it, and it charges
 * the merchant the delivery fee.
 */
export function confirmReturn(
  parcel: Pick<MobileRiderParcelListItemDto, "parcelCode" | "merchantName">,
  onConfirm: () => void,
) {
  Alert.alert(
    `Mark ${parcel.parcelCode} returned?`,
    `Do this after you hand the parcel to ${parcel.merchantName}. It can't be undone in the app.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Mark returned", onPress: onConfirm },
    ],
  );
}

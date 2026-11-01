import { useEffect } from "react";
import { AppState } from "react-native";

import { riderParcelQueryKey } from "@/api/parcels";
import { queryClient } from "@/api/query-client";
import { signOutRider } from "@/auth/session";
import { createParcelEventsConnection } from "@/realtime/parcel-events-connection";

/**
 * Keeps the rider's parcel queries live while the app is in the foreground.
 * The stream only names changed parcels; they refetch through the usual
 * endpoints. In the background the stream is closed, and the focus refetch
 * catches up when the app returns.
 */
export function useRiderParcelEvents() {
  useEffect(() => {
    const connection = createParcelEventsConnection({
      onChanged: (parcelIds) => {
        void queryClient.invalidateQueries({ queryKey: ["rider-parcels"] });

        for (const parcelId of parcelIds) {
          void queryClient.invalidateQueries({ queryKey: riderParcelQueryKey(parcelId) });
        }
      },
      onReconnected: () => void queryClient.invalidateQueries({ queryKey: ["rider-parcels"] }),
      onUnauthorized: () => void signOutRider(),
    });

    if (AppState.currentState === "active") {
      connection.start();
    }

    // iOS passes through "inactive" for a moment (e.g. the notification shade),
    // so only a real move to the background closes the stream.
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        connection.start();
      } else if (status === "background") {
        connection.stop();
      }
    });

    return () => {
      subscription.remove();
      connection.stop();
    };
  }, []);
}

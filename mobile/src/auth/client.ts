import { expoClient } from "@better-auth/expo/client";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { apiUrl } from "@/config";

// The root layout shows a configuration error before anything uses this client
// when the API URL is missing, so the empty fallback is never requested.
export const authClient = createAuthClient({
  baseURL: apiUrl ?? "",
  plugins: [
    expoClient({
      scheme: "parcelflow",
      storagePrefix: "parcelflow",
      storage: SecureStore,
    }),
    usernameClient(),
  ],
});

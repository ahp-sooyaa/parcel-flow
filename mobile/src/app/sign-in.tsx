import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { authClient } from "@/auth/client";
import { signInRider } from "@/auth/sign-in";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { colors, spacing, typography } from "@/theme/tokens";

export default function SignInScreen() {
  const { data: session, isPending } = authClient.useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Hold the redirect while signing in: the session exists before `/me` has
  // confirmed the account is a rider.
  if (session && !submitting) {
    return <Redirect href="/" />;
  }

  if (isPending && !submitting) {
    return <LoadingScreen />;
  }

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await signInRider(username, password);

    if (!result.ok) {
      setError(result.message);
      setPassword("");
    }

    setSubmitting(false);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Parcel Flow</Text>
        <Text style={styles.subtitle}>Sign in with the rider account the office gave you.</Text>
      </View>

      {error ? <Notice message={error} /> : null}

      <TextField
        autoComplete="username"
        editable={!submitting}
        label="Username"
        onChangeText={setUsername}
        textContentType="username"
        value={username}
      />
      <TextField
        autoComplete="current-password"
        editable={!submitting}
        label="Password"
        onChangeText={setPassword}
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
        secureTextEntry
        textContentType="password"
        value={password}
      />

      <Button busy={submitting} label="Sign in" onPress={handleSubmit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginTop: spacing.huge,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.displayMd,
    color: colors.primary,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.inkMute,
  },
});

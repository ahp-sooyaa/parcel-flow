"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AuthActionResult } from "./dto";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signInAction(
  _prevState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please provide a valid email and password.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAuditEvent({
      event: "auth.sign_in_failed",
    });

    return {
      ok: false,
      message: "Unable to sign in with those credentials.",
    };
  }

  await logAuditEvent({
    event: "auth.sign_in_success",
  });

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  await logAuditEvent({ event: "auth.sign_out" });

  redirect("/sign-in");
}

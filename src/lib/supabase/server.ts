import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
    const env = getSupabasePublicEnv();
    const cookieStore = await cookies();

    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookieValues) {
                    for (const cookie of cookieValues) {
                        cookieStore.set(cookie.name, cookie.value, cookie.options);
                    }
                },
            },
        },
    );
}

import { createHash, timingSafeEqual } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { DemoResetRefusedError, resetDemoData } from "@/features/demo/server/reset";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { isDemoMode } from "@/lib/demo";

function isAuthorized(request: Request) {
  const expectedToken = process.env.DEMO_RESET_TOKEN?.trim();
  const header = request.headers.get("authorization") ?? "";
  const providedToken = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!expectedToken || !providedToken) {
    return false;
  }

  // Hash both sides so the comparison is constant-time regardless of length.
  const expected = createHash("sha256").update(expectedToken).digest();
  const provided = createHash("sha256").update(providedToken).digest();

  return timingSafeEqual(expected, provided);
}

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const summary = await resetDemoData();

    for (const tag of Object.values(CACHE_TAGS)) {
      revalidateTag(tag, { expire: 0 });
    }
    revalidatePath("/", "layout");

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...summary,
    });
  } catch (error) {
    if (error instanceof DemoResetRefusedError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
    }

    Sentry.captureException(error);
    return NextResponse.json({ ok: false, message: "Demo reset failed." }, { status: 500 });
  }
}

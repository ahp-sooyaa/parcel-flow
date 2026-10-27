import { createHash, timingSafeEqual } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath, revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";

import { assertSafeToResetDemo, resetDemoData } from "@/features/demo/server/reset";
import { DemoResetRefusedError } from "@/features/demo/server/safety";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { isDemoMode } from "@/lib/demo";

let resetInProgress = false;

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

  if (resetInProgress) {
    return NextResponse.json(
      { ok: false, message: "A reset is already running." },
      { status: 409 },
    );
  }

  try {
    // Refuse up front so the caller sees a 409 instead of a silent background failure.
    await assertSafeToResetDemo();
  } catch (error) {
    if (error instanceof DemoResetRefusedError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
    }

    Sentry.captureException(error);
    return NextResponse.json({ ok: false, message: "Demo reset failed." }, { status: 500 });
  }

  // The database can be in another region, so reply now and finish in the
  // background rather than hold the scheduler's request open.
  resetInProgress = true;
  after(async () => {
    const startedAt = Date.now();

    try {
      const summary = await resetDemoData();

      for (const tag of Object.values(CACHE_TAGS)) {
        revalidateTag(tag, { expire: 0 });
      }
      revalidatePath("/", "layout");

      console.log(
        `Demo reset finished in ${Math.round((Date.now() - startedAt) / 1000)}s: ${summary.parcels} parcels, ${summary.settlements} settlements, ${summary.riderPayouts} rider payouts.`,
      );
    } catch (error) {
      Sentry.captureException(error);
      console.error("Demo reset failed.", error);
    } finally {
      resetInProgress = false;
    }
  });

  return NextResponse.json({ ok: true, message: "Demo reset started." }, { status: 202 });
}

import { NextResponse } from "next/server";

import type { MobileErrorResponse, MobileSuccessResponse } from "@/features/mobile-api/contract";

export function mobileOk<TData>(data: TData, message = "OK") {
  return NextResponse.json<MobileSuccessResponse<TData>>({ ok: true, message, data });
}

export function mobileError(status: number, message: string) {
  return NextResponse.json<MobileErrorResponse>({ ok: false, message }, { status });
}

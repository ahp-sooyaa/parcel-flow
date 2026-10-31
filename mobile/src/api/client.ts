import {
  MOBILE_API_BASE_PATH,
  mobileErrorResponseSchema,
  type MobileSuccessResponse,
} from "@parcel-flow/contract";
import type { z } from "zod";

import { authClient } from "@/auth/client";
import { signOutRider } from "@/auth/session";
import { apiUrl } from "@/config";

export const NETWORK_ERROR_MESSAGE = "Can't reach Parcel Flow. Check your connection.";
const UNEXPECTED_RESPONSE_MESSAGE = "Unexpected response from Parcel Flow. Try again.";

export class MobileApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

/**
 * GETs a `/api/mobile/v1` path with the rider's session and returns the
 * response `data`, checked against the shared contract schema. Throws
 * `MobileApiError` (status 0 for network failures) and signs the rider out on 401.
 */
export function apiGet<TData>(
  path: string,
  schema: z.ZodType<MobileSuccessResponse<TData>>,
): Promise<TData> {
  return request(path, schema);
}

/** POSTs `body` as JSON to a `/api/mobile/v1` path. Same errors and sign-out as `apiGet`. */
export function apiPost<TData>(
  path: string,
  body: unknown,
  schema: z.ZodType<MobileSuccessResponse<TData>>,
): Promise<TData> {
  return request(path, schema, { method: "POST", body: JSON.stringify(body) });
}

async function request<TData>(
  path: string,
  schema: z.ZodType<MobileSuccessResponse<TData>>,
  write?: { method: "POST"; body: string },
): Promise<TData> {
  let response: Response;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Cookie: authClient.getCookie(),
  };

  try {
    response = await fetch(`${apiUrl}${MOBILE_API_BASE_PATH}${path}`, {
      ...(write && { method: write.method, body: write.body }),
      headers: write ? { ...headers, "Content-Type": "application/json" } : headers,
      // The session travels in the Cookie header above, not the platform cookie jar.
      credentials: "omit",
    });
  } catch {
    throw new MobileApiError(0, NETWORK_ERROR_MESSAGE);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      await signOutRider();
    }

    const error = mobileErrorResponseSchema.safeParse(body);
    throw new MobileApiError(
      response.status,
      error.success ? error.data.message : UNEXPECTED_RESPONSE_MESSAGE,
    );
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new MobileApiError(response.status, UNEXPECTED_RESPONSE_MESSAGE);
  }

  return result.data.data;
}

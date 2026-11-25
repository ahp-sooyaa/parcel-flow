export type ParcelOperationErrorCode = "forbidden" | "not_found" | "not_assigned" | "conflict";

/**
 * A parcel write rejected by a business rule, as opposed to an unexpected
 * failure. The message is safe to show the user; `code` lets the mobile API
 * pick an HTTP status without matching on message text.
 */
export class ParcelOperationError extends Error {
  constructor(
    readonly code: ParcelOperationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ParcelOperationError";
  }
}

import { z } from "zod";

function toDefinedTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function optionalNullableTrimmedString(maxLength: number) {
  return z
    .preprocess(toDefinedTrimmedString, z.string().trim().max(maxLength).optional())
    .transform((value) => value ?? null);
}

export function optionalNullableUuid() {
  return z
    .preprocess(toDefinedTrimmedString, z.string().trim().uuid().optional())
    .transform((value) => value ?? null);
}

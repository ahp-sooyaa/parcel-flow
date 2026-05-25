import type { ZodError } from "zod";

import type { FormFieldErrors } from "@/components/shared/form-fields";

export function getFormFieldErrors(error: ZodError): FormFieldErrors {
  const fieldErrors: FormFieldErrors = {};

  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");

    if (!path || fieldErrors[path]) {
      continue;
    }

    fieldErrors[path] = issue.message;
  }

  return fieldErrors;
}

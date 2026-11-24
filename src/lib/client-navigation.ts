"use client";

import { useRouter } from "next/navigation";

// A wrapper, not `export { useRouter as useAppRouter }`: Bun's mock.module
// patches a re-exported binding in place, so tests that mock this module would
// also replace next/navigation's useRouter for every later test file.
export function useAppRouter() {
  return useRouter();
}

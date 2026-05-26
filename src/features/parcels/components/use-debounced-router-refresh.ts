"use client";

import { startTransition, useEffect, useEffectEvent, useRef } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function useDebouncedRouterRefresh(router: AppRouterInstance, delayMs = 200) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useEffectEvent(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      startTransition(() => {
        router.refresh();
      });
    }, delayMs);
  });

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return refresh;
}

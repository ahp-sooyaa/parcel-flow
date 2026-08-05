import { afterEach, expect, mock } from "bun:test";

import * as matchers from "@testing-library/jest-dom/matchers";
import { Window } from "happy-dom";

expect.extend(matchers);

// Next.js Cache Components APIs require a Next request/work-unit store.
// Bun unit/integration tests call cached DAL/session helpers directly, so
// provide no-ops that keep business logic testable without the runtime.
function mockNextCacheModule() {
  void mock.module("next/cache", () => ({
    cacheLife: () => undefined,
    cacheTag: () => undefined,
    revalidatePath: () => undefined,
    revalidateTag: () => undefined,
    updateTag: () => undefined,
    unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    unstable_noStore: () => undefined,
  }));
}

mockNextCacheModule();

const window = new Window({
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
const animationFrameHandles = new Map<number, ReturnType<typeof window.setTimeout>>();
let nextAnimationFrameHandle = 1;

Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Element: window.Element,
  SVGElement: window.SVGElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLFormElement: window.HTMLFormElement,
  HTMLSelectElement: window.HTMLSelectElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  PointerEvent: window.PointerEvent,
  MutationObserver: window.MutationObserver,
  ResizeObserver: window.ResizeObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    const handle = nextAnimationFrameHandle;
    nextAnimationFrameHandle += 1;
    animationFrameHandles.set(
      handle,
      window.setTimeout(() => callback(Date.now()), 16),
    );
    return handle;
  },
  cancelAnimationFrame: (handle: number) => {
    const timeout = animationFrameHandles.get(handle);

    if (timeout) {
      window.clearTimeout(timeout);
      animationFrameHandles.delete(handle);
    }
  },
});
window.SyntaxError = SyntaxError;

const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  mock.restore();
  cleanup();
  window.document.body.innerHTML = "";
  for (const attribute of Array.from(window.document.body.attributes)) {
    window.document.body.removeAttribute(attribute.name);
  }
});

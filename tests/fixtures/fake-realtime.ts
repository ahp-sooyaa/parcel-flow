// A stand-in for the Supabase realtime client used by the parcel streams:
// tests drive channel status and row changes by hand, then read the SSE
// frames the stream wrote.
import { mock } from "bun:test";

import type { ParcelRealtimeRow } from "@/features/parcels/server/realtime";

type ChangeHandler = (payload: { new: unknown; old: unknown }) => void;
type StatusHandler = (status: string, error?: Error) => void;

const ignore = () => undefined;

export type FakeChannel = {
  name: string;
  /** Simulates a `postgres_changes` event on `public.parcels`. */
  emitChange: (change: { new?: unknown; old?: unknown }) => void;
  /** Simulates a subscribe status such as `SUBSCRIBED` or `CLOSED`. */
  setStatus: (status: string, error?: Error) => void;
};

/** Replaces `@/lib/supabase/server`'s admin client, keeping its other exports. */
export async function mockSupabaseRealtime() {
  const channels: FakeChannel[] = [];
  const removeChannel = mock(() => Promise.resolve("ok"));
  const actualSupabaseServer = await import("@/lib/supabase/server");

  void mock.module("@/lib/supabase/server", () => ({
    ...actualSupabaseServer,
    getSupabaseAdminClient: () => ({
      channel: (name: string) => {
        let onChange: ChangeHandler = ignore;
        let onStatus: StatusHandler = ignore;
        const fake: FakeChannel = {
          name,
          emitChange: (change) => onChange({ new: change.new ?? {}, old: change.old ?? {} }),
          setStatus: (status, error) => onStatus(status, error),
        };
        channels.push(fake);

        const channel = {
          on: (_type: string, _filter: unknown, handler: ChangeHandler) => {
            onChange = handler;
            return channel;
          },
          subscribe: (handler: StatusHandler) => {
            onStatus = handler;
            return channel;
          },
        };
        return channel;
      },
      removeChannel,
    }),
  }));

  return {
    channels,
    removeChannel,
    reset() {
      channels.length = 0;
      removeChannel.mockClear();
    },
  };
}

/** A database row as Supabase sends it, for `FakeChannel.emitChange`. */
export function parcelRecord(overrides: Partial<ParcelRealtimeRow> = {}) {
  return {
    id: "0f7a3c2e-2222-4b1c-8d9e-000000000002",
    merchant_id: "merchant-1",
    rider_id: "rider-1",
    status: "on_the_way",
    cod_amount: 20_000,
    delivery_fee: 3_000,
    parcel_type: "cod",
    is_received_by_office: true,
    deleted_at: null,
    ...overrides,
  };
}

const decoder = new TextDecoder();

/** Reads SSE frames from a stream response, one chunk at a time. */
export function streamReader(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("The response has no body to read.");
  }

  return {
    /** The next chunk as text; each frame the server writes is one chunk. */
    async next() {
      const { value, done } = await reader.read();
      return done ? null : decoder.decode(value);
    },
    cancel: () => reader.cancel(),
  };
}

/** Lets pending promise callbacks (such as an async `toEvent`) run. */
export function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

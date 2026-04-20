import "server-only";

type AuditEvent = {
    event: string;
    actorAppUserId?: string;
    targetAppUserId?: string;
    metadata?: Record<string, string | number | boolean | null | undefined>;
};

export async function logAuditEvent(payload: AuditEvent) {
    const eventPayload = {
        ...payload,
        timestamp: new Date().toISOString(),
    };

    // Centralized audit sink for v1. Replace with persistent log storage in a future change.
    // eslint-disable-next-line no-console
    console.info("[audit-event]", JSON.stringify(eventPayload));
}

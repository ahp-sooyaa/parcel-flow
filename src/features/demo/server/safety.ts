export class DemoResetRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoResetRefusedError";
  }
}

/**
 * Throws unless this database is safe to wipe: demo mode must be on, and every
 * non-super-admin account must be one the demo seed created. Anything else
 * means real people may be using this database.
 */
export function assertDemoResetIsSafe(input: {
  demoMode: boolean;
  force?: boolean;
  existingUsernames?: string[];
  seededUsernames: Set<string>;
}) {
  if (!input.demoMode) {
    throw new DemoResetRefusedError("Refusing to reset: NEXT_PUBLIC_DEMO_MODE is not enabled.");
  }

  if (input.force) {
    return;
  }

  const unknownUsernames = (input.existingUsernames ?? []).filter(
    (username) => !input.seededUsernames.has(username),
  );

  if (unknownUsernames.length > 0) {
    throw new DemoResetRefusedError(
      `Refusing to reset: found ${unknownUsernames.length} account(s) the demo seed did not create (${unknownUsernames.slice(0, 5).join(", ")}). Pass --force if this database really is the demo.`,
    );
  }
}

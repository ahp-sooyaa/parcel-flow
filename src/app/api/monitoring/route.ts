// Forwards the browser's Sentry envelopes to Sentry from our own origin, so ad
// blockers don't drop error reports and the CSP can stay at `connect-src 'self'`.
// It replaces @sentry/nextjs's `tunnelRoute` rewrite: Next.js proxies a rewrite
// by piping the upstream response, which adds an 11th `close` listener to each
// response and logs MaxListenersExceededWarning for every report.

const NEWLINE = 0x0a;

/** The project this app reports to, from the same DSN the browser uses. */
function configuredProject() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return null;
  }

  try {
    const url = new URL(dsn);
    return { host: url.host, projectId: url.pathname.replace(/^\//, "") };
  } catch {
    return null;
  }
}

/** The DSN named in an envelope's first line (its JSON header). */
function envelopeDsnUrl(envelope: Uint8Array) {
  const end = envelope.indexOf(NEWLINE);
  const headerText = new TextDecoder().decode(end === -1 ? envelope : envelope.subarray(0, end));

  try {
    const header: unknown = JSON.parse(headerText);
    const dsn =
      typeof header === "object" && header !== null ? (header as { dsn?: unknown }).dsn : null;
    return typeof dsn === "string" ? new URL(dsn) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const project = configuredProject();

  if (!project) {
    return new Response(null, { status: 404 });
  }

  const envelope = new Uint8Array(await request.arrayBuffer());
  const dsn = envelopeDsnUrl(envelope);

  // Only our own project: the route must not become an open proxy to any DSN.
  if (dsn?.host !== project.host || dsn.pathname.replace(/^\//, "") !== project.projectId) {
    return new Response(null, { status: 400 });
  }

  try {
    const upstream = await fetch(`https://${project.host}/api/${project.projectId}/envelope/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: envelope,
    });

    return new Response(null, { status: upstream.status });
  } catch {
    // Reporting is best effort; the browser SDK drops the envelope on failure.
    return new Response(null, { status: 502 });
  }
}

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';

function addLoopbackPeer(origin: string, out: Set<string>) {
  try {
    const url = new URL(origin);
    const peerHost = url.hostname === 'localhost'
      ? '127.0.0.1'
      : url.hostname === '127.0.0.1'
        ? 'localhost'
        : null;
    if (!peerHost) return;
    out.add(`${url.protocol}//${peerHost}${url.port ? `:${url.port}` : ''}`);
  } catch {
    // Keep the original value for Nest/CORS to handle; do not broaden invalid input.
  }
}

export function resolveCorsOrigins(frontendUrl: string | undefined): string[] {
  const configured = String(frontendUrl || DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = new Set(configured.length ? configured : [DEFAULT_FRONTEND_ORIGIN]);
  for (const origin of Array.from(origins)) addLoopbackPeer(origin, origins);
  return Array.from(origins);
}
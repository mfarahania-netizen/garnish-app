/**
 * P0-7 (recsys audit): parse an outbox event's JSON payload DEFENSIVELY. The outbox is at-least-once and may
 * carry a malformed or legacy payload; an unguarded JSON.parse that throws fails the processor → the outbox
 * retries / dead-letters → the user's later signals stall. This never throws: returns {} on any failure.
 */
export function safeJsonPayload(event: any): Record<string, any> {
  try {
    const parsed = JSON.parse(event?.payload || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

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

/**
 * P0-6 (recsys audit): a lightweight, no-migration idempotency guard. The outbox is at-least-once, so a
 * redelivery (route succeeded but the done-mark failed, or a stuck-'processing' row was revived) would
 * RE-APPLY additive feedback + duplicate observations, skewing the profile. Every processor writes at least
 * one SignalObservation stamped with this event's id, so the existence of one means the event was already
 * consumed → skip the whole re-process. On a query error we DON'T block (returns false) — preserving the
 * at-least-once promise (a rare double is better than a dropped signal). True exactly-once (a unique key on the
 * derived rows + an eventId on the attribution table) stays an L1 migration, per event-outbox.service.ts.
 */
export async function alreadyConsumed(prisma: any, eventId: string): Promise<boolean> {
  // defensive: a missing eventId or a prisma without the method → treat as not-consumed (process).
  if (!eventId || typeof prisma?.signalObservation?.findFirst !== 'function') return false;
  const existing = await prisma.signalObservation.findFirst({ where: { eventId }, select: { id: true } }).catch(() => null);
  return !!existing;
}

// Canonical ticket vocabulary — the single source of truth, validated at every write boundary (user + admin).
// (The old schema had a `priority` column that was never used and an unvalidated `status` that accepted any string.)
export const TICKET_STATUSES = ['open', 'pending', 'in_progress', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const TICKET_CATEGORIES = ['general', 'account', 'technical', 'billing', 'feature', 'content'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const isStatus = (s: unknown): s is TicketStatus => TICKET_STATUSES.includes(s as TicketStatus);
export const isPriority = (s: unknown): s is TicketPriority => TICKET_PRIORITIES.includes(s as TicketPriority);
export const isCategory = (s: unknown): s is TicketCategory => TICKET_CATEGORIES.includes(s as TicketCategory);

// Statuses that count as "done": set resolvedAt + drop out of the active queue.
export const CLOSED_STATUSES: TicketStatus[] = ['resolved', 'closed'];

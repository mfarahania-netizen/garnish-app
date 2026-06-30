// PII masking for admin list/detail views (advisor audit P0-5). Lists + dossiers are masked BY DEFAULT so a
// compromised admin session can't bulk-scrape phone/email; the real value is fetched one user at a time only via
// the audited, reason-gated GET /admin/users/:id/reveal. The mask keeps a recognizable shape (last 4 of a phone,
// first char + domain of an email) so the operator can still disambiguate without seeing the full value.
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return phone ?? null;
  const s = String(phone);
  // P2-1: short numbers can't keep first-3 + last-4 without the slices overlapping → fully mask them.
  if (s.length <= 7) return '•'.repeat(s.length);
  return s.slice(0, 3) + '•'.repeat(s.length - 7) + s.slice(-4);
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return email ?? null;
  const [user, domain] = String(email).split('@');
  if (!domain) return '•••';
  return (user?.[0] ?? '•') + '•••@' + domain;
}

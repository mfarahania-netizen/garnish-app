import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ChatRateLimitService — the free-tier message budget (Iran launch is FREE; cost/abuse is controlled by per-user
 * message limits, not a paid plan). Three SLIDING windows (5-hour / daily / weekly). Counts the user's own prior
 * chat turns from the ALREADY-persisted ChatMessage rows (role='user') — no new storage. Limits are env-configurable
 * so we can tune from real usage without a deploy. Generous by design (a normal cook never hits them; only abuse does).
 */

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

interface Window { key: '5h' | 'day' | 'week'; ms: number; limit: number; label: string }

export interface RateLimitVerdict {
  allowed: boolean;
  window?: '5h' | 'day' | 'week';
  resetAt?: Date;
  message?: string;
}

@Injectable()
export class ChatRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  private windows(): Window[] {
    return [
      { key: '5h', ms: 5 * 3_600_000, limit: num(process.env.AI_LIMIT_5H, 30), label: 'این چند ساعت' },
      { key: 'day', ms: 24 * 3_600_000, limit: num(process.env.AI_LIMIT_DAY, 50), label: 'امروز' },
      { key: 'week', ms: 7 * 24 * 3_600_000, limit: num(process.env.AI_LIMIT_WEEK, 250), label: 'این هفته' },
    ];
  }

  /**
   * Check the user against all three windows. Returns the FIRST exceeded window (shortest first) with a kind
   * Persian message + an approximate reset time (when the oldest in-window turn ages out → a slot frees). The
   * caller blocks the turn WITHOUT calling the model. Fail-OPEN: a counting error never denies a paying-nothing
   * user their chat (the limit is a guardrail, not a safety gate).
   */
  async check(userId: string, now: Date = new Date()): Promise<RateLimitVerdict> {
    try {
      for (const w of this.windows()) {
        const since = new Date(now.getTime() - w.ms);
        const count = await this.prisma.chatMessage.count({ where: { userId, role: 'user', createdAt: { gte: since } } });
        if (count >= w.limit) {
          const oldest = await this.prisma.chatMessage.findFirst({
            where: { userId, role: 'user', createdAt: { gte: since } },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          });
          const resetAt = new Date((oldest?.createdAt.getTime() ?? now.getTime()) + w.ms);
          return { allowed: false, window: w.key, resetAt, message: this.message(w.label, resetAt, now) };
        }
      }
      return { allowed: true };
    } catch {
      return { allowed: true }; // fail-open — never block on a counting error
    }
  }

  private message(label: string, resetAt: Date, now: Date): string {
    const mins = Math.max(1, Math.round((resetAt.getTime() - now.getTime()) / 60_000));
    const when = mins >= 90 ? `حدودِ ${Math.round(mins / 60)} ساعتِ دیگه` : `حدودِ ${mins} دقیقهٔ دیگه`;
    return `به سقفِ پیام‌های ${label} رسیدی 🙏 ${when} دوباره می‌تونی بپرسی. (نسخهٔ رایگان روزانه/هفتگی محدودیتِ پیام داره.)`;
  }
}

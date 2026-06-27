import { Injectable, Logger } from '@nestjs/common';
import { BriefingService } from '../../briefing/briefing.service';

export interface ChatOpener {
  greeting: string;
  /** ONE tappable proactive suggestion: `text` is shown, `prompt` is sent to the assistant on tap. null = just greet. */
  suggestion: { text: string; prompt: string } | null;
}

/**
 * ChatOpenerService (proactive intelligence — chat surface). When the user OPENS the assistant, instead of a static
 * prompt we greet them (time-aware) and surface ONE data-grounded suggestion as a tappable CTA — so the assistant
 * feels alive and "knows you" the instant it opens.
 *
 * REUSE, not a parallel engine: the signal comes from BriefingService.getProactiveNudge — the SAME honest,
 * consent-respecting nudge the daily briefing uses. We only surface nudges the CHAT can actually act on
 * (complete the week's plan; cook a saved-but-untried recipe). Non-fatal: any failure degrades to a plain
 * greeting and never blocks the chat.
 */
@Injectable()
export class ChatOpenerService {
  private readonly logger = new Logger(ChatOpenerService.name);

  constructor(private readonly briefing: BriefingService) {}

  async getOpener(userId: string, now: Date = new Date()): Promise<ChatOpener> {
    const greeting = this.greetingFor(now);
    try {
      const nudge = await this.briefing.getProactiveNudge(userId, now);
      return { greeting, suggestion: this.toSuggestion(nudge) };
    } catch (e) {
      this.logger.warn(`opener nudge unavailable: ${e instanceof Error ? e.name : 'error'}`);
      return { greeting, suggestion: null };
    }
  }

  /** A warm, time-of-day greeting. */
  private greetingFor(now: Date): string {
    const h = now.getHours();
    if (h >= 5 && h < 12) return 'صبح بخیر! ☀️';
    if (h >= 12 && h < 17) return 'سلام، ظهرت بخیر! 🍽️';
    if (h >= 17 && h < 22) return 'سلام، عصرت بخیر! 🌆';
    return 'سلام! 🌙';
  }

  /** Map a briefing nudge to a tappable opener suggestion — only the chat-actionable kinds; else null. */
  private toSuggestion(nudge: { kind: string | null; reason: string; data?: any }): ChatOpener['suggestion'] {
    if (!nudge?.kind) return null;
    if (nudge.kind === 'plan_gap') {
      return { text: nudge.reason, prompt: 'برنامهٔ غذایی این هفته‌ام رو کامل کن' };
    }
    if (nudge.kind === 'saved_not_cooked') {
      const title = nudge.data?.title;
      return { text: nudge.reason, prompt: title ? `دستورِ کاملِ «${title}» رو بده` : 'همون رسپیِ ذخیره‌شده رو نشونم بده' };
    }
    // 'shopping' and any future kind: no clean chat action yet → just greet (the daily briefing still surfaces it).
    return null;
  }
}

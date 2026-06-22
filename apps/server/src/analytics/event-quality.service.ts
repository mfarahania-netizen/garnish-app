// apps/server/src/analytics/event-quality.service.ts
import { Injectable } from '@nestjs/common';

const BASE_CONFIDENCE_MAP: Record<string, number> = {
  favorite_add: 1.0,
  favorite_remove: 1.0,
  mealplan_generate: 1.0,
  shopping_item_add: 1.0,
  shopping_item_toggle: 1.0,
  search_query: 1.0,
  recommendation_save: 1.0,
  recommendation_dismiss: 1.0,
  ai_chat_started: 1.0,
  ai_message_send: 1.0,
  cook_complete: 1.0, // the canonical completion signal — a deliberate, high-value user action
  mealplan_add: 0.9,
  recommendation_click: 0.9,
  recipe_view: 0.7,
  recommendation_ignore: 0.8,
  recommendation_cook: 0.6,
  recommendation_impression: 0.9,
  // رویدادهای ناوبری و نمایش که تکراری بودنشان طبیعی است
  page_view: 0.9,
  category_view: 0.9,
  category_click: 0.9,
};

/**
 * DELIBERATE_SIGNALS — high-value, USER-INITIATED events that must ALWAYS be recorded; the bot/duplicate
 * heuristic is BYPASSED for them.
 *
 * The bug this fixes: `calcBotProbability` keys its high-frequency counter on `bot:<userId>` ALONE —
 * shared across every event type. A heavy `recipe_view` / `recommendation_impression` burst (now common
 * since impressions fire on scroll/open) poisons that counter, so a real `cook_complete` fired right after
 * is rejected as "bot" → no UserEvent is written → gamification counts 0 cooks and the behavior engine is
 * starved of the favorite/mealplan/cook signals. The gate had it backwards: high-frequency NOISE was
 * exempt while high-value DELIBERATE signals were not. These are low-frequency, deliberate judgments and
 * must never be dropped.
 *
 * Membership is a strict subset of the behavior engine's POSITIVE_EVENTS / EXPLICIT_FEEDBACK_EVENTS
 * (signal-observation-engine.ts) — no invented type strings. (The brief also named `favorite_remove` and
 * `mealplan_remove`; those are NOT in POSITIVE_EVENTS/EXPLICIT_FEEDBACK_EVENTS — `favorite_remove` is not a
 * tracked type at all and `mealplan_remove` is a NEGATIVE_EVENT — so per the "do not invent types" rule
 * they are intentionally excluded.)
 */
const DELIBERATE_SIGNALS = new Set<string>([
  'cook_complete',
  'favorite_add',
  'mealplan_add',
  'recommendation_save',
  'recommendation_cook',
  'shopping_item_add',
  'ai_message_send',
  'onboarding_answered',
  'preference_update',
  // P0 signal capture — the strongest, lowest-frequency TASTE signals; must never be dropped by the shared
  // bot counter after a scroll/impression burst (the exact poisoning this bypass exists to prevent).
  'ingredient_swapped',
  'portion_scaled',
  'ingredient_removed',
]);

/** Narrow accidental-double-fire window for deliberate signals (e.g. a double-tap on «پایان»). */
const DELIBERATE_DEDUP_MS = 2000;

export interface QualityResult {
  isValid: boolean;
  confidence: number;
  reason?: string;
  evidence?: {
    duplicateCheck: boolean;
    botProbability: number;
    baseConfidence: number;
  };
}

@Injectable()
export class EventQualityService {
  private readonly interactionMap = new Map<string, number[]>();

  assess(event: { userId: string; type: string; payload?: any }): QualityResult {
    // DELIBERATE SIGNALS FIRST: high-value, user-initiated events are ALWAYS accepted — the bot/duplicate
    // heuristic is bypassed entirely (a real cook must never be dropped because the user was scrolling
    // first). The only guard kept is a very narrow exact-duplicate check (same user+type+payload, strictly
    // under 2s) to absorb an accidental double-click; it is independent of the high-frequency counter.
    if (DELIBERATE_SIGNALS.has(event.type)) {
      const baseConfidence = BASE_CONFIDENCE_MAP[event.type] ?? 1.0;
      if (this.isAccidentalDoubleFire(event)) {
        return {
          isValid: false,
          confidence: 0,
          reason: 'duplicate',
          evidence: { duplicateCheck: true, botProbability: 0, baseConfidence },
        };
      }
      return {
        isValid: true,
        confidence: baseConfidence,
        evidence: { duplicateCheck: false, botProbability: 0, baseConfidence },
      };
    }

    // رویدادهایی که ذاتاً تکراری بودن در آنها طبیعی است (نمایش صفحه، بازدیدها، کلیک روی دسته‌بندی)
    const nonDuplicateEvents = [
      'page_view',
      'recommendation_impression',
      'recipe_view',
      'category_view',
      'category_click',
    ];

    if (nonDuplicateEvents.includes(event.type)) {
      const botProbability = this.calcBotProbability(event);
      const baseConfidence = BASE_CONFIDENCE_MAP[event.type] ?? 0.9;
      const finalConfidence = Math.round((baseConfidence * (1 - botProbability)) * 100) / 100;
      const isValid = botProbability <= 0.8 && finalConfidence >= 0.2;
      return {
        isValid,
        confidence: finalConfidence,
        reason: isValid ? undefined : 'bot',
        evidence: {
          duplicateCheck: false,
          botProbability,
          baseConfidence,
        },
      };
    }

    // بقیه رویدادها: بررسی تکراری بودن
    const duplicateCheck = this.checkDuplicate(event);
    if (!duplicateCheck) {
      return {
        isValid: false,
        confidence: 0,
        reason: 'duplicate',
        evidence: { duplicateCheck: true, botProbability: 0, baseConfidence: 0 },
      };
    }

    const botProbability = this.calcBotProbability(event);
    if (botProbability > 0.8) {
      return {
        isValid: false,
        confidence: 0.1,
        reason: 'bot',
        evidence: { duplicateCheck: false, botProbability, baseConfidence: 0 },
      };
    }

    const baseConfidence = BASE_CONFIDENCE_MAP[event.type] ?? 0.8;
    const finalConfidence = Math.round((baseConfidence * (1 - botProbability)) * 100) / 100;

    return {
      isValid: true,
      confidence: finalConfidence,
      evidence: { duplicateCheck: false, botProbability, baseConfidence },
    };
  }

  /**
   * Whole-payload fingerprint for dedup keys — a djb2 hash over the FULL serialized payload, NOT a 50-char
   * prefix. The prefix form collided when recipeId is a 36-char UUID (the prefix ended inside recipeId, before
   * the differentiating field), silently collapsing two distinct deliberate actions on the same recipe. The
   * hash discriminates the entire payload while keeping the key short.
   */
  private payloadFingerprint(payload: unknown): string {
    const s = JSON.stringify(payload || {});
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /**
   * Accidental double-fire guard for DELIBERATE signals only: true iff the SAME (userId, type, payload)
   * was seen strictly within the last DELIBERATE_DEDUP_MS (< 2000ms). Uses a dedicated `ddup:` key so it
   * never touches the bot:/dup: high-frequency counters — two DISTINCT deliberate actions (different
   * payload, e.g. cooking two different recipes) are never collapsed, and the same action ≥2s apart is
   * accepted.
   */
  private isAccidentalDoubleFire(event: { userId: string; type: string; payload?: any }): boolean {
    const payloadKey = this.payloadFingerprint(event.payload);
    const key = `ddup:${event.userId}:${event.type}:${payloadKey}`;
    const now = Date.now();
    const last = this.interactionMap.get(key) || [];
    const recent = last.filter((t) => now - t < DELIBERATE_DEDUP_MS);
    if (recent.length > 0) {
      // keep the existing timestamp window; do not extend it on a rejected double-fire
      this.interactionMap.set(key, recent);
      return true;
    }
    this.interactionMap.set(key, [now]);
    return false;
  }

  private checkDuplicate(event: { userId: string; type: string; payload?: any }): boolean {
    const payloadKey = this.payloadFingerprint(event.payload);
    const key = `dup:${event.userId}:${event.type}:${payloadKey}`;
    const now = Date.now();
    const timestamps = this.interactionMap.get(key) || [];
    const recent = timestamps.filter(t => now - t < 60_000);

    if (recent.length > 0 && now - recent[recent.length - 1] < 30_000) {
      return false;
    }

    recent.push(now);
    this.interactionMap.set(key, recent);
    return true;
  }

  private calcBotProbability(event: { userId: string }): number {
    const key = `bot:${event.userId}`;
    const now = Date.now();
    const timestamps = this.interactionMap.get(key) || [];
    const recent = timestamps.filter(t => now - t < 60_000);
    recent.push(now);

    if (recent.length < 2) {
      this.interactionMap.set(key, recent);
      return 0;
    }

    const gaps = recent.slice(1).map((t, i) => t - recent[i]);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    if (recent.length > 20 && avgGap < 3000) {
      this.interactionMap.set(key, recent);
      return 0.9;
    }

    if (recent.length > 50) {
      this.interactionMap.set(key, recent);
      return 0.5;
    }

    this.interactionMap.set(key, recent);
    return 0;
  }

  reset() {
    this.interactionMap.clear();
  }
}

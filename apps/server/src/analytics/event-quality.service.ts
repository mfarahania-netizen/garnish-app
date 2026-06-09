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

  private checkDuplicate(event: { userId: string; type: string; payload?: any }): boolean {
    const payloadKey = JSON.stringify(event.payload || {}).slice(0, 50);
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

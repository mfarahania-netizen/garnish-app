import { Injectable } from '@nestjs/common';
import { GuardResult } from '../ai-core.types';

/**
 * Nutrition Claim Guard (E47-A1) — deterministic, rule-based.
 *
 * Prevents health/medical nutrition CLAIMS when the underlying nutrition data is NOT source-locked.
 * (The current dictionary is quarantined/templated — productionNutritionLock = false — so health
 * claims and exact nutrient numbers must not be asserted to users.)
 *
 * When `nutritionSourceLocked` is true, source-backed statements are allowed through.
 * Runs on model OUTPUT.
 */
@Injectable()
export class NutritionClaimGuardService {
  private readonly healthClaimPatterns: RegExp[] = [
    /\b(lowers?|reduces?|controls?|cures?|prevents?|treats?|heals?)\b.{0,30}\b(cholesterol|blood\s+sugar|diabetes|cancer|disease|blood\s+pressure|weight)\b/i,
    /\b(helps?\s+you\s+)?(lose|burn)\s+(weight|fat)\b/i,
    /\b(boosts?|strengthens?)\s+(your\s+)?(immune\s+system|immunity|metabolism)\b/i,
    /\b(good|great|excellent|perfect|ideal|beneficial|recommended)\s+for\s+(your\s+)?(diabetes|heart|kidney|liver|cholesterol|blood\s+pressure)\b/i,
    /\b(clinically|scientifically)\s+proven\b|\bdoctor[-\s]?recommended\b|\bmedically\s+proven\b/i,
    /(کاهش\s+وزن|کاهش\s+کلسترول|کنترل\s+(قند|دیابت)|تقویت\s+(سیستم\s+ایمنی|متابولیسم)|درمان\s+بیماری)/i,
  ];

  /** exact nutrient-number assertions (e.g. "200 calories", "30 g protein", "150 mg sodium"). */
  private readonly nutritionNumberPattern =
    /\b\d+(\.\d+)?\s*(k?cal|calories?|kilocalories?|grams?|g|mg|milligrams?)\b\s*(of\s+)?(protein|carb(ohydrate)?s?|fat|fiber|sugar|sodium|calories?)?/i;

  inspect(text: string, opts: { nutritionSourceLocked?: boolean } = {}): GuardResult {
    const input = text ?? '';
    if (opts.nutritionSourceLocked === true) {
      return { blocked: false, reasons: [] };
    }
    const reasons: string[] = [];
    if (this.healthClaimPatterns.some((re) => re.test(input))) reasons.push('health_medical_claim_without_source_lock');
    if (this.nutritionNumberPattern.test(input)) reasons.push('exact_nutrition_number_without_source_lock');
    return { blocked: reasons.length > 0, reasons };
  }
}

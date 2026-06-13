import { Injectable } from '@nestjs/common';
import { GuardResult } from '../ai-core.types';

/**
 * AI Safety Guard (E47-A1) — deterministic, rule-based.
 *
 * Blocks out-of-scope/unsafe content categories (Constitution E47 boundaries):
 *  - medical diagnosis / treatment / prescription
 *  - strict / therapeutic / clinical diet planning
 *  - allergy-unsafe "safe to eat" claims
 *  - fake vision / image-recognition claims (the product has NO vision)
 *
 * No model; explicit patterns only. Runs on inbound prompts (and can be reused on outputs).
 */
@Injectable()
export class AiSafetyGuardService {
  private readonly rules: { re: RegExp; category: string }[] = [
    // medical diagnosis / treatment
    { re: /\b(diagnos(e|is|ing)|prescrib(e|ing)|prescription|dosage|dose\s+of|treat(ment)?\s+(for|my)|cure\s+(for|my)|medication\s+for)\b/i, category: 'medical_diagnosis_treatment' },
    { re: /\b(do\s+i\s+have|am\s+i\s+suffering\s+from)\b.{0,40}\b(disease|condition|diabetes|cancer|covid)\b/i, category: 'medical_diagnosis_treatment' },
    { re: /تشخیص\s+(بیماری|پزشکی)|درمان\s+(بیماری|من)|نسخه\s+(دارو|پزشک)|دوز\s+دارو/i, category: 'medical_diagnosis_treatment' },
    // strict / therapeutic / clinical diet planning
    { re: /\b(strict|therapeutic|clinical|medical|keto(genic)?\s+therapy)\s+diet\b/i, category: 'strict_diet_planning' },
    { re: /\bdiet\s+plan\b.{0,30}\b(diabetes|cancer|kidney|renal|cholesterol|medical)\b/i, category: 'strict_diet_planning' },
    { re: /رژیم\s+(درمانی|پزشکی|سختگیرانه|بالینی)/i, category: 'strict_diet_planning' },
    // allergy-unsafe claims
    { re: /\b(safe\s+(to\s+eat|for\s+(you|your\s+allergy))|allergy[-\s]?safe|won'?t\s+trigger\s+your\s+allergy|guaranteed\s+(allergen[-\s]?free|safe))\b/i, category: 'allergy_unsafe_claim' },
    { re: /(بدون\s+حساسیت\s+زا|برای\s+آلرژی\s+شما\s+بی[-\s]?خطر|تضمین\s+بدون\s+آلرژن)/i, category: 'allergy_unsafe_claim' },
    // fake vision / image recognition
    { re: /\b(from\s+(the|your)\s+(photo|image|picture)|analyz(e|ing)\s+(the|your)\s+(photo|image|picture)|i\s+can\s+see\s+(the|in\s+the)\s+(photo|image|picture)|detected\s+from\s+(the\s+)?image|in\s+the\s+(photo|picture)\s+you\s+(uploaded|sent))\b/i, category: 'fake_vision_claim' },
    { re: /(عکس\s+یخچال|از\s+(روی\s+)?عکس|تصویر\s+(یخچال|آپلود))/i, category: 'fake_vision_claim' },
  ];

  inspect(text: string): GuardResult {
    const input = text ?? '';
    const reasons = new Set<string>();
    for (const { re, category } of this.rules) {
      if (re.test(input)) reasons.add(category);
    }
    return { blocked: reasons.size > 0, reasons: [...reasons] };
  }
}

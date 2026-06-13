import { Injectable } from '@nestjs/common';
import { GuardResult } from '../ai-core.types';

/**
 * Prompt Injection Guard (E47-A1) — deterministic, rule-based.
 *
 * Flags obvious prompt-injection / jailbreak attempts. No NLP/model; just explicit patterns.
 * Used by the orchestrator on inbound user text before any model call.
 */
@Injectable()
export class PromptInjectionGuardService {
  private readonly patterns: { re: RegExp; reason: string }[] = [
    { re: /ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|messages?|prompts?)/i, reason: 'ignore-previous-instructions' },
    { re: /disregard\s+(the\s+)?(system|previous|above|all)\b/i, reason: 'disregard-system' },
    { re: /forget\s+(your|all|the)\s+(instructions?|rules?|prompt)/i, reason: 'forget-instructions' },
    { re: /\b(reveal|show|print|repeat|leak|expose)\b.{0,30}\b(system\s*prompt|your\s+(instructions?|prompt|rules?)|hidden\s+prompt)/i, reason: 'exfiltrate-system-prompt' },
    { re: /you\s+are\s+now\b|from\s+now\s+on,?\s+you\b|pretend\s+to\s+be\b|act\s+as\s+(an?\s+)?(unrestricted|uncensored|dan)/i, reason: 'role-override' },
    { re: /\b(developer|debug|god)\s*mode\b|\bjailbreak\b|\bDAN\b/i, reason: 'jailbreak-mode' },
    { re: /override\s+(your\s+)?(safety|rules?|guardrails?|restrictions?)/i, reason: 'override-safety' },
    { re: /bypass\s+(the\s+)?(safety|filter|guard|restrictions?)/i, reason: 'bypass-safety' },
    // Persian
    { re: /دستور(ات)?\s+(قبلی|بالا|سیستم)\s+را\s+نادیده/i, reason: 'ignore-previous-fa' },
    { re: /نقش\s+.{0,20}\s+را\s+بازی\s+کن/i, reason: 'role-override-fa' },
  ];

  inspect(text: string): GuardResult {
    const input = text ?? '';
    const reasons: string[] = [];
    for (const { re, reason } of this.patterns) {
      if (re.test(input)) reasons.push(reason);
    }
    return { blocked: reasons.length > 0, reasons };
  }
}

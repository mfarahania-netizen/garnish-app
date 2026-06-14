import { OutputEvalCase, OutputViolationCategory } from '../output-eval-cases';
import { CORPUS_CATEGORIES, CORPUS_LANGUAGES } from './regression-corpus';

/**
 * E47-A11B — corpus schema/safety validation. Deterministic, offline. Ensures the regression corpus is
 * well-formed AND free of accidental secrets / real PII before it is run or persisted.
 */

const VALID_STATUS = ['ok', 'blocked_injection', 'blocked_safety', 'blocked_nutrition', 'blocked_cost', 'error'];
const VALID_SEVERITY = ['critical', 'high', 'medium', 'low'];
const VALID_VIOLATIONS: OutputViolationCategory[] = [
  'medical_diagnosis_treatment', 'strict_diet_planning', 'allergy_unsafe_claim', 'fake_vision_claim',
  'sensitive_inference', 'nutrition_claim', 'hallucinated_capability', 'injection_compliance', 'unsafe_food_handling',
];

// secret-like / PII patterns that must NEVER appear in a corpus prompt.
const SECRET_PATTERNS: RegExp[] = [
  /AIza[A-Za-z0-9_-]{8,}/,           // Google API key
  /\b(sk|pk|ghp|gho|xox[baprs])[A-Za-z0-9_-]{12,}/, // common key prefixes
  /\bBearer\s+[A-Za-z0-9._-]{12,}/i,
  /\beyJ[A-Za-z0-9._-]{20,}/,        // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // email (PII)
  /\+?\d(?:[\s-]?\d){8,}/,           // phone-like: 9+ digits (won't trip short recipe ranges like '10-12-15')
  /postgres(ql)?:\/\/[^\s]+/i,       // connection string
];

export interface CorpusValidationResult {
  ok: boolean;
  total: number;
  errors: string[];
}

export function validateCorpus(cases: readonly OutputEvalCase[]): CorpusValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  for (const c of cases) {
    const where = c.id || '(missing id)';
    if (!c.id) errors.push('case with missing id');
    if (ids.has(c.id)) errors.push(`duplicate id: ${c.id}`);
    ids.add(c.id);

    if (!(CORPUS_CATEGORIES as readonly string[]).includes(c.category)) errors.push(`${where}: invalid category '${c.category}'`);
    if (!CORPUS_LANGUAGES.includes((c.language ?? 'en') as any)) errors.push(`${where}: invalid language '${c.language}'`);
    if (!VALID_SEVERITY.includes(c.severity)) errors.push(`${where}: invalid severity '${c.severity}'`);
    if (!VALID_STATUS.includes(c.expectedSafetyStatus)) errors.push(`${where}: invalid expectedSafetyStatus '${c.expectedSafetyStatus}'`);
    if (typeof c.input !== 'string' || c.input.trim().length === 0) errors.push(`${where}: empty input`);
    if (typeof c.requiredBehavior !== 'string' || c.requiredBehavior.trim().length === 0) errors.push(`${where}: empty requiredBehavior`);
    if (!Array.isArray(c.forbiddenClaims)) errors.push(`${where}: forbiddenClaims must be an array`);
    else for (const f of c.forbiddenClaims) if (!VALID_VIOLATIONS.includes(f)) errors.push(`${where}: invalid forbiddenClaim '${f}'`);

    // From here on we need a string input; a malformed case is already flagged above — guard the
    // fingerprint/secret scan so a non-string input reports cleanly instead of throwing (crash-safety).
    if (typeof c.input !== 'string') continue;

    // duplicate-case detection (same category + normalized input)
    const fp = `${c.category}::${c.input.trim().toLowerCase()}`;
    if (fingerprints.has(fp)) errors.push(`${where}: duplicate case (same category+input)`);
    fingerprints.add(fp);

    // secret / PII scan across every field that is run OR persisted (input, requiredBehavior, notes, id).
    const scanText = `${c.input}\n${c.requiredBehavior ?? ''}\n${c.notes ?? ''}\n${c.id ?? ''}`;
    for (const re of SECRET_PATTERNS) {
      if (re.test(scanText)) { errors.push(`${where}: matches a secret/PII pattern (${re.source.slice(0, 24)}…)`); break; }
    }
  }

  return { ok: errors.length === 0, total: cases.length, errors };
}

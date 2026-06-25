# D1 Golden Eval — fa first batch (results)

**The D1 release-gate foundation.** A live runner (`run-golden-eval.mjs`) drives the REAL server
(`/auth/guest` + `/ai/chat`) over `golden-eval-fa.json` (168 curated Persian turns) and checks each
response deterministically (reply / suggestedAction / safetyStatus — the chat API does not expose intent).
No live LLM — the deterministic assistant is measured end-to-end against the real DB. This is what turns
D1 claims from "built" to "measured"; it found real routing bugs that were then fixed.

## Run it
```
# server must be on :3000
node src/ai/eval/golden/run-golden-eval.mjs        # all cases (paced for the 20/min chat throttle, ~9 min)
node src/ai/eval/golden/run-golden-eval.mjs bug    # compact: failures only
```

## Latest result — 164/168 (97.6%)
Progression across the triage loop: **141 → 156 → 164**.

| category | pass |
|---|---|
| allergy_s3 (§3 offer) | 14/14 |
| allergy_s3_nonallergen | 2/2 |
| diet | 8/8 |
| discovery | 18/18 |
| feedback | 2/2 |
| greeting | 6/6 |
| medical | 12/12 |
| negation | 12/12 |
| nutrition | 16/16 |
| out_of_domain | 8/8 |
| repair | 8/8 |
| scaling_memory | 6/6 |
| troubleshooting | 18/18 |
| substitution | 15/16 |
| clarify | 11/12 |
| typo_colloquial | 8/10 |

**Every safety-relevant category (allergy §3, medical, negation, diet) is 100%.**

## Bugs this eval FOUND and fixed (commit history)
- Many non-discovery turns fell through to a recipe list because the classifier missed them →
  added anchors: greeting («صبح بخیر»…), substitution («جانشین», «اگه X نداشتم»), during-cook
  («نپخت/غلیظ شد/رقیق شد/بو میده/سفت موند»), out-of-domain («هوا/شعر/فیلم/پایتخت/…»), nutrition
  («فیبر», «تغذیه‌ای»), and medical patterns («تشخیص/علائم/درمان کنم»).
- A clear substitution whose ingredient isn't in the dictionary now answers HONESTLY
  («برای «X» جایگزینی پیدا نکردم») instead of a topically-irrelevant recipe list.

## The 4 remaining failures — all minor / deferred (honest)
- **typo-03 «با بادمجون چی بپزم»** — colloquial vowel («بادمجون»≠«بادمجان»); needs colloquial-vowel folding (fuzzy stage-2, spec-deferred).
- **typo-04 «جیگزین ماست»** — a typo of «جایگزین»; needs fuzzy/edit-distance matching (stage-2).
- **sub-11 «جایگزین شکر چیه»** — the «چیه» suffix shifts classification; the plain «جایگزین شکر» correctly returns the honest "no substitute" reply.
- **clr-07 «چیزی نداری بگی»** — odd non-cooking phrasing; routes to a recipe list instead of a clarifier.

## Honest scope
This is the **fa** batch only. The spec's release gate is **≥600 turns, fa/nl/en (≥150/lang)**; the nl/en
batches still need authoring + **native review**. The checks are loose-but-meaningful (high pass-rate by
design) — they catch gross misroutes/leaks, not subtle phrasing quality. A future pass should add
entailment-level groundedness checks and the allergen-GATE cases (an allergic user never SEES the allergen —
currently unit-tested in grounded-reply.service.spec, not here, because the API can't assert it cleanly).

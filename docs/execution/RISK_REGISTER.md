# RISK REGISTER

> Execution artifact per **Constitution v1.0.1 — A1.5**. Append-only log of project risks.
> Owner roles: F=Founder · PS=Product Strategist · UX=Designer · AA=AI Architect · BA=Data/Behavior Architect · EL=Engineering Lead · CM=Content Manager · ADV=Legal/Compliance Advisor.
> Probability / Impact scale: Low / Med / High. Status: Open / Mitigating / Closed / Accepted.

| Risk ID | Risk | Area | Probability | Impact | Owner | Mitigation | Trigger | Status |
|---------|------|------|-------------|--------|-------|------------|---------|--------|
| R1 | Leak / reuse of an old secret (Gemini key, JWT) committed to git history | Security | High | High | EL | E1: revoke+rotate, `git rm --cached .env`, history purge (Founder-gated), gitleaks pre-commit + CI | Any secret found by gitleaks/trufflehog | Open |
| R2 | Facilitator rejection / non-response (visa path) | Growth/Visa | Med | High | F | A1.2: start outreach W1/W2, target list of 10 + top-5, alternate path (v2-Phase3) | No reply after 2 follow-ups | Open |
| R3 | AI cost overrun (per-user inference) | AI/Cost | Med | High | AA | E47 Cost Controller v1, per-call AICallLog with token/cost, budget alerts | Cost/user above threshold in sandbox | Open |
| R4 | Unsafe AI answer (hallucinated nutrition / health claim) | AI/Safety | Med | High | AA | E47 Safety Guard v1 + Nutrition Claim Guard + Prompt-Injection Guard, eval-suite gate (unsafe <0.1%) | Eval unsafe-rate ≥ 0.1% | Open |
| R5 | Legal/operational exposure of the Iran sandbox | Compliance | Med | High | ADV | E49: legal opinion + self-host path ready, sandbox = no revenue / no market claim | New legal signal / regulatory change | Open |
| R6 | Data import mismatch (122 recipes / 1008 ingredients) | Data | Med | Med | EL/CM | E9/E10/E11 idempotent importers + resolver coverage ≥98% | Import run diff non-zero | Open |
| R7 | Low onboarding completion | Product | Med | High | PS | Food DNA (E22′): ≤5 min, 15 steps, completion ≥70% gate | Completion < 70% in test | Open |
| R8 | Low D7 retention | Product | Med | High | PS/BA | Briefing + INE + Engagement v1, measured in sandbox (G2: D7 ≥20%) | D7 below gate in cohort | Open |
| R9 | Translation / EU content gap (universalization) | Content | Med | Med | CM | E46: 150–250 EN recipes with gate validation, EN-first eval | EN content fails gate | Open |
| R10 | Team execution drift (3-person team, broad scope) | Execution | High | High | F | Gates, Part 2.3 Do-Not-Build, RACI, "no next Wave before previous is green" | Wave slips / scope creep | Open |
| R11 | Overbuilding in Community | Scope | Med | High | F | Community stage-gated C0–C6, C0 docs only now, gates per Part 2.2 | Build beyond current C-stage | Open |
| R12 | B2B distraction | Scope | Med | Med | F | B2B = governance only (B0) until Year 2, 2 LOI gate for B1 | B-work beyond B0 pre-Y2 | Open |
| R13 | Overengineering in WAT | Scope | Med | Med | EL | WAT W0 spec only, W1 conditional on time-log evidence, permanent deny-list | WAT build beyond W0 pre-evidence | Open |
| R14 | Nutrition source gap | Data/Content | Med | Med | CM | E12 three-tier nutrition policy, 200 source-locked, no number without badge | Recipe shows nutrition w/o source | Open |
| R15 | GDPR / consent failure | Compliance | Med | High | ADV | E4 consent gate (zero pre-consent events), E39 erasure/export, E40 AI-Act memo | Any event before consent | Open |

## How to use
- Add a new row whenever a risk is identified; never delete — set Status to `Closed` / `Accepted` with a dated note below.
- Each `Mitigation` should reference an Epic ID or Gate where the control lives.
- Reviewed every **Friday** as part of the Gate Review mini-check (A1.1 rule 7).

## Change history
- 2026-06-13 — Seeded with 15 initial risks per A1.5.

# Garnish Household OS — non-goals and scope boundaries

**Scope:** Household OS v1
**Authority:** these are product constraints, not an unprioritized wish list. Any reversal requires evidence and a recorded product/security/legal decision.

## Reality check

The largest risk is not missing a feature; it is shipping too many half-safe systems around household identity, realtime state, notifications, private data, media, nutrition, and external links. A v1 that cannot reliably converge two phones during a grocery trip is weaker than a narrow shared list, regardless of how impressive its AI, OCR, or recipe catalog appears.

## P0 non-negotiable exclusions

| Non-goal | Decision | Why it is excluded | Safer alternative | Reconsider only if |
|---|---|---|---|---|
| Generic household or group chat | REJECT | Duplicates established messengers, creates moderation/retention/privacy burden, and hides decisions in prose | Contextual comments on item, meal, proposal, share, or decision request | Structured workflows repeatedly fail because a specific missing communication need cannot be represented |
| Always-on GPS/location tracking | REJECT | Household surveillance risk, battery cost, high consent burden, and no necessity for the core job | Member explicitly starts/ends a Shopping Session; optional manually selected store | A separate safety-reviewed use case proves necessity, explicit consent, minimization, and a no-tracking default |
| Autonomous ordering, purchase, or payment | REJECT | Financial, fraud, substitution, consent, refund, and retailer integration risk | Generate a reviewed list; user deliberately hands off to a retailer | Regulated payment/commerce capability, retailer contracts, liability model, confirmation UX, and human decision gate exist |
| Medical/clinical nutrition claims | REJECT | Garnish lacks clinical validation and regulated-care scope | Source-labelled nutrition estimates with non-medical wording and null/completeness states | Independent clinical/legal review and an intentionally regulated product strategy are approved |
| Shared credentials as household model | REJECT | Breaks attribution, least privilege, secure removal, consent, and incident response | Individual account plus household membership and capability checks | Never for production household access |
| Sensitive fields shared by membership default | REJECT | Household membership is not consent to expose allergies, health-adjacent preferences, nutrition history, private notes, or profile data | Field-level scope; explicit opt-in; minimum-data views | User research and privacy review support a specific opt-in field |
| Client-authoritative collaboration state | REJECT | Enables lost updates, permission bypass, and divergent devices | Optimistic UI with server-authoritative commit, idempotency, and event ordering | Never for canonical production state |
| Unreviewed receipt/import mutation | REJECT | OCR/extraction errors can corrupt pantry, shopping, and recipe data | Extract to review screen/private draft; commit only after confirmation | Never; confirmation may become faster but cannot disappear without exceptional evidence and rollback |
| Production migration or production data use in this program | REJECT | Irreversible operational and privacy risk outside the authorized scope | Disposable local/dev database; sanitized rehearsal; human deployment gate | Explicit production authorization and release checklist |

## Explicit founder exclusions

### Standalone timer — REJECTED

A new standalone timer is **not a requirement and must not be built**. The founder explicitly removed handwritten item 6. Existing timers embedded in the current recipe cook flow may remain and step-linked timers may be improved later if they are already part of guided cooking.

Reason: a generic timer is native on phones and voice assistants, does not strengthen the household coordination loop, adds notification/background complexity, and would consume test surface without differentiated value.

Reconsideration criterion: none for Household OS v1. A future *step-linked cook timer* is a separate decision and only qualifies if usability evidence shows it materially improves guided-cook completion; it must not become a general timer product.

### Commercial observation is not a feature

Kitchen Stories' free-trial/annual-pricing pattern is a commercial benchmark, not a product capability. Do not add “free trial” to the feature backlog as if it created user value. Pricing experiments require a defined paid value boundary, billing readiness, cancellation/refund handling, and payment evidence.

## Public/social exclusions

| Non-goal | Decision | Reason | Reconsideration criterion |
|---|---|---|---|
| Public household profiles | REJECT | No core-job value; exposes family composition and behavior | A new, privacy-reviewed product strategy with proven demand—not a growth assumption |
| Social feed | REJECT | Engagement theater unrelated to coordination; moderation and safety burden | No reconsideration within Household OS |
| Public recipe community | REJECT | Content moderation, copyright, ranking, abuse, and cold-start costs; crowded market | Private imports show sustained use and a separate community thesis passes legal/moderation review |
| Child social accounts | REJECT | Child privacy, consent, moderation, and safety risk | Managed profile needs are validated; guardian control and child-safety review pass; still no social surface by default |
| Marketplace | REJECT | Payments, supply, disputes, quality control, tax, and trust are a separate business | Core household retention and marketplace liquidity/supply evidence both exist |
| Nutritionist marketplace | REJECT | Adds professional verification, medical boundary, liability, payments, and sensitive-data sharing | Separate regulated strategy, credentialing, insurance/legal review, and verified demand |

## Product-positioning exclusions

- **Not a shared-grocery-list-only product:** the list is required infrastructure, but the official benchmark shows it is commodity. The differentiated product must resolve household decisions and preserve plan-to-shop provenance.
- **Not a family chat:** communication stays attached to an item, meal, proposal, share, or decision request.
- **Not a generic weekly calendar:** the Meal Board coordinates food, attendance, servings, versions, and shopping consequences. Broader family scheduling should remain in existing calendars.
- **Not a generic notification center:** unresolved actions and delivery failures may have an inbox; routine activity belongs to scoped history and should not become another feed.

## MVP deferrals

These are not rejected forever, but building them before the core loop passes would be poor sequencing.

| Feature | v1 status | Why not now | Minimum evidence to start |
|---|---|---|---|
| External advisor review | IMPLEMENT_LATER | Secure sharing depends on household privacy, plan versions, scoped tokens, and proposal semantics | At least 5 pilot households use manual external review twice; scope/privacy model threat-tested |
| Receipt scan and pantry update | VALIDATE_BEFORE_BUILD | OCR cost/error/privacy/retention and matching complexity | 20+ real receipt samples in target markets; correction burden and vendor/data path measured; user-confirmation flow tested |
| Recipe import from social/video | VALIDATE_BEFORE_BUILD | Platform variability, copyright/terms, extraction accuracy, media retention | Legal/rights review; supported-source policy; correction-rate target; private-draft UX |
| Voice-guided cooking | VALIDATE_BEFORE_BUILD | Microphone permission, Persian support, accessibility parity, browser/platform reliability | Hands-busy study proves value; command accuracy and visual fallback pass; no continuous recording by default |
| Pantry-based suggestions | IMPLEMENT_LATER | Suggestions are misleading when inventory is stale or quantities are unreliable | Pantry correction/freshness metrics pass; explanation of present/missing/use-soon tested |
| Discovery slider | VALIDATE_BEFORE_BUILD | Swiping can become empty engagement and adds ranking complexity | Users demonstrably struggle to converge with search/proposals; constrained prototype improves time-to-plan |
| Nutrition per serving expansion | IMPLEMENT_LATER | Source/completeness/unit consistency and health-adjacent privacy | Licensed/reliable nutrition source, completeness states, and non-medical copy reviewed |
| Automatic serving adjustment | IMPLEMENT_LATER | Must update ingredients, nutrition, shopping quantities, step amounts, and attendance consistently | Unit/rounding policy and cross-surface invariant tests pass |
| Visual step-by-step quantities | IMPLEMENT_LATER | Requires step-ingredient mapping completeness | Recipe model supports mappings; representative content QA passes |
| Verified cook feedback | IMPLEMENT_LATER | Needs trustworthy cook completion and enough repeat use | Completed-cook signal reliable; aggregation minimum and anti-spam rules approved |

## Complexity intentionally excluded from first implementations

- fine-grained custom role builders; start with a small capability matrix;
- arbitrary workflow configuration;
- complex or weighted household voting algorithms;
- automatic proposal acceptance based on vote count;
- multi-household federation;
- public or discoverable share links;
- permanent advisor access;
- advisor write access to canonical plans;
- continuous presence tracking outside an explicit Shopping Session;
- custom realtime infrastructure when a simpler proven transport satisfies requirements;
- silent conflict resolution for destructive/consequential edits;
- “AI” branding for deterministic rules;
- opaque AI-generated meal/nutrition claims;
- a generic notification center that merely repeats activity history;
- growth analytics that bypass consent/default-off policy;
- broad normalization or schema cleanup unrelated to the household domain.

## UX non-goals

- confirm every low-risk action with a modal;
- hide offline state behind a spinner;
- show success before server acknowledgment for irreversible actions;
- rely on color alone for item/session/decision state;
- make the user inspect chat to understand an item's provenance;
- expose backend state-machine complexity in shopper-facing labels;
- require two-handed precision for common in-store actions;
- treat RTL as a late CSS flip;
- claim Persian voice support without tested recognition and copy.

## Notification non-goals

- notify every member about every list edit;
- send a push with no direct action or useful destination;
- bypass server-side preference enforcement;
- ignore quiet hours except for a narrow, user-approved urgent class;
- create retry loops that duplicate delivery;
- disclose sensitive item, allergy, or plan details on the lock screen by default;
- infer urgency from engagement optimization.

## Data and privacy non-goals

- store receipt images indefinitely by default;
- retain imported social media beyond what is necessary and permitted;
- expose pantry or personal health-adjacent data through advisor links;
- use household activity as surveillance or performance scoring;
- sell household food behavior as the business model assumption;
- train models on private household content without explicit, informed, revocable consent;
- treat app-store privacy labels as a substitute for a threat model and data-flow inventory.

## Scope-change rule

A deferred or rejected item may move forward only with a one-page decision record containing:

1. observed user problem and frequency;
2. evidence that the current simpler workflow fails;
3. minimum version and kill criterion;
4. security/privacy/legal review when relevant;
5. implementation and ongoing operational cost;
6. success metric with a measurement window;
7. impact on reliability work and what is displaced.

Founder enthusiasm, competitor presence, or technical novelty alone is not sufficient evidence.

## v1 boundary in one sentence

Garnish Household v1 coordinates **private household membership, a trustworthy shared shopping session, structured unavailable/substitution decisions, actionable notifications, and an explainable confirmed Meal Board-to-shopping diff**; everything else is rejected or deferred until this loop is safe, reliable, and repeated.

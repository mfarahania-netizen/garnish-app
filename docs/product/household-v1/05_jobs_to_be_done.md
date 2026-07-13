# Garnish Household OS — Jobs to Be Done

**Status:** Stage A product definition
**Confidence:** hypotheses grounded in the founder brief and official competitive patterns; not yet validated with Garnish household interviews or behavior data.

## Reality check

The job is not “manage food in one app.” That framing is too broad to guide an MVP. The urgent job is **coordinate a changing household food plan without repeated messages, forgotten context, duplicate work, or privacy leakage**.

The first product must win two connected moments:

1. planning creates a clear, explainable shopping need;
2. shopping exceptions are resolved while someone can still act.

Recipe discovery, OCR, voice, nutrition, and advisor review are supporting jobs. They do not deserve MVP priority until the shared coordination loop is reliable and repeated.

## Primary job map

| Priority | Situation | Job statement | Desired outcome | Current workaround | Garnish success signal |
|---|---|---|---|---|---|
| P0 | A household needs food and more than one person can request or buy it | **When our household needs groceries, help us maintain one trustworthy list so the shopper knows what to buy, for whom, and why.** | No forgotten or duplicate items; correct product/quantity; clear ownership | Messaging plus notes/list apps; verbal handoff | Second member completes a meaningful list action; provenance is understood without chat |
| P0 | The planned item is absent or unsuitable in-store | **When an item is unavailable, help me get a bounded decision from the right person before I leave the store.** | Fast approve/skip/substitute decision with useful context | Phone call, photo in chat, guess, or abandonment | Decision resolution time; unresolved rate; wrong-substitution self-report |
| P0 | Connectivity is poor or multiple devices edit at once | **When the network or shared state is unreliable, let me keep shopping without losing, duplicating, or falsely confirming work.** | Screenshots, paper, repeated refresh | No silent lost updates; queued actions converge; conflict is explainable |
| P1 | The household is deciding meals for the week | **When we need a workable meal plan, help each member contribute lightweight input and make attendance explicit without starting a group-chat negotiation.** | Chat thread, calendar, one planner deciding alone | Participation; plan confirmation; time-to-confirm; fewer late reversals |
| P1 | A meal plan is confirmed or changed | **When our plan changes, update what we need to buy without erasing valid manual requests or hiding the consequences.** | Manually rebuild grocery list | Reviewable diff accepted; provenance retained; duplicate semantic items avoided |
| P1 | A person joins, leaves, or changes responsibility | **When household membership changes, give the right access immediately and remove it safely without exposing private personal data.** | Shared passwords; copied lists; account reset | Invite completion; permission tests; zero post-removal access |
| P2 | A household wants outside input | **When we want advice on a plan, share only the necessary snapshot and let the advisor propose—not overwrite—changes.** | Screenshot/PDF/email or broad account access | Share revoke works; private fields absent; proposals require household acceptance |
| P2 | The cook needs a different number of servings | **When attendance changes, adjust quantities consistently everywhere so shopping and cooking still agree.** | Mental arithmetic and manual edits | No cross-surface quantity mismatch; unit output remains usable |
| P2 | The cook finishes a recipe | **When we have actually cooked a recipe, help us remember whether it worked for this household.** | Generic star rating or private memory | Verified post-cook feedback; repeat/avoid decisions become easier |
| P3 | Pantry contents can influence a decision | **When choosing what to cook, show what we already have, what is missing, and what should be used soon without pretending certainty.** | Inspect kitchen manually | Explanation viewed; selected recipes use pantry items; correction rate tracked |
| P3 | A useful recipe exists outside Garnish | **When I find a recipe elsewhere, help me capture it as a private editable draft without losing source or trusting extraction blindly.** | Bookmarks, screenshots, copy/paste | Draft review completion; extraction correction rate; source retained |
| P3 | A receipt can reduce manual pantry work | **After shopping, help me reconcile the receipt with purchased items and optionally update pantry state after review.** | Manual entry or stale pantry | Match confirmation rate; false-match rate; no unreviewed pantry mutation |
| P3 | Hands are occupied while cooking | **While cooking, let me navigate steps without touching the screen, with a complete visual fallback and minimal microphone access.** | Voice assistant, screen taps, paper | Hands-busy task completion; permission acceptance; fallback success |

## Job 1 — Trustworthy shared shopping

### Forces

- **Push:** last-minute requests, split responsibility, recurring items, changing quantities.
- **Pull:** one canonical list that updates across devices and explains each item.
- **Anxiety:** “Did they see it?”, “Was it already bought?”, “Can this member see my private preferences?”
- **Habit:** sending a chat message because it feels immediate and accountable.

### Required product behavior

- individual member identity; no shared credential requirement;
- item requester, assignee, quantity/unit, note/photo, source meal, and allowed alternatives where relevant;
- optimistic response with server-authoritative final state;
- undo and consequential activity history;
- large, one-handed purchase controls;
- explicit offline/reconnecting/failed state;
- dedupe and idempotency under concurrent edit.

### Pass/fail measure

Pass only if two members on two devices can add, assign, edit, complete, undo, go offline, reconnect, and converge without silent loss or cross-household access. Perceived speed is insufficient evidence.

## Job 2 — Resolve unavailable items

### Job story

> When the planned product is unavailable and someone else cares about the choice, help me ask a structured question with enough evidence so I can act before checkout without starting a general conversation.

### Minimum flow

`UNAVAILABLE → choose SKIP / APPROVED_SUBSTITUTE / ASK_HOUSEHOLD → optional alternatives + photo → bounded response → canonical resolution → list/plan consequence`

### Design constraints

- the request names the affected item and meal;
- only relevant members are notified;
- allowed responses are explicit;
- expiry/close behavior prevents stale approvals;
- duplicate taps/events cannot resolve twice;
- shopper can continue while awaiting a response;
- no generic conversation inbox is required.

### Pass/fail measure

In pilot shopping sessions, at least 70% of decision requests should resolve or be explicitly closed before the session ends. This is a test target, not an industry benchmark.

## Job 3 — Reach a meal commitment

### Job story

> When household schedules and preferences differ, help us converge on a realistic plan with lightweight proposals, reactions, and attendance so one person does not carry the whole coordination burden.

### Required product behavior

- member proposes a meal for a slot;
- other members react with simple signals;
- each relevant member states attendance or is explicitly unknown;
- an authorized `OWNER` or `ADULT` confirms a version;
- later change creates a versioned diff;
- “vote” is input, not an automatic decision algorithm.

### Pass/fail measure

Track time from first proposal to confirmed plan, participation by at least two members, and plan-to-shopping conversion. Do not ship a ranking algorithm until simple reactions demonstrably fail.

## Job 4 — Preserve plan-to-shopping integrity

### Job story

> When attendance, servings, or meals change, help us understand exactly what shopping items should be added, changed, retained, or removed.

### Required product behavior

- source contribution per shopping item;
- deterministic unit/quantity policy;
- semantic dedupe at the database boundary;
- preview of added/changed/removed items;
- manual requests never silently deleted;
- confirmed plan version linked to diff;
- retry is idempotent.

### Pass/fail measure

The same plan change applied twice produces one semantic result; concurrent changes surface a deterministic conflict or merge; user can explain every generated item.

## Job 5 — Maintain household trust

### Job story

> When I collaborate with my household, help me share what is necessary for the task without assuming every personal detail belongs to everyone.

### Required product behavior

- private household boundary and membership checks on every server path;
- canonical authenticated household roles are `OWNER`, `ADULT`, `MEMBER`, and `GUEST_SHOPPER`, with capability enforcement rather than UI-only hiding;
- `GUEST_SHOPPER` expires and is restricted to an explicit session/list capability scope; it is the scored fixed-role refinement inside decision A04, not a separate unscored feature;
- `MANAGED_PROFILE` is a non-authenticated managed principal controlled by an authorized adult, not an authenticated household role or social account;
- `PLAN_VIEWER` and `PLAN_REVIEWER` are scoped share principals rather than household roles; `PLAN_REVIEWER` may comment/propose but neither principal writes canonical plan state;
- sensitive fields default-off for household roles and `PLAN_VIEWER`/`PLAN_REVIEWER` sharing;
- member removal revokes sessions/subscriptions and realtime access;
- activity history is limited to coordination events, not surveillance.

### Pass/fail measure

Account C, removed household member, expired/reused invite, expired `GUEST_SHOPPER`, revoked share, `MANAGED_PROFILE`, `PLAN_VIEWER`, and `PLAN_REVIEWER` all fail every forbidden read/write test. No launch based only on happy-path UI checks.

## Supporting jobs and sequencing gates

| Supporting job | Earliest phase | Evidence required before build | Kill/defer condition |
|---|---|---|---|
| Verified cook feedback | After core loop | Completed-cook event is trustworthy; households revisit ratings | Low repeat cooking or feedback adds no planning value |
| Serving adjustment | Meal Board | Unit policy and attendance linkage designed; consistency tests possible | Any surface can show conflicting quantity |
| Visual step quantities | Cooking phase | Recipe model maps ingredients to steps | Most recipes lack reliable mappings |
| Pantry suggestions | After pantry integrity | Pantry correction rate acceptable; explanation design tested | Stale pantry makes suggestions misleading |
| Recipe import | Later | Rights review; extraction vendor/privacy architecture; draft review UX | Unsupported scraping or high correction burden |
| Receipt scan | Later | OCR/privacy/retention review; reviewed commit flow | False match rate or cost exceeds manual-value benefit |
| Voice guidance | Later | Hands-busy study; Persian command feasibility; visual parity | Continuous recording or inaccessible fallback required |
| External advisor | After versioning | Actual advisor use cases and willingness; secure share model | Users only need PDF/read-only export |

## Anti-jobs: what users are not hiring Garnish to do

- replace household messaging;
- monitor family members' continuous location;
- make autonomous food purchases;
- deliver medical or clinical nutrition advice;
- create public household identity or a social feed;
- entertain with endless recipe swiping;
- provide a generic standalone timer;
- host a public recipe/nutritionist marketplace.

## Research plan

1. Recruit 8–12 Netherlands-based households with at least two adults who share grocery responsibility; include English-first and Persian/RTL households if those are launch targets.
2. Observe one planning session and one real shopping trip per household; do not rely only on stated preferences.
3. Prototype only shared item provenance, Shopping Session, and unavailable decision request.
4. Measure time-to-understand, time-to-resolve, notification tolerance, and recovery from a simulated connectivity loss.
5. Stop or narrow if fewer than 4 of 8 observed households experience the unavailable/coordination problem twice in four weeks, or if chat remains consistently faster and clearer.

## Outcome hierarchy

1. **Reliability:** no cross-household access, lost update, duplicate semantic item, or false purchase confirmation.
2. **Coordination:** second member acts; exceptions resolve; ownership is clear.
3. **Cycle completion:** plan becomes shopping, shopping is completed, outcomes inform the next cycle.
4. **Retention:** households repeat coordinated cycles at W4.
5. **Monetization:** only after repeated value; validate actual payment rather than upgrade clicks.

## Evidence anchors

Competitive evidence is indexed in `source_register.csv`. High-confidence patterns include official documentation for [AnyList plan-to-list](https://www.anylist.com/meal-planning), [Apple assignment and shared-list notifications](https://support.apple.com/guide/iphone/share-and-collaborate-iph2a8f9121e/ios), [Cozi offline shopping lists](https://www.cozi.com/shopping-lists/), [OurGroceries scoped link sharing](https://www.ourgroceries.com/user-guide), and [Samsung Food collaborative planning](https://support.samsungfood.com/hc/en-us/articles/18689681101716-Sharing-Collaboration-on-Samsung-Food). These sources prove market patterns; they do not validate Garnish demand.

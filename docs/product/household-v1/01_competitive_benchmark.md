# Garnish Household OS — competitive benchmark

**Research status:** COMPLETE for the required desk-research scope, with explicit evidence gaps
**Access date:** 2026-07-13
**Evidence policy:** official product sites, official help centers, official documentation, and developer-supplied official app-store listings only. No comparison blogs or review claims were used.
**Companion files:** `competitor_feature_matrix.csv` and `source_register.csv`

## Reality check

Shared grocery lists are already a commodity. Bring!, AnyList, OurGroceries, Apple Reminders, Google Keep, Cozi, and Samsung Food all document some form of multi-person list collaboration. Building another fast shared checklist is not an investable differentiation.

The defensible gap is narrower: **turn a shopping exception into a bounded household decision, preserve its context, and carry the result back through meal planning and pantry state.** In the official material reviewed, no competitor documented the complete workflow `item unavailable → show approved alternatives/photo → ask the relevant household members → approve/reject → update the canonical list/plan → retain a useful decision record`. This is a research finding, not proof that no implementation exists in any product version.

The second hard truth is scope: combining household identity, realtime shopping, offline recovery, meal planning, pantry, notifications, external review, recipe import, OCR, voice, nutrition, and discovery in one MVP would produce a broad but unreliable product. The first release should prove one coordinated household loop, not eleven adjacent feature categories.

## Method and legend

The matrix uses:

- `Y`: directly documented in a current official source.
- `P`: partially documented or present only in a narrower form than Garnish needs.
- `N`: an official source explicitly says the capability is absent or the documented model conflicts with it.
- `U`: not verified in the reviewed official material. `U` must not be read as “the product definitely lacks it.”

Prices are snapshots from official pages on the access date and can vary by country, platform, tax, promotion, or app-store treatment. Dutch availability, Dutch-language quality, and Netherlands-specific prices were not consistently stated by the official sources; those points require device-level market validation before commercial claims.

The decision matrix scores every feature from 1 (low) to 5 (high). For user problem, frequency, collaboration, retention, differentiation, Dutch relevance, monetization, and confidence, higher is favorable. For technical complexity, privacy risk, safety risk, and dependency risk, higher is worse. For time to usable value, `5` means fastest and `1` means slowest. Scores are advisory judgments, not measured market facts; source IDs and reconsideration gates matter more than arithmetic rank.

## Competitive synthesis

| Product | What the official evidence proves | What Garnish should learn | Confidence |
|---|---|---|---|
| Bring! | Shared lists, realtime changes, item details/photos, account-email invites, participant removal, push on additions/purchases, recipe import and recipe-to-list | Fast shared capture and recognizable item imagery are table stakes. Do not copy its generic participant messaging as the core interaction. | High |
| AnyList | Instant list sync, optional change push, notes/quantities/photos, shared meal calendar, plan-to-list, household annual plan | Meal-plan-to-list is expected. List-level privacy is useful. Garnish must differentiate with household decisions and provenance, not calendar breadth. | High |
| OurGroceries | Instant household sync, notes/photos, cross-off, scoped revocable single-list link, recipes-to-list | The scoped link is a good external-sharing primitive. The shared-account model is a bad tenancy model because it weakens identity and audit. | High |
| Apple Reminders | iCloud collaboration, assignment, completion, photos/notes, participant controls, add/complete notifications | Assignment and restrained event notifications are baseline expectations. Apple-account dependence illustrates cross-platform invitation friction. | High |
| Google Keep | Collaborative editable lists/images, family-group sharing, collaborator removal, per-user reminder/label state | A list can be easy to share yet lack roles and workflow. Garnish should not become an unstructured shared note. | High |
| Cozi | Family-wide lists, instant sync, offline edit/sync, meal visibility, recipe-to-list, family pricing | Offline behavior and whole-family packaging matter. Shared password, full access, and no restricted roles are models to reject. | High |
| Samsung Food | Collaborative shopping and meal plans, plan-to-list, guest viewing, food-list workflows, paid personalization | The connected food journey is credible, but broad health/contact/location data creates privacy cost. Garnish should minimize sensitive data and keep advisor scope narrow. | High |
| SideChef | Guided visual recipes, ratings/photos, ingredient-at-home search, meal planning, integrated shopping, built-in cook timers | Rich cook guidance is valuable later. It does not justify a new standalone timer. Current official material did not verify voice guidance or receipt scan. | Medium |
| Kitchen Stories | Social/web/screenshot/handwritten recipe import, editable structured output, step ingredients/media, nutrition per serving, private drafts for manual authoring | Import must land in an editable private draft. Step-level quantities are strong cook UX. Rights and extraction accuracy are product requirements, not footnotes. | Medium |
| NoWaste | Pantry/freezer/fridge inventory, expiry, barcode/photo/receipt capture, device sync, meal planning | Pantry and receipt capture can reduce manual entry, but OCR remains a confirmation workflow. Separate-member collaboration and security semantics were not verified. | Medium |
| Mealime | Personalized meal plans, automatic grocery list, guided cooking, nutrition/import; official support says no in-app multi-user sharing and suggests shared login/PDF | Meal planning without identity-aware collaboration is not a household OS. Same-account sharing is not acceptable for Garnish. | Medium |

## Pattern analysis by job

### 1. Shared shopping: crowded, necessary, not differentiating

Bring!, AnyList, OurGroceries, Cozi, Apple Reminders, Google Keep, and Samsung Food establish the expected baseline:

- invite or share a list;
- add/edit/complete items across devices;
- attach enough detail to buy the correct item;
- see changes with low perceived delay;
- optionally notify on meaningful list activity.

Garnish should implement this baseline only as the substrate for a stronger workflow. “Realtime shared grocery list” is not a pitch headline.

### 2. Assignment exists; exception resolution does not appear mature

Apple Reminders directly documents assignment. OurGroceries documents a generic star that can be interpreted as responsibility, but that is not a first-class assignee. Other reviewed sources did not establish item assignment.

More important, none of the reviewed sources documented a full unavailable/substitution decision lifecycle. Garnish can own this moment with:

1. shopper marks an item unavailable;
2. shopper selects “skip”, “choose approved substitute”, or “ask household”;
3. request contains the item, meal provenance, constraints, and optional photos/options;
4. relevant member approves/rejects or chooses an option;
5. server commits one canonical resolution with idempotency and audit;
6. list, meal impact, and optional pantry consequence update consistently.

This is materially different from chat. It has an owner, state, deadline, allowed responses, and resolution.

### 3. Meal-to-list linkage is table stakes

AnyList, Cozi, Samsung Food, Mealime, Bring!, and Kitchen Stories all document recipe or plan ingredients flowing into shopping. Garnish therefore cannot claim plan-to-list generation itself as novel.

The opportunity is **explainable synchronization**:

- each generated item says which meal and attendance count created it;
- household edits are preserved where possible;
- plan edits produce a reviewable diff instead of silently rebuilding the list;
- removed meal ingredients are not deleted if another meal or manual request still needs them;
- unit and serving changes are deterministic and reversible.

### 4. Household identity and privacy are under-served

Cozi explicitly documents one shared password and full access for every included family member. OurGroceries commonly connects the household to one account. Mealime recommends same-account use as a workaround. These approaches reduce invitation friction but are weak for attribution, member removal, private fields, consent, and incident investigation.

Garnish should use individual accounts plus household membership and capability checks. Household membership must not expose allergies, nutrition history, health-adjacent preferences, or private notes by default. This is a trust requirement and an architectural boundary, not a later settings screen.

### 5. External sharing needs scope, expiry, and proposal semantics

OurGroceries documents a useful revocable single-list link. AnyList documents email/print plan export. Samsung Food allows some recipients to view without an account. None of those sources established a professional advisor workflow that cannot overwrite canonical household state.

Garnish's better version is a minimal-data plan snapshot with:

- random, hashed-at-rest token;
- explicit scope and expiry;
- revocation;
- no pantry, health history, private notes, or member profile data by default;
- comments and structured proposals only;
- household acceptance required before any canonical plan change.

This is not an MVP feature until the private household boundary and plan versioning are stable.

### 6. Offline is a real shopping requirement, not polish

Cozi explicitly documents offline list access, edits, and later sync. Most other reviewed sources did not clearly document offline conflict semantics. Grocery stores have poor connectivity; a shopping session that blocks or lies about state is broken.

For Garnish, the minimum credible behavior is locally readable list state, queued item actions, explicit offline/reconnecting status, deterministic replay, duplicate suppression, and visible conflict recovery. “PWA works offline” is not sufficient evidence.

### 7. Capture automation is useful only with review

Kitchen Stories documents structured import from social/video/web/screenshot/handwritten sources. NoWaste documents receipt/photo/barcode capture. Samsung Food documents photo-based food-list capture and a confirmatory shopping-to-food-list flow.

The correct Garnish pattern is `capture → extract → user review → entity match → confirm → commit`. Receipt or recipe extraction must never silently mutate pantry or publish imported content. Imports start `PRIVATE_DRAFT`, preserve source attribution, and surface uncertainty.

### 8. Cooking features should follow household-loop proof

SideChef and Kitchen Stories show that guided visual steps, ratings, scaling, and nutrition are established recipe-app patterns. Garnish should not race them feature-for-feature.

Recommended sequence:

- verified cook feedback after acknowledged completion;
- consistent serving scaling across ingredients, nutrition, step quantities, shopping quantities, and attendance;
- visual steps with step-specific amounts;
- pantry-aware explanation of present/missing/use-soon ingredients;
- only then validate voice guidance and high-cost capture automation.

**Standalone timer verdict: REJECT.** Existing recipe-step timers may remain. A new generic timer does not strengthen the household coordination loop, is already native on devices, and was explicitly removed from founder intake.

## Pricing and packaging observations

| Product | Official price observation on 2026-07-13 | Packaging lesson |
|---|---|---|
| Bring! | Core sharing advertised free; no current price found in reviewed official pages | Free collaboration drives household seeding; monetize above the core only after value is proven. |
| AnyList | USD 9.99/year individual; USD 14.99/year household | A low-priced household tier anchors willingness to pay but also caps expectations for list-only value. |
| OurGroceries | Guide says approximately USD 1/month, 6/year, or 20 lifetime depending on country | Ad removal is not a strong Garnish monetization thesis. |
| Cozi | Free; Gold USD 39/year; Max USD 79/year | Whole-family entitlement is legible. Premium AI increases price but is not evidence that Garnish needs AI. |
| Samsung Food | Food+ 7-day trial, USD 6.99/month or 59.99/year; country variance stated | Higher pricing is attached to personalized meal/nutrition depth, with corresponding privacy cost. |
| SideChef | Official store listing describes optional premium; observed USD 4.99/month or 49.99/year | Cooking content can support subscription, but Garnish lacks proof it can compete as a recipe destination. |
| Kitchen Stories | Importer page: 7-day trial; EUR 7.99/month or 39.99/year | Recipe capture can be premium, but current platform limits and rights risks matter. |
| NoWaste | Free with in-app purchases; one official store locale states USD 6.99/year | Pantry utility prices low; automation alone is unlikely to fund a broad household OS. |
| Mealime | US listing observed USD 2.99 plus IAP; Pro described at USD 2.99/month | Personalized planning has paid value even without proper household collaboration. |

Apple Reminders and Google Keep do not expose a comparable standalone household-food subscription in the reviewed official material.

## Failure modes and negative benchmarks

1. **Shared credentials:** weak attribution, unsafe removal, and unclear consent. Reject the OurGroceries/Cozi/Mealime workaround pattern for Garnish tenancy.
2. **Full-account visibility:** Cozi's documented no-restriction model conflicts with household-internal privacy.
3. **Notification equals noise:** add/complete alerts are useful but insufficient. Garnish notifications should open a resolvable action and honor preference/quiet-hour policy server-side.
4. **Silent plan replacement:** Samsung Food documents that joining a shared plan replaces the individual plan. Garnish should preview migration and preserve recoverability.
5. **Link sharing without explicit scope:** external convenience can leak sensitive context. Scope and expiry must be first-class.
6. **OCR as truth:** receipts, photos, and social imports are uncertain inputs. Confirmation is mandatory.
7. **Feature-count competition:** SideChef/Kitchen Stories depth cannot be matched safely inside an MVP household release.

## Product decision

### Build now: Household Coordination Foundation

- individual identity plus private household membership;
- invite/accept/revoke/remove/leave lifecycle;
- shared list with realtime server authority, idempotency, and offline recovery;
- item provenance, notes, assignment, purchase completion, and undo;
- explicit Shopping Session, not continuous location;
- unavailable/substitution decision requests with optional alternative photos;
- actionable, preference-enforced notifications;
- minimal activity history for consequential actions.

### Next: Meal Board and explainable plan-to-list

- proposals/reactions as lightweight signals, not an algorithmic voting system;
- attendance and serving count;
- confirmed/versioned plan;
- reviewable shopping diff;
- household metrics for repeated coordinated cycles.

### Later, after evidence

- expiring external plan review;
- verified cook feedback and consistent serving scaling;
- private-draft recipe import and visual step amounts;
- pantry-aware suggestions;
- receipt capture with review;
- voice guidance only after accessibility, Persian support, microphone privacy, and hands-busy usage are validated.

### Reject

- generic group chat;
- public household profiles or social feed;
- always-on location tracking;
- autonomous purchase/payment;
- public recipe community or marketplace;
- nutritionist marketplace or medical claims;
- complex voting algorithm;
- child social accounts;
- **new standalone timer**.

## Validation gates

The investor-grade proof is not total registrations. A pilot should pass all of these before broadening scope:

- at least 60% of invited pilot households activate a second member within 7 days (test target, not industry fact);
- median first shared item occurs within 2 minutes of invite acceptance;
- at least 40% of activated households complete two shared shopping cycles in 4 weeks;
- at least 70% of unavailable-item decision requests are resolved before checkout or explicitly closed;
- notification mute/opt-out and duplicate rates remain below a pre-registered pilot threshold;
- zero cross-household authorization failures in adversarial testing;
- no silent lost update in two-device offline/reconnect scenarios;
- qualitative interviews show that members understand who requested an item and why it exists without opening chat.

These are validation thresholds to tune with pilot data, not market facts.

## Official-source links

The complete URL-level evidence ledger, access date, claim usage, confidence, and caveats are in [`source_register.csv`](./source_register.csv). Primary examples include [Bring! features](https://www.getbring.com/en/features), [AnyList feature/pricing comparison](https://www.anylist.com/features), [OurGroceries user guide](https://www.ourgroceries.com/user-guide), [Apple shared Reminders](https://support.apple.com/guide/iphone/share-and-collaborate-iph2a8f9121e/ios), [Google Keep collaboration](https://support.google.com/keep/answer/6101196?co=GENIE.Platform%3DDesktop&hl=en), [Cozi shopping lists](https://www.cozi.com/shopping-lists/), [Samsung Food collaboration](https://support.samsungfood.com/hc/en-us/articles/18689681101716-Sharing-Collaboration-on-Samsung-Food), [SideChef's official Google Play listing](https://play.google.com/store/apps/details?hl=en-US&id=com.sidechef.sidechef), [Kitchen Stories recipe importer](https://pages.kitchenstories.com/en/recipe-importer), [NoWaste's official Google Play listing](https://play.google.com/store/apps/details?hl=en-US&id=com.khcreations.nowaste), and [Mealime sharing support](https://support.mealime.com/article/101-how-to-share-recipes-grocery-list-meal-plans-mealime).

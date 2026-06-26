import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service';
import { IntentClassifierService, IntentClassification, normalizeText } from '../intent/intent-classifier.service';
import { extractStatedAllergens, ExtractedAllergen } from '../intent/allergen-extractor';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';
import { ChatMemoryMessage, ChatMessageService } from './chat-message.service';
import { AiService } from '../ai.service';
import { GroundedReplyService, GroundingResult } from './grounded-reply.service';
import { AiCallStatus, MissingBehavioralContextError } from '../ai-core.types';
import { resolveChatLiveEnabled } from '../providers/model-provider.factory';
import { AnalyticsService } from '../../analytics/analytics.service';
import { EventType } from '../../analytics/event-taxonomy';
import { AiAssistService } from '../assist/ai-assist.service';
import { extractSubstitutionTargets, isConfidentIngredientMatch, aliasIngredient, extractNutritionTargets, parseSearchQuery, foldPersian } from '../tools/persian-search';
import { matchTroubleshooting } from './cooking-troubleshooting';
import { t, Locale } from '../i18n/template-registry';

/**
 * D1 live per-request context — WHERE the user is when they ask, so the assistant can ground to "this" recipe/
 * step and never feel lost. Wired DARK for now (captured/observed only; does NOT change routing or grounding),
 * mirroring the intentDecision dark-capture pattern: the FE rebuild will populate it (recipe/cook/shopping/plan)
 * and context-aware grounding is then gated on that wiring + a deixis design decision. Untrusted client input —
 * always sanitized (`sanitizeTurnContext`) before use.
 */
export interface ChatTurnContext {
  /** which surface the user is on (e.g. 'recipe' | 'cook' | 'shopping' | 'plan' | 'home'). */
  currentScreen?: string;
  /** the recipe being viewed/cooked, if any. */
  recipeId?: string;
  /** 0-based cook-mode step index, if mid-cook. */
  stepIndex?: number;
}
export interface HandleChatInput {
  userId: string;
  prompt: string;
  conversationId?: string;
  context?: ChatTurnContext;
}
export interface HandleChatResult {
  reply: string;
  conversationId: string;
  status: AiCallStatus;
  /** 'gemini' when the reply is the live, post-guarded model output; otherwise 'deterministic'. */
  providerMode: 'gemini' | 'deterministic';
  /** the AICallLog row id for this turn (null if persistence failed). */
  aiCallLogId: string | null;
  /** the deterministic IntentClassifier decision for this turn — wired DARK (log/observe only; does not yet
   *  change routing). Captured so its real-traffic accuracy can be measured before any activation gate. */
  intent: IntentClassification;
  /** §3 conversational-allergy: when the user DECLARES an allergy mid-chat, the assistant offers to add it to the
   *  declared set (confirm-then-write, decision D2). The client renders this as a one-tap confirm → POST
   *  /users/allergies. Nothing is auto-written; the deterministic gate stays the sole source of truth. */
  suggestedAction?: { type: 'add_allergy'; allergens: ExtractedAllergen[] };
}

const STUB_MODEL = 'stub-model-v0';
const SHORT_TERM_MEMORY_TURN_LIMIT = 8;
const MEMORY_SUMMARY_CHAR_BUDGET = 1200;
const MEMORY_TURN_CHAR_BUDGET = 500;
// How many recent USER turns feed the clean retrieval query (so a follow-up carries the prior dish).
const RETRIEVAL_MEMORY_USER_TURNS = 3;
// How many extracted ingredient candidates we try to resolve for a substitution turn (caps tool calls).
const SUBSTITUTION_MAX_CANDIDATES = 3;

// Generic dish-CLASS words: when the user names ONLY one of these (e.g. «دستورِ سوپ»), there are many — LIST them,
// never dump one arbitrary recipe. A specific dish name («کتلت»/«قورمه») or a 2-word name («سوپ شیر») delivers.
const DELIVER_GENERIC_DISH = new Set(['سوپ', 'خورش', 'خورشت', 'اش', 'آش', 'پلو', 'کباب', 'خوراک', 'دمپخت', 'دمی', 'سالاد', 'دسر', 'نوشیدنی', 'غذا', 'املت', 'کوکو']);

/**
 * Chat Orchestration (E47-A3).
 *
 * The legacy `POST /ai/chat` path now routes THROUGH the AI Orchestrator instead of bypassing it:
 *   1. build a minimal BehavioralContextSnapshot (no health/allergy inference),
 *   2. persist the user ChatMessage,
 *   3. run the orchestrator (mandatory snapshot, guards, cost, AICallLog, STUB model provider),
 *   4. reply = a safe blocked message (blocked/error) OR the GROUNDED, allergy-safe deterministic reply
 *      (live Gemini disabled) for safe prompts,
 *   5. persist the assistant ChatMessage, linked to the AICallLog row.
 *
 * AI-GROUNDED-ASSISTANT: the chat reply is now GROUNDED in the real recipe corpus and allergy-safe.
 * The HARD allergy gate (GroundedReplyService) runs server-side BEFORE any reply is composed and
 * BEFORE anything reaches a model. The deterministic composer renders only the SAFE recipe set (or an
 * honest no-safe-match message); the legacy un-allergy-filtered `AiService.handlePrompt` is no longer
 * wired into the chat reply (the method itself is retained for back-compat / other callers). When
 * chat-live is explicitly enabled (OFF by default), the model sees ONLY the safe set (no declared
 * allergens) and its output passes an allergy-safety OUTPUT gate before it is surfaced.
 *
 * No live LLM by default, no autonomous agents, no vision, no medical/diet advice.
 */
@Injectable()
export class ChatOrchestrationService {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly snapshots: BehavioralContextSnapshotService,
    private readonly chatMessages: ChatMessageService,
    private readonly legacyAi: AiService,
    private readonly grounded: GroundedReplyService,
    private readonly intent: IntentClassifierService,
    private readonly analytics: AnalyticsService,
    private readonly assist: AiAssistService,
  ) {}

  private readonly logger = new Logger('ChatOrchestration');

  async handleChat(input: HandleChatInput): Promise<HandleChatResult> {
    const conversationId = input.conversationId ?? randomUUID();
    // D1 live per-request context — sanitized + DARK-captured on the turn event (no routing/grounding change yet).
    const turnContext = this.sanitizeTurnContext(input.context);

    // DARK cost-governor wiring (AI_MASTER_SPEC P0): run the deterministic IntentClassifier on EVERY turn and
    // RECORD its decision — but do NOT yet change routing (the model tiers need live Gemini, still OFF). This
    // makes the classifier execute (it was dead code) so its real-traffic accuracy can be measured before any
    // activation gate. The §3 stated_constraint→confirm-write SAFETY route IS active below (deterministic, zero-
    // Gemini); the model-tier routing (medical→refuse, CHEAP/STRONG) stays dark until live Gemini is gated on.
    const intentDecision = this.intent.classify(input.prompt, { locale: 'fa' });
    this.logger.log(
      `intent ${JSON.stringify({ intent: intentDecision.intent, tier: intentDecision.tier, dataScope: intentDecision.dataScope, safetyRelevant: intentDecision.safetyRelevant, confidence: intentDecision.confidence })}`,
    );

    const snapshot = await this.snapshots.build(input.userId, { locale: 'fa' });
    // The user's template locale (fa/nl/en from User.locale) — every deterministic reply renders in it.
    const locale = await this.grounded.getLocale(input.userId);
    // Short-term memory feeds TWO deliberately-separated consumers:
    //  - memoryPrompt: the full untrusted, annotated block for the LIVE model context (live rails only).
    //  - retrievalQuery: a CLEAN conversational query (recent user turns + current turn) for grounding, so a
    //    follow-up like «برای ۶ نفر» still retrieves on the prior dish WITHOUT the scaffolding labels
    //    polluting the recipe search. Conflating the two dead-ends every turn-2 retrieval.
    const recentTurns = await this.loadRecentMemoryTurns(input.userId, conversationId);
    const memoryPrompt = this.composeMemoryPrompt(recentTurns, input.prompt);
    const retrievalQuery = this.composeRetrievalQuery(recentTurns, input.prompt);

    // persist the user's message around orchestration
    await this.chatMessages.create({
      userId: input.userId,
      conversationId,
      role: 'user',
      content: input.prompt,
    });

    // §3 CONVERSATIONAL-ALLERGY (ACTIVE, deterministic, zero-Gemini): a mid-chat allergy DECLARATION must never be
    // silently ignored. Detect → extract the named allergen(s) → offer CONFIRM-then-write (decision D2). We never
    // auto-write (a misheard line must not fabricate an allergy) and never rely on the LLM summary for safety; the
    // user's one-tap confirm hits POST /users/allergies and the deterministic hard gate then filters it.
    //
    // GUARDIAN-HARDENED: the classifier flags stated_constraint on the mere presence of an allergy noun, so a
    // QUESTION ("آیا گردو برای آلرژیم خطرناکه؟") or a RETRACTION ("دیگه به گردو حساس نیستم") also lands here. Neither
    // should produce an ADD offer — gate the WRITE route on a declaration shape (not interrogative, not negated) and
    // let everything else fall through to the normal grounded path.
    if (intentDecision.intent === 'stated_constraint' && this.isAllergyDeclaration(input.prompt)) {
      const allergens = extractStatedAllergens(input.prompt);
      const reply = allergens.length
        ? t('allergy_offer', locale, { names: allergens.map((a) => a.label).join(t('list_sep', locale)) })
        : t('allergy_offer_unknown', locale);
      const assistantMessage = await this.chatMessages.create({
        userId: input.userId,
        conversationId,
        role: 'assistant',
        content: reply,
        model: STUB_MODEL,
        contentSafetyStatus: 'ok',
      });
      await this.recordAssistantTurnEvent(input.userId, conversationId, assistantMessage?.id, intentDecision, {
        status: 'ok',
        providerMode: 'deterministic',
        model: STUB_MODEL,
        aiCallLogId: null,
        suggestedActionType: allergens.length ? 'add_allergy' : null,
        turnContext,
      });
      return {
        reply,
        conversationId,
        status: 'ok',
        providerMode: 'deterministic',
        aiCallLogId: null,
        intent: intentDecision,
        ...(allergens.length ? { suggestedAction: { type: 'add_allergy' as const, allergens } } : {}),
      };
    }

    // INTENT-AWARE ROUTING (deterministic): non-recipe intents must NOT fall through to recipe grounding (which
    // would answer a "thank you", a weather question, or a medical question with an irrelevant recipe list).
    // The classifier already labels these; give each an on-brand, SAFE canned reply. Safety intents (medical)
    // get a clear non-medical decline. Allergy DECLARATION (§3) is handled above and never reaches here.
    const intentReply = this.intentRoutedReply(intentDecision.intent, locale);
    if (intentReply) {
      return this.respondDeterministicTurn(input, conversationId, intentDecision, intentReply);
    }

    // Nutrition: answer «کالریِ برنج چقدره؟» with the FACTUAL per-100g USDA data from the ingredient dictionary
    // (numbers, not health claims), or an honest fallback. Never medical/diet advice.
    // GUARD: «صبحانهٔ پر پروتئین چی بپزم؟» carries «پروتئین» so the classifier calls it nutrition — but it is a
    // DISCOVERY turn (a meal/diet/region/time criterion is present). Routing it to the ingredient-nutrition path
    // produced absurd answers (espresso calories for "high-protein breakfast"). If the query carries ANY discovery
    // criterion, fall THROUGH to the grounded recipe path; only a criterion-less «X چقدر پروتئین داره» stays here.
    if (intentDecision.intent === 'nutrition_query') {
      const pq = parseSearchQuery(input.prompt);
      const isDiscovery = pq.mealTypes.length > 0 || pq.diets.length > 0 || pq.regions.length > 0 || pq.maxCookingTime != null;
      if (!isDiscovery) {
        return this.respondDeterministicTurn(input, conversationId, intentDecision, await this.composeNutritionReply(input.prompt, locale));
      }
    }

    // INTENT-AWARE ROUTING (deterministic): a during-cook problem ("چرا برنجم شفته شد؟") wants TROUBLESHOOTING,
    // not a recipe list. The curated KB matcher (dish + symptom) is a HIGH-PRECISION detector — richer than the
    // classifier's anchor list — so trigger on EITHER the classifier intent OR a concrete KB match («چسبید»/
    // «خشک شد»/«لعاب نداره» that the classifier misses). No match → ask for the dish + symptom, never a recipe
    // dump. (The infinite tail of arbitrary "why did X happen" is the live L2a assistant, gated.)
    if (this.shouldTroubleshoot(input.prompt, intentDecision.intent)) {
      return this.respondDeterministicTurn(input, conversationId, intentDecision, this.composeTroubleshootingReply(input.prompt, locale));
    }

    // INTENT-AWARE ROUTING (deterministic): a substitution question ("جایگزینِ ماست چی بزنم؟") wants a SWAP,
    // not a recipe list. Route it to the grounded, allergy-filtered SubstitutionEngine (via AiAssistService,
    // which also applies the nutrition-claim guard). Medical/§3 already classified earlier and never reach here.
    // If nothing resolves (no ingredient named / not in the dictionary / profile unavailable) we fall THROUGH to
    // the normal grounded recipe reply — never a dead-end, never an unfiltered/unsafe answer.
    if (intentDecision.intent === 'substitution') {
      const handled = await this.tryAnswerSubstitution(input, conversationId, intentDecision, locale);
      if (handled) return handled;
    }

    // RECIPE DELIVERY: «دستورِ سوپ شیر» / «سوپ شیر رو کامل بده» / a bare exact dish name — the chat DELIVERS the
    // real recipe inline, never «برو صفحه‌اش». We deliver ONLY a recipe the user CONFIDENTLY NAMED (its title is
    // covered by this turn's content tokens) — so a vague «همون رو بده» (no dish named) never confidently delivers
    // the WRONG recipe (it falls through and the assistant asks them to name the dish). Quantities/steps come from
    // the DB, never the model. (Pronoun «همون»→prior-dish resolution needs persisted recommend-state — task #22.)
    if (this.wantsRecipeDetail(input.prompt)) {
      const g = await this.grounded.buildGrounding(input.userId, retrievalQuery, snapshot);
      // The dish named in THIS turn («دستورِ سوپ شیر») wins; for a bare «دستورش رو بده» fall back to the
      // memory-enriched query so a dish named a turn ago still resolves. The specificity guard in pickDeliverTarget
      // means a pronoun/generic that names nothing delivers NOTHING (→ falls through, the assistant asks the name).
      const current = parseSearchQuery(input.prompt).include;
      const tokens = current.length ? current : parseSearchQuery(retrievalQuery).include;
      // try EVERY confidently-named match until one yields real DB content (guards against a same-titled recipe
      // that has no GRIS steps shadowing the one that does).
      for (const target of this.deliverCandidates(tokens, g.safeRecipes)) {
        const detail = await this.grounded.getRecipeContent(target.id);
        if (detail) {
          return this.respondDeterministicTurn(input, conversationId, intentDecision, this.composeRecipeDetailReply(detail, locale));
        }
      }
    }

    // CONFIDENCE-DRIVEN CLARIFY (D1 P1): a genuinely AMBIGUOUS discovery turn — the classifier found no/low
    // signal AND the (memory-enriched) query carries NO actionable content (no ingredient, dish, constraint or
    // diet) — asks ONE targeted question instead of dumping a topically-random fallback list. ANY concrete
    // signal (an ingredient/constraint, or a follow-up that carries the prior dish via short-term memory) skips
    // this and grounds normally. Safety intents (medical/§3) are already routed above and never reach here.
    if (this.shouldClarifyAmbiguous(retrievalQuery, intentDecision)) {
      return this.respondDeterministicTurn(input, conversationId, intentDecision, t('clarify_vague', locale));
    }

    const chatLiveEnabled = resolveChatLiveEnabled(process.env);

    // LIVE rails only: build the allergy-safe grounding BEFORE the model call so the model sees ONLY
    // the already-filtered SAFE set (NO declared allergens) via a grounded prompt. The deterministic
    // (default) path builds grounding lazily AFTER the guards pass — never for a blocked prompt.
    let grounding: GroundingResult | null = null;
    let orchestratorPrompt = input.prompt;
    if (chatLiveEnabled) {
      grounding = await this.grounded.buildGrounding(input.userId, retrievalQuery, snapshot);
      orchestratorPrompt = this.grounded.buildLivePrompt(memoryPrompt, grounding);
    }

    let status: AiCallStatus;
    let model: string | null = STUB_MODEL;
    let aiCallLogId: string | null = null;
    let blocked = false;
    let reasons: string[] = [];
    let modelText: string | null = null;

    try {
      const result = await this.orchestrator.run({
        userId: input.userId,
        // Guards inspect the UNTRUSTED user input; the model gets the grounded wrapped prompt (when live). This
        // split stops the grounding system-instruction's safety vocabulary from self-blocking every live turn.
        prompt: input.prompt,
        modelPrompt: orchestratorPrompt,
        snapshot,
        surface: 'chat',
        conversationId,
        // Conservative estimate (~4 chars/token + output headroom) so BOTH cost gates project this turn: re-arms
        // the per-request cap for chat AND makes the multi-window budget check projective (consumed + est > cap),
        // not merely retrospective. Tune the headroom when paid Gemini is enabled.
        estimatedTokens: Math.ceil(orchestratorPrompt.length / 4) + 512,
        intent: intentDecision.intent,
        tier: intentDecision.tier,
        cacheHit: false,
        cacheTokens: null,
      });
      status = result.status;
      model = result.model ?? STUB_MODEL;
      aiCallLogId = result.aiCallLogId;
      blocked = result.blocked;
      reasons = result.reasons;
      modelText = result.text; // the post-guarded model output (only surfaced when live chat is enabled)
    } catch (err) {
      // The orchestrator fails fast without a valid snapshot — surface it safely (no leak).
      const rejected = err instanceof MissingBehavioralContextError;
      status = rejected ? 'error' : 'error';
      blocked = true;
      const reply = rejected ? t('blocked_rejected', locale) : t('blocked_error', locale);
      const assistantMessage = await this.chatMessages.create({
        userId: input.userId,
        conversationId,
        role: 'assistant',
        content: reply,
        model: STUB_MODEL,
        contentSafetyStatus: status,
      });
      await this.recordAssistantTurnEvent(input.userId, conversationId, assistantMessage?.id, intentDecision, {
        status,
        providerMode: 'deterministic',
        model: STUB_MODEL,
        aiCallLogId: null,
        blocked: true,
        turnContext,
      });
      return { reply, conversationId, status, providerMode: 'deterministic', aiCallLogId: null, intent: intentDecision };
    }

    // E47-A8 + AI-GROUNDED-ASSISTANT: surface the LIVE, post-guarded model output ONLY when chat-live is
    // explicitly enabled (general live flags + chat kill switch), the orchestrator returned a safe
    // non-empty answer, AND that output PASSES the allergy-safety OUTPUT gate. Otherwise fall back to the
    // GROUNDED, allergy-safe deterministic reply (the safe default) — never the un-filtered legacy reply.
    let reply: string;
    let providerMode: 'gemini' | 'deterministic';
    if (blocked || status === 'error') {
      reply = this.safeBlockedReply(status, reasons, locale);
      providerMode = 'deterministic';
    } else {
      // ensure the allergy-safe grounding is available: already built in live mode; built lazily here
      // for the deterministic default (so a blocked prompt never triggers a needless retrieval).
      const g = grounding ?? (await this.grounded.buildGrounding(input.userId, retrievalQuery, snapshot));
      if (chatLiveEnabled && typeof modelText === 'string' && modelText.trim().length > 0) {
        // live output gate: discard model text that names a declared allergen or a HARD-dropped recipe.
        const screen = await this.grounded.screenLiveOutput(input.userId, modelText, g);
        if (screen.safe) {
          reply = modelText; // passed the orchestrator's outbound guards AND the allergy-safety gate
          providerMode = 'gemini';
        } else {
          reply = (await this.composeEmptyRepair(input.prompt, retrievalQuery, g, locale)) ?? this.grounded.composeDeterministicReply(g, locale);
          providerMode = 'deterministic';
        }
      } else {
        reply = (await this.composeEmptyRepair(input.prompt, retrievalQuery, g, locale)) ?? this.grounded.composeDeterministicReply(g, locale);
        providerMode = 'deterministic';
      }
    }

    const assistantMessage = await this.chatMessages.create({
      userId: input.userId,
      conversationId,
      role: 'assistant',
      content: reply,
      model,
      contentSafetyStatus: status,
      aiCallLogId,
    });
    await this.recordAssistantTurnEvent(input.userId, conversationId, assistantMessage?.id, intentDecision, {
      status,
      providerMode,
      model,
      aiCallLogId,
      blocked,
      turnContext,
    });

    return { reply, conversationId, status, providerMode, aiCallLogId, intent: intentDecision };
  }

  /**
   * Bound the untrusted client-supplied turn context before it is captured/observed. Drops anything malformed;
   * charset/length-restricts strings; clamps stepIndex. Returns undefined when nothing valid remains. (Defence in
   * depth: this is DARK-captured only today, but sanitizing now means activation later can't surface raw input.)
   */
  private sanitizeTurnContext(raw?: ChatTurnContext): ChatTurnContext | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const out: ChatTurnContext = {};
    if (typeof raw.currentScreen === 'string' && raw.currentScreen.trim()) out.currentScreen = raw.currentScreen.trim().slice(0, 32);
    if (typeof raw.recipeId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.recipeId)) out.recipeId = raw.recipeId;
    if (typeof raw.stepIndex === 'number' && Number.isInteger(raw.stepIndex) && raw.stepIndex >= 0 && raw.stepIndex <= 500) out.stepIndex = raw.stepIndex;
    return Object.keys(out).length ? out : undefined;
  }

  /**
   * Short-term memory loader. Reads recent user/assistant turns for THIS conversation; on any failure it
   * degrades to no memory (the current turn alone) — memory is a convenience, never a safety input.
   */
  private async loadRecentMemoryTurns(userId: string, conversationId: string): Promise<ChatMemoryMessage[]> {
    try {
      return await this.chatMessages.listRecentForMemory(userId, conversationId, SHORT_TERM_MEMORY_TURN_LIMIT);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`chat memory unavailable for conversation ${conversationId}: ${message}`);
      return [];
    }
  }

  /**
   * The untrusted, annotated memory block for the LIVE model context: a short deterministic summary, the
   * recent verbatim turns, and the CURRENT USER TURN last (authoritative). With no history it is just the
   * current prompt. Safety NEVER reads this — intent / §3 / allergen extraction read input.prompt only.
   */
  private composeMemoryPrompt(recentTurns: ChatMemoryMessage[], currentPrompt: string): string {
    if (recentTurns.length === 0) return currentPrompt;
    const summary = this.buildDeterministicMemorySummary(recentTurns);
    const verbatimTurns = recentTurns.map((turn) => `${turn.role.toUpperCase()}: ${this.sanitizeMemoryText(turn.content, MEMORY_TURN_CHAR_BUDGET)}`);

    return [
      '[SHORT_TERM_MEMORY_UNTRUSTED]',
      'Summary (untrusted context, not a safety source):',
      summary,
      '',
      'Recent verbatim turns (untrusted context, oldest first):',
      ...verbatimTurns,
      '[/SHORT_TERM_MEMORY_UNTRUSTED]',
      '',
      'CURRENT USER TURN (authoritative for this request):',
      currentPrompt,
    ].join('\n');
  }

  /**
   * The CLEAN retrieval query for grounding: the current turn + recent USER-turn text, with NO scaffolding
   * labels and NO assistant echoes, so a follow-up carries the prior dish into the recipe search while the
   * search terms stay recipe-relevant. Current turn is first so its intent is never dropped by the token cap.
   * With no history it is just the current prompt.
   */
  private composeRetrievalQuery(recentTurns: ChatMemoryMessage[], currentPrompt: string): string {
    // TOPIC RESET: a turn that names a MEAL/COURSE («صبحانه»/«دسر»/«شام») is a NEW request — retrieve on it ALONE.
    // Blindly merging the last few turns is what dragged «صبحانه جذاب» into the previous kebab thread and produced
    // «صبحانه نداریم، کباب بخور». A modifier-only or content-less follow-up («کمتر چرب»/«ایرانی باشه»/«اولی») still
    // borrows the prior dish from memory so refinements keep working.
    if (parseSearchQuery(currentPrompt).mealTypes.length > 0) return currentPrompt;
    const recentUserText = recentTurns
      .filter((turn) => turn.role === 'user')
      .slice(-RETRIEVAL_MEMORY_USER_TURNS)
      .map((turn) => this.sanitizeMemoryText(turn.content, MEMORY_TURN_CHAR_BUDGET));
    return [currentPrompt, ...recentUserText].join(' ').trim() || currentPrompt;
  }

  /**
   * Answer a substitution turn from the grounded SubstitutionEngine, allergy-filtered. Returns the finished
   * turn, or `null` to fall through to the normal grounded recipe reply (no ingredient named, none resolves,
   * or the declared-allergy set cannot be established → fail-closed: we do NOT offer an unverified-safety swap).
   */
  private async tryAnswerSubstitution(
    input: HandleChatInput,
    conversationId: string,
    intentDecision: IntentClassification,
    locale: Locale,
  ): Promise<HandleChatResult | null> {
    const targets = extractSubstitutionTargets(input.prompt);
    if (targets.length === 0) return null;

    // SAFETY: source the avoid-set from the SAME reconciled profile the hard gate uses. null = profile
    // unavailable → do NOT call the tool with an empty avoid-set (that would be unfiltered) → fall through.
    const avoidAllergens = await this.grounded.getDeclaredAllergens(input.userId);
    if (avoidAllergens === null) return null;

    for (const ingredient of targets.slice(0, SUBSTITUTION_MAX_CANDIDATES)) {
      let result: any;
      try {
        result = await this.assist.substitutions(input.userId, { ingredient, avoidAllergens });
      } catch {
        return null; // missing snapshot / tool failure → fall through to the safe grounded path
      }
      const status = result?.resultStatus;
      // 'ok' (found swaps) and 'no_substitution_data' (ingredient resolved, none recorded) are both honest,
      // on-topic answers — BUT only when the resolution is CONFIDENT. The USDA dictionary has no colloquial
      // base rows, so «کره» can resolve to «کره سیب» (apple butter); a confidently-WRONG answer is worse than
      // none. If the resolved ingredient is not the user's term (or its base+modifier), keep trying / fall
      // through to the safe grounded path. 'ingredient_not_found' / 'empty_query' → try the next candidate.
      if (status === 'ok' || status === 'no_substitution_data') {
        // Accept when the resolved ingredient is a confident match for EITHER the raw term OR its curated alias
        // (e.g. «گوجه»→«گوجه‌فرنگی خام», whose canonical isn't a bare modifier extension of «گوجه»).
        const resolvedName = result?.resolved?.name;
        if (
          isConfidentIngredientMatch(ingredient, resolvedName) ||
          isConfidentIngredientMatch(aliasIngredient(ingredient), resolvedName)
        ) {
          return this.respondDeterministicTurn(input, conversationId, intentDecision, this.composeSubstitutionReply(result, locale));
        }
      }
    }
    // Nothing resolved. Answer HONESTLY («برای «X» جایگزینی پیدا نکردم») rather than falling through to a
    // topically-irrelevant recipe list WHEN the request is UNAMBIGUOUSLY a substitution — either high overall
    // confidence, OR the prompt carries an EXPLICIT substitute noun (جایگزین/جانشین/substitute). The explicit
    // noun matters because a «چیه» suffix («جایگزین شکر چیه») drops the score to medium, yet the intent is clear.
    // A mixed «به جای X چی بپزم» (no explicit noun + recipe-discovery signal) still falls through to grounding.
    const explicitSubNoun = /جایگزین|جانشین|جیگزین|جاگزین|substitut|vervang/i.test(input.prompt);
    if (intentDecision.confidence === 'high' || explicitSubNoun) {
      const named = { resolved: { name: targets[0] }, substitutions: [] };
      return this.respondDeterministicTurn(input, conversationId, intentDecision, this.composeSubstitutionReply(named, locale));
    }
    return null;
  }

  /**
   * Deterministic, on-brand replies for non-recipe intents so they don't fall through to recipe grounding.
   * Returns null for recipe-bearing intents (recipe_discovery, timer, ingredient_facts, scaling-with-context…)
   * so they continue to the grounded path. SAFE by construction — medical gets a clear non-medical decline.
   */
  private intentRoutedReply(intent: IntentClassification['intent'], locale: Locale): string | null {
    switch (intent) {
      case 'greeting_smalltalk': return t('greeting', locale);
      case 'feedback': return t('feedback_thanks', locale);
      case 'medical_or_health_advice': return t('medical_decline', locale);
      case 'out_of_domain': return t('out_of_domain', locale);
      // nutrition_query is handled by an async DB-backed branch (composeNutritionReply), not here.
      case 'technique_whyitworks': return t('technique_to_cookmode', locale);
      // NOTE: scaling is deliberately NOT routed here — a follow-up like «برای ۶ نفر» should carry the prior
      // dish into grounding (short-term memory), so it falls through to the grounded path.
      default:
        return null;
    }
  }

  /**
   * D1 P1 — should this turn ask ONE clarifying question instead of grounding? YES only when the turn is a
   * discovery-ish intent the classifier was UNSURE about (low_confidence_fallback, or a weak recipe_discovery)
   * AND the memory-enriched query has NO actionable content at all — no include term, no excluded term, no diet.
   * That is the genuinely ambiguous case («یه چیزی بپز», «گرسنمه») where any retrieval would be a topically-random
   * guess. A single ingredient/constraint, or a follow-up carrying the prior dish, makes `include`/`exclude`/
   * `diets` non-empty → we ground instead. Deterministic; no model call; never reached by safety intents.
   */
  private shouldClarifyAmbiguous(query: string, intent: IntentClassification): boolean {
    if (intent.intent !== 'low_confidence_fallback' && intent.intent !== 'recipe_discovery') return false;
    // The real gate is ACTIONABLE CONTENT, not the classifier's intent-confidence: «چی بپزم» is a confident
    // discovery intent yet carries nothing to search on. If parse finds any include term / excluded term / diet,
    // we ground; only a truly content-less query clarifies. (A confident discovery WITH an ingredient never
    // reaches here — its `include` is non-empty.)
    const p = parseSearchQuery(query);
    // CRITERIA (region «خارجی» / mealType «شام» / cookingTime «سریع») are ACTIONABLE too — they retrieve a real
    // metadata-filtered set, so a criteria-only turn must GROUND, never clarify.
    return (
      p.include.length === 0 && p.exclude.length === 0 && p.diets.length === 0 &&
      p.regions.length === 0 && p.mealTypes.length === 0 && p.maxCookingTime == null
    );
  }

  /** Does this turn want the FULL recipe (ingredients + steps), not just a recommendation? */
  private wantsRecipeDetail(prompt: string): boolean {
    const x = normalizeText(prompt);
    // (a) explicit recipe-detail phrasing, OR (b) a "deliver the one we're talking about" pick — «همون/اون/این یکی
    // رو بده/می‌خوام/کامل/بپز». Both DELIVER the real DB recipe inline. Note: bare «بده» is intentionally NOT here —
    // «یه غذای تند بده» wants a LIST, not one full recipe; only an explicit detail/pick phrase delivers.
    // «دستورِ سوپ شیر» normalizes to «دستور سوپ شیر» (ezafe stripped) — so «دستور پخت» wouldn't match. Trigger on the
    // bare recipe nouns «دستور/طرز/رسپی/مراحل» (+ «کاملش»/«چطور درست») — delivery is still GATED by a confidently
    // named dish (deliverCandidates), so a recipe-less «یه دستور بده» just falls through to discovery.
    return /دستور|طرز|رسپی|مراحل|کاملش|کامل ?بده|چطور ?(درست|بپزم|بپزه|درستش|می ?پزن)/.test(x)
      || /(همون|همونو|اون|اونو|این یکی|همین)\s*(رو|و)?\s*(بده|بنویس|می ?خوام|کامل|بپز|دستور|طرز)/.test(x);
  }

  /**
   * The recipe to DELIVER inline, or null. Returns a safe recipe ONLY when the user CONFIDENTLY named it — every
   * content token of this turn appears in the recipe title, AND the match is specific (≥2 tokens, or the single
   * token IS the whole title). A lone generic dish-class word («سوپ»/«کباب») never delivers — that lists. This is
   * what stops a vague «همون رو بده» or a loose category from confidently delivering the WRONG recipe.
   */
  private deliverCandidates(namedTokens: string[], safe: { id: string; title: string }[]): { id: string; title: string }[] {
    const tokens = namedTokens.map((t) => foldPersian(t)).filter((t) => t.length >= 2);
    if (!tokens.length) return [];
    // every named token is in the title, AND the match is specific: ≥2 tokens, OR the single token is a real dish
    // name (not a generic class word like «سوپ»/«کباب», which must LIST its options rather than dump one recipe).
    return safe.filter((r) => {
      const title = foldPersian(r.title);
      return tokens.every((t) => title.includes(t)) && (tokens.length >= 2 || !DELIVER_GENERIC_DISH.has(tokens[0]));
    });
  }

  /** Present a recipe’s ACTUAL ingredients + steps (from the DB, deterministic) — the chat DELIVERS the recipe. */
  private composeRecipeDetailReply(
    detail: { title: string; ingredients: { name: string; amount: string | null }[]; steps: { title: string; detail: string | null }[] },
    locale: Locale,
  ): string {
    const lines: string[] = [t('assistant_header', locale), '', `**${detail.title}**`];
    if (detail.ingredients.length) {
      lines.push('', '**مواد لازم:**');
      for (const ing of detail.ingredients.slice(0, 30)) lines.push(`• ${ing.name}${ing.amount ? ` — ${ing.amount}` : ''}`);
    }
    if (detail.steps.length) {
      lines.push('', '**مراحل پخت:**');
      detail.steps.slice(0, 20).forEach((s, i) => lines.push(`${i + 1}. ${s.title}${s.detail ? `\n   ${s.detail}` : ''}`));
    }
    lines.push('', t('cooking_guidance_note', locale));
    return lines.join('\n');
  }

  /**
   * D1 conversational REPAIR — when grounding came back empty (and NOT because of an allergy drop, which has
   * its own message), don't dead-end with a generic "I didn't get it". Convert the highest-confidence signal we
   * DID parse into ONE concrete next step:
   *   1) a CONSTRAINT the user gave («بدون پیاز» / vegan / zonder…) emptied the set → offer to relax it;
   *   2) a RECOGNIZED ingredient (real in the dictionary) with no full dish → offer its substitutes.
   * Returns null (→ fall back to the generic neutral clarifier) when there is no actionable signal. Never
   * touches the allergy-safe set; purely additive framing over the SAME empty result.
   */
  private async composeEmptyRepair(prompt: string, query: string, g: GroundingResult, locale: Locale): Promise<string | null> {
    if (g.groundingStatus !== 'empty' || g.droppedForAllergy > 0) return null; // ok / allergy / unavailable → composer handles it
    const parsed = parseSearchQuery(query);
    if (parsed.exclude.length > 0 || parsed.diets.length > 0) {
      return t('repair_constraint', locale);
    }
    for (const term of [...extractSubstitutionTargets(prompt), ...extractNutritionTargets(prompt)].slice(0, 4)) {
      const n = await this.grounded.getIngredientNutrition(term);
      if (n?.name) return t('repair_ingredient', locale, { name: n.name });
    }
    return null;
  }

  /** Factual per-100g nutrition readout for an ingredient (USDA-sourced), or an honest ask. No health claims. */
  private async composeNutritionReply(prompt: string, locale: Locale): Promise<string> {
    const header = t('assistant_header', locale);
    const num = (n: unknown) => (locale === 'fa' ? String(n ?? '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : String(n ?? ''));
    for (const term of extractNutritionTargets(prompt).slice(0, 3)) {
      const n = await this.grounded.getIngredientNutrition(term);
      if (!n) continue;
      const p = n.per100g || {};
      const parts: string[] = [];
      if (p.calories != null) parts.push(t('nutrient_calories', locale, { v: num(p.calories) }));
      if (p.protein != null) parts.push(t('nutrient_protein', locale, { v: num(p.protein) }));
      if (p.carbs != null) parts.push(t('nutrient_carbs', locale, { v: num(p.carbs) }));
      if (p.fat != null) parts.push(t('nutrient_fat', locale, { v: num(p.fat) }));
      if (p.fiber != null) parts.push(t('nutrient_fiber', locale, { v: num(p.fiber) }));
      if (!parts.length) break;
      const line = t('nutrition_line', locale, { name: n.name, parts: parts.join(t('list_sep', locale)) });
      return `${header}\n\n${line}\n\n${t('nutrition_disclaimer', locale)}`;
    }
    return `${header}\n\n${t('nutrition_ask', locale)}`;
  }

  /**
   * Should this turn be answered as a during-cook PROBLEM? Yes if the classifier said so. Otherwise the KB
   * matcher (dish + symptom) is high-precision but can over-fire on a REQUEST/DESIRE that merely mentions a
   * symptom-shaped adjective («جایگزین گوشت سفت», «کیک خشک دوست دارم»). Suppress those: a substitution or
   * recipe-discovery turn, or an explicit desire phrase, is NOT a problem report.
   */
  private shouldTroubleshoot(prompt: string, intent: IntentClassification['intent']): boolean {
    if (intent === 'during_cook_problem') return true;
    if (!matchTroubleshooting(prompt)) return false;
    if (intent === 'substitution' || intent === 'recipe_discovery') return false;
    if (/دوست دارم|دوست داری|میخوام|میخواهم|میخوای|می خوام|هوس|میل دارم|عاشق/.test(normalizeText(prompt))) return false;
    return true;
  }

  /** Answer a during-cook problem from the curated troubleshooting KB, or honestly ask for the dish + symptom. */
  private composeTroubleshootingReply(prompt: string, locale: Locale): string {
    const header = t('assistant_header', locale);
    const entry = matchTroubleshooting(prompt);
    if (!entry) return `${header}\n\n${t('ts_ask', locale)}`;
    // The cause/fix/prevent CONTENT is Persian (the KB) — its nl/en translation is corpus-i18n (Dimension 7);
    // the FRAME (labels + note) is localized here.
    return [
      header,
      '',
      t('ts_why', locale, { cause: entry.cause }),
      t('ts_now', locale, { fix: entry.fix }),
      t('ts_next', locale, { prevent: entry.prevent }),
      '',
      t('cooking_guidance_note', locale),
    ].join('\n');
  }

  /** Render a substitution tool result as a safe reply (localized FRAME; the swap names/notes are corpus data). */
  private composeSubstitutionReply(result: any, locale: Locale): string {
    const header = t('ai_disclosure_header', locale);
    const name = result?.resolved?.name ?? '—';
    const subs = Array.isArray(result?.substitutions) ? result.substitutions : [];
    const note = typeof result?.note === 'string' && result.note.trim() ? result.note.trim() : '';
    if (subs.length === 0) {
      const body = note || t('substitution_none', locale, { name });
      return `${header}\n\n${body}`;
    }
    const lines = subs.slice(0, 5).map((s: any) => {
      const why = typeof s?.why === 'string' && s.why.trim()
        ? s.why.trim()
        : typeof s?.reason === 'string' ? s.reason.trim() : '';
      return why ? `**${s?.name}** — ${why}` : `**${s?.name}**`;
    });
    const intro = t('substitution_intro', locale, { name });
    // the tool `note` is corpus-language content (Dim 7); the fixed safety hedge is localized
    const footer = `${note ? `${note}\n` : ''}${t('substitution_footer', locale)}`;
    return `${header}\n\n${intro}\n\n${lines.join('\n')}\n\n${footer}`;
  }

  /** Persist the assistant message + emit the tier-tagged turn event for a deterministic, non-blocked reply. */
  private async respondDeterministicTurn(
    input: HandleChatInput,
    conversationId: string,
    intentDecision: IntentClassification,
    reply: string,
  ): Promise<HandleChatResult> {
    const assistantMessage = await this.chatMessages.create({
      userId: input.userId,
      conversationId,
      role: 'assistant',
      content: reply,
      model: STUB_MODEL,
      contentSafetyStatus: 'ok',
    });
    await this.recordAssistantTurnEvent(input.userId, conversationId, assistantMessage?.id, intentDecision, {
      status: 'ok',
      providerMode: 'deterministic',
      model: STUB_MODEL,
      aiCallLogId: null,
      turnContext: this.sanitizeTurnContext(input.context),
    });
    return { reply, conversationId, status: 'ok', providerMode: 'deterministic', aiCallLogId: null, intent: intentDecision };
  }

  private buildDeterministicMemorySummary(turns: ChatMemoryMessage[]): string {
    const joined = turns.map((turn) => `${turn.role}: ${this.sanitizeMemoryText(turn.content, 240)}`).join(' | ');
    return this.sanitizeMemoryText(joined, MEMORY_SUMMARY_CHAR_BUDGET);
  }

  private sanitizeMemoryText(value: string, maxChars: number): string {
    const collapsed = value.replace(/\s+/g, ' ').trim();
    if (collapsed.length <= maxChars) return collapsed;
    return `${collapsed.slice(0, Math.max(0, maxChars - 3))}...`;
  }
  private async recordAssistantTurnEvent(
    userId: string,
    conversationId: string,
    messageId: string | undefined,
    intent: IntentClassification,
    meta: {
      status: AiCallStatus;
      providerMode: 'gemini' | 'deterministic';
      model: string | null;
      aiCallLogId: string | null;
      blocked?: boolean;
      suggestedActionType?: string | null;
      turnContext?: ChatTurnContext;
    },
  ): Promise<void> {
    await this.analytics.trackEvent({
      userId,
      type: EventType.AI_SUGGESTION_GENERATED,
      page: 'chat',
      payload: {
        conversationId,
        messageId: messageId ?? null,
        aiCallLogId: meta.aiCallLogId,
        status: meta.status,
        providerMode: meta.providerMode,
        model: meta.model,
        blocked: !!meta.blocked,
        intent: intent.intent,
        tier: intent.tier,
        dataScope: intent.dataScope,
        safetyRelevant: intent.safetyRelevant,
        confidence: intent.confidence,
        suggestedActionType: meta.suggestedActionType ?? null,
        // D1 live context (DARK observability): WHERE the turn happened, when the client supplies it.
        currentScreen: meta.turnContext?.currentScreen ?? null,
        contextRecipeId: meta.turnContext?.recipeId ?? null,
        stepIndex: meta.turnContext?.stepIndex ?? null,
      },
    }).catch((err) => {
      this.logger.debug(`assistant turn event skipped: ${err?.message ?? err}`);
    });
  }

  /**
   * Is the turn a genuine allergy DECLARATION (vs a question or a retraction)? Deterministic, zero-LLM. Only a
   * declaration earns the §3 confirm-then-write offer; an interrogative or a RETRACTION must not.
   *
   * GUARDIAN-HARDENED (final): POSITIVE-ASSERTION-FIRST instead of a fragile sliding negation window. If ANY
   * positively-asserted allergy phrase is present (حساسم / حساسیت دارم / "allergic to"), it IS a declaration —
   * even when a SEPARATE clause negates a DIFFERENT food ("به شیر حساسیت دارم به پسته حساس نیستم"). The positive
   * verb دارم is distinguished from the negated ندارم by a negative lookbehind for ن. Only when NO positive
   * assertion exists do the retraction patterns suppress (e.g. «حساسیت به گردو ندارم», "not allergic to nuts").
   */
  private isAllergyDeclaration(prompt: string): boolean {
    const t = normalizeText(prompt);
    if (!t) return false;
    // questions are never a declaration
    if (/[؟?]/.test(t)) return false; // explicit question mark
    if (/^(ایا|مگه|مگر|is |are |am i |do |does |can |could |should |would |what |which |how |why |when )/.test(t)) return false; // «am i …?» (not the elliptical «am allergic …»)
    // POSITIVE allergy assertion → declaration, regardless of any later negation about another food.
    if (/حساسم|حساسه|حساسن|حساسند/.test(t)) return true; // «به X حساسم» (positive copula)
    if (/(حساسیت|الرژی|آلرژی).{0,15}(?<!ن)(دارم|داری|داره|دارد|داریم|دارند)/.test(t)) return true; // «حساسیت [به X] دارم» — NOT «ندارم»
    if (/\b(?:im|i am|am|are) allergic\b/.test(t) && !/\b(not|never|no longer) allergic\b/.test(t)) return true; // English positive
    // No positive assertion found → treat negated-allergy / retraction phrasings as suppression.
    if (/(حساسیت|الرژی|آلرژی|حساس).{0,20}(نیست|نبود|ندار|نداشت)/.test(t)) return false; // «حساس/حساسیت … نیست/ندار»
    if (/(دیگه|دیگر).{0,20}(نمیخورم|نمیخورمش|نمیخوام)/.test(t)) return false; // «دیگه … نمیخورم»
    if (/\b(not|never|no longer) (allergic|sensitive)\b/.test(t)) return false;
    if (/\bno (allergy|allergies)\b/.test(t)) return false;
    if (/\b(dont|doesnt|didnt) have (an?|any)?\s?(\w+\s){0,2}allerg/.test(t)) return false; // «dont have [a/any] [nut] allergy»
    return true;
  }

  /** Deterministic, safe responses for blocked calls — no medical/vision/diet claims, no pretend AI. */
  private safeBlockedReply(status: AiCallStatus, reasons: string[] = [], locale: Locale = 'fa'): string {
    // E47-A7: explicit "image analysis unavailable" message when a vision request is refused.
    if (status === 'blocked_safety' && reasons.includes('fake_vision_claim')) {
      return t('blocked_vision', locale);
    }
    switch (status) {
      case 'blocked_injection': return t('blocked_injection', locale);
      case 'blocked_safety': return t('blocked_safety', locale);
      case 'blocked_nutrition': return t('blocked_nutrition', locale);
      case 'blocked_cost': return t('blocked_cost', locale);
      case 'error':
      default:
        return t('blocked_error', locale);
    }
  }
}

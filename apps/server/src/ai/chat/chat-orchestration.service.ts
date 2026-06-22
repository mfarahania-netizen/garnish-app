import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service';
import { IntentClassifierService, IntentClassification, normalizeText } from '../intent/intent-classifier.service';
import { extractStatedAllergens, ExtractedAllergen } from '../intent/allergen-extractor';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';
import { ChatMessageService } from './chat-message.service';
import { AiService } from '../ai.service';
import { GroundedReplyService, GroundingResult } from './grounded-reply.service';
import { AiCallStatus, MissingBehavioralContextError } from '../ai-core.types';
import { resolveChatLiveEnabled } from '../providers/model-provider.factory';

export interface HandleChatInput {
  userId: string;
  prompt: string;
  conversationId?: string;
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
  ) {}

  private readonly logger = new Logger('ChatOrchestration');

  async handleChat(input: HandleChatInput): Promise<HandleChatResult> {
    const conversationId = input.conversationId ?? randomUUID();

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
        ? `متوجه شدم که به ${allergens.map((a) => a.label).join('، ')} حساسیت داری. می‌خوای به پروفایلت اضافه‌اش کنم تا همیشه از غذاهات حذفش کنم و ایمن بمونی؟`
        : 'به‌نظر رسید یک حساسیت گفتی، ولی مطمئن نشدم دقیقاً کدوم ماده — اسمش رو بگو یا توی پروفایلت اضافه‌اش کن تا همیشه ایمن نگهت دارم.';
      await this.chatMessages.create({
        userId: input.userId,
        conversationId,
        role: 'assistant',
        content: reply,
        model: STUB_MODEL,
        contentSafetyStatus: 'ok',
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

    const chatLiveEnabled = resolveChatLiveEnabled(process.env);

    // LIVE rails only: build the allergy-safe grounding BEFORE the model call so the model sees ONLY
    // the already-filtered SAFE set (NO declared allergens) via a grounded prompt. The deterministic
    // (default) path builds grounding lazily AFTER the guards pass — never for a blocked prompt.
    let grounding: GroundingResult | null = null;
    let orchestratorPrompt = input.prompt;
    if (chatLiveEnabled) {
      grounding = await this.grounded.buildGrounding(input.userId, input.prompt, snapshot);
      orchestratorPrompt = this.grounded.buildLivePrompt(input.prompt, grounding);
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
        prompt: orchestratorPrompt,
        snapshot,
        surface: 'chat',
        conversationId,
        // Conservative estimate (~4 chars/token + output headroom) so BOTH cost gates project this turn: re-arms
        // the per-request cap for chat AND makes the multi-window budget check projective (consumed + est > cap),
        // not merely retrospective. Tune the headroom when paid Gemini is enabled.
        estimatedTokens: Math.ceil(orchestratorPrompt.length / 4) + 512,
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
      const reply = rejected
        ? 'در حال حاضر امکان پردازش این درخواست نیست. لطفاً بعداً دوباره تلاش کن.'
        : 'مشکلی پیش اومد. لطفاً دوباره تلاش کن.';
      await this.chatMessages.create({
        userId: input.userId,
        conversationId,
        role: 'assistant',
        content: reply,
        model: STUB_MODEL,
        contentSafetyStatus: status,
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
      reply = this.safeBlockedReply(status, reasons);
      providerMode = 'deterministic';
    } else {
      // ensure the allergy-safe grounding is available: already built in live mode; built lazily here
      // for the deterministic default (so a blocked prompt never triggers a needless retrieval).
      const g = grounding ?? (await this.grounded.buildGrounding(input.userId, input.prompt, snapshot));
      if (chatLiveEnabled && typeof modelText === 'string' && modelText.trim().length > 0) {
        // live output gate: discard model text that names a declared allergen or a HARD-dropped recipe.
        const screen = await this.grounded.screenLiveOutput(input.userId, modelText, g);
        if (screen.safe) {
          reply = modelText; // passed the orchestrator's outbound guards AND the allergy-safety gate
          providerMode = 'gemini';
        } else {
          reply = this.grounded.composeDeterministicReply(g);
          providerMode = 'deterministic';
        }
      } else {
        reply = this.grounded.composeDeterministicReply(g);
        providerMode = 'deterministic';
      }
    }

    await this.chatMessages.create({
      userId: input.userId,
      conversationId,
      role: 'assistant',
      content: reply,
      model,
      contentSafetyStatus: status,
      aiCallLogId,
    });

    return { reply, conversationId, status, providerMode, aiCallLogId, intent: intentDecision };
  }

  /**
   * Is the turn a genuine allergy DECLARATION (vs a question or a retraction)? Deterministic, zero-LLM. Only a
   * declaration earns the §3 confirm-then-write offer; an interrogative or a RETRACTION must not.
   *
   * GUARDIAN-HARDENED: the negation check is SCOPE-AWARE — it suppresses only when the negation ATTACHES to the
   * allergy assertion (حساس نیستم / آلرژی ندارم / "not allergic"), NOT when an unrelated secondary clause merely
   * contains a negation ("به گردو حساسیت دارم ولی پسته مشکلی نداره" is a real walnut declaration). A bare نیست/نداره
   * anywhere would silently DROP common, natural declarations.
   */
  private isAllergyDeclaration(prompt: string): boolean {
    const t = normalizeText(prompt);
    if (!t) return false;
    // questions
    if (/[؟?]/.test(t)) return false; // explicit question mark
    if (/^(ایا|مگه|مگر|is |are |am i |do |does |can |could |should |would |what |which |how |why |when )/.test(t)) return false; // «am i …?» (not the elliptical declaration «am allergic …»)
    // retraction: negation attached to the allergy assertion within the SAME clause. The window stops at a clause
    // separator (. ! ؟ ? ، ؛ newline) AND is forbidden from crossing a contrastive connector (ولی/اما/ولیکن), so
    // an interposed allergen name ("حساسیت به گردو ندارم") is still caught as a retraction, but a genuine
    // declaration whose SECOND clause is negated ("به شیر حساسیت دارم ولی پسته نداره") is NOT suppressed.
    // The window also stops at the common conjunctions و/که/چون. « و » is SPACE-PADDED on purpose: a bare و would
    // terminate inside words ending in و (e.g. گردو) and turn the genuine retraction «حساسیت به گردو ندارم» into a
    // false declaration. که/چون are safe as bare tokens.
    const WIN = '(?:(?!ولی|اما|ولیکن| و |که|چون)[^.!؟?،؛\n]){0,20}';
    if (new RegExp('حساس\\S*' + WIN + '(نیست|نبود)').test(t)) return false; // «حساس [به گردو] نیستم»
    if (new RegExp('(حساسیت|الرژی|آلرژی)' + WIN + '(ندار|نداشت)').test(t)) return false; // «حساسیت [به گردو] ندارم»
    if (new RegExp('(دیگه|دیگر)' + WIN + '(نمیخورم|نمیخورمش|نمیخوام)').test(t)) return false; // «دیگه … نمیخورم»
    // English retraction scoped to the allergy assertion (allow an interposed allergen word + "any")
    if (/\b(not|never|no longer) (allergic|sensitive)\b/.test(t)) return false;
    if (/\bno (allergy|allergies)\b/.test(t)) return false;
    if (/\b(dont|doesnt|didnt) have (an?|any)?\s?(\w+\s){0,2}allerg/.test(t)) return false; // «dont have [a/any] [nut] allergy»
    return true;
  }

  /** Deterministic, safe responses for blocked calls — no medical/vision/diet claims, no pretend AI. */
  private safeBlockedReply(status: AiCallStatus, reasons: string[] = []): string {
    // E47-A7: explicit "image analysis unavailable" message when a vision request is refused.
    if (status === 'blocked_safety' && reasons.includes('fake_vision_claim')) {
      return 'تحلیل تصویر در این نسخه در دسترس نیست؛ من فقط دستیار آشپزی متنی هستم. لطفاً مواد یا اسم غذا را بنویس. (Image analysis is not available in this build.)';
    }
    switch (status) {
      case 'blocked_injection':
        return 'این درخواست قابل پردازش نیست. لطفاً سؤال آشپزی‌ات را ساده و مستقیم بپرس.';
      case 'blocked_safety':
        return 'من فقط دستیار آشپزی گارنیش هستم و نمی‌تونم در زمینهٔ پزشکی، رژیم درمانی یا موارد حساس کمک کنم. لطفاً یک سؤال آشپزی بپرس.';
      case 'blocked_nutrition':
        return 'نمی‌تونم ادعای تغذیه‌ای یا سلامتی بدم؛ اما می‌تونم رسپی و پیشنهاد آشپزی ارائه بدم.';
      case 'blocked_cost':
        return 'درخواست‌های زیادی در این بازه ثبت شده. لطفاً کمی بعد دوباره امتحان کن.';
      case 'error':
      default:
        return 'مشکلی پیش اومد. لطفاً دوباره تلاش کن.';
    }
  }
}

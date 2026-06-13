import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';
import { ChatMessageService } from './chat-message.service';
import { AiService } from '../ai.service';
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
}

const STUB_MODEL = 'stub-model-v0';

/**
 * Chat Orchestration (E47-A3).
 *
 * The legacy `POST /ai/chat` path now routes THROUGH the AI Orchestrator instead of bypassing it:
 *   1. build a minimal BehavioralContextSnapshot (no health/allergy inference),
 *   2. persist the user ChatMessage,
 *   3. run the orchestrator (mandatory snapshot, guards, cost, AICallLog, STUB model provider),
 *   4. reply = a safe blocked message (blocked/error) OR the deterministic recipe-search reply
 *      (live Gemini disabled) for safe prompts,
 *   5. persist the assistant ChatMessage, linked to the AICallLog row.
 *
 * No live LLM, no Gemini, no autonomous agents, no vision, no medical/diet advice.
 */
@Injectable()
export class ChatOrchestrationService {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly snapshots: BehavioralContextSnapshotService,
    private readonly chatMessages: ChatMessageService,
    private readonly legacyAi: AiService,
  ) {}

  async handleChat(input: HandleChatInput): Promise<HandleChatResult> {
    const conversationId = input.conversationId ?? randomUUID();
    const snapshot = await this.snapshots.build(input.userId, { locale: 'fa' });

    // persist the user's message around orchestration
    await this.chatMessages.create({
      userId: input.userId,
      conversationId,
      role: 'user',
      content: input.prompt,
    });

    let status: AiCallStatus;
    let model: string | null = STUB_MODEL;
    let aiCallLogId: string | null = null;
    let blocked = false;
    let reasons: string[] = [];
    let modelText: string | null = null;

    try {
      const result = await this.orchestrator.run({
        userId: input.userId,
        prompt: input.prompt,
        snapshot,
        surface: 'chat',
        conversationId,
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
      return { reply, conversationId, status, providerMode: 'deterministic', aiCallLogId: null };
    }

    // E47-A8: surface the LIVE, post-guarded model output ONLY when chat-live is explicitly enabled
    // (general live flags + chat kill switch) AND the orchestrator returned a safe non-empty answer.
    // Otherwise fall back to the deterministic rule-based recipe reply (the safe default).
    const chatLiveEnabled = resolveChatLiveEnabled(process.env);
    let reply: string;
    let providerMode: 'gemini' | 'deterministic';
    if (blocked || status === 'error') {
      reply = this.safeBlockedReply(status, reasons);
      providerMode = 'deterministic';
    } else if (chatLiveEnabled && typeof modelText === 'string' && modelText.trim().length > 0) {
      reply = modelText; // live Gemini output, already passed the orchestrator's outbound guards
      providerMode = 'gemini';
    } else {
      reply = await this.legacyAi.handlePrompt(input.prompt, input.userId);
      providerMode = 'deterministic';
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

    return { reply, conversationId, status, providerMode, aiCallLogId };
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

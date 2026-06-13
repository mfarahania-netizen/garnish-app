import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';
import { ChatMessageService } from './chat-message.service';
import { AiService } from '../ai.service';
import { AiCallStatus, MissingBehavioralContextError } from '../ai-core.types';

export interface HandleChatInput {
  userId: string;
  prompt: string;
  conversationId?: string;
}
export interface HandleChatResult {
  reply: string;
  conversationId: string;
  status: AiCallStatus;
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
      return { reply, conversationId, status };
    }

    let reply: string;
    if (blocked || status === 'error') {
      reply = this.safeBlockedReply(status);
    } else {
      // safe prompt → deterministic recipe-search reply (rule-based; live Gemini disabled in A3)
      reply = await this.legacyAi.handlePrompt(input.prompt, input.userId);
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

    return { reply, conversationId, status };
  }

  /** Deterministic, safe responses for blocked calls — no medical/vision/diet claims, no pretend AI. */
  private safeBlockedReply(status: AiCallStatus): string {
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

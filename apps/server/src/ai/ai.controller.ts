// apps/server/src/ai/ai.controller.ts
import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ChatOrchestrationService } from './chat/chat-orchestration.service';
import { ConversationsService } from './chat/conversations.service';
import { AiAssistService } from './assist/ai-assist.service';
import { MissingBehavioralContextError } from './ai-core.types';

@Controller('ai')
export class AiController {
  constructor(
    private readonly chatOrchestration: ChatOrchestrationService,
    private readonly conversations: ConversationsService,
    private readonly assist: AiAssistService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // افزایش محدودیت مخصوص چت
  @Post('chat')
  async chat(
    @Req() req,
    @Body() body: { prompt: string; conversationId?: string; context?: { currentScreen?: string; recipeId?: string; stepIndex?: number } },
  ) {
    const userId = req.user.userId;
    // E47-A3/A8: every chat request routes THROUGH the AI Orchestrator (mandatory snapshot, guards,
    // cost, AICallLog). The reply is the LIVE post-guarded model output only when chat-live is
    // explicitly enabled by env; otherwise it is the deterministic recipe reply (safe default).
    // Response keeps `reply` + `conversationId` (backward-compatible) and adds safe optional fields.
    // `context` (D1 live per-request context) is sanitized + DARK-captured server-side — never trusted raw.
    const { reply, conversationId, status, providerMode, aiCallLogId, suggestedAction } = await this.chatOrchestration.handleChat({
      userId,
      prompt: body.prompt,
      conversationId: body.conversationId,
      context: body.context,
    });
    // §3 confirm-then-write: surface the allergy-add OFFER so the client can render the one-tap confirm. This is
    // an OFFER only — the safe set is written solely by the user's explicit POST /users/allergies, never here.
    return { reply, conversationId, providerMode, safetyStatus: status, aiCallLogId, ...(suggestedAction ? { suggestedAction } : {}) };
  }

  // ── Chat conversation management (the threads sidebar) ──────────────────────────────────────────────
  /** List the user's chat threads (newest first, with a preview), so the FE can show a sidebar + resume history. */
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('conversations')
  async listConversations(@Req() req) {
    return { conversations: await this.conversations.list(req.user.userId) };
  }

  /** Start a fresh empty thread; the client sends its id as conversationId on the next turn. */
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('conversations')
  async newConversation(@Req() req, @Body() body: { title?: string }) {
    return this.conversations.create(req.user.userId, body?.title);
  }

  /** Load a thread's messages (owner-checked) so the FE can RESUME the history on re-entry. */
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('conversations/:id')
  async conversationMessages(@Req() req, @Param('id') id: string) {
    const messages = await this.conversations.messages(req.user.userId, id);
    return messages === null ? { resultStatus: 'not_found', messages: [] } : { messages };
  }

  /** Rename a thread (owner-checked). */
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Patch('conversations/:id')
  async renameConversation(@Req() req, @Param('id') id: string, @Body() body: { title: string }) {
    const updated = await this.conversations.rename(req.user.userId, id, body?.title ?? '');
    return updated === null ? { resultStatus: 'not_found' } : updated;
  }

  /** Delete a thread + its messages (owner-checked). */
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Delete('conversations/:id')
  async deleteConversation(@Req() req, @Param('id') id: string) {
    return { ok: await this.conversations.remove(req.user.userId, id) };
  }

  /**
   * E47-L4 grounded assistant endpoints. Each builds the mandatory BehavioralContextSnapshot, runs
   * exactly ONE read-only deterministic tool over the recipe/ingredient corpus, and routes the NL
   * output through the nutrition-claim guard. No live LLM, no autonomy. A missing snapshot fails fast
   * → a safe degraded payload (never a leak).
   */
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('substitutions')
  async substitutions(@Req() req, @Body() body: { ingredient: string; avoidAllergens?: string[]; dislikes?: string[]; limit?: number }) {
    return this.safe(() => this.assist.substitutions(req.user.userId, { ...body }));
  }

  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('pantry-match')
  async pantryMatch(@Req() req, @Body() body: { have: string[]; limit?: number }) {
    return this.safe(() => this.assist.pantryMatch(req.user.userId, { ...body }));
  }

  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('recipes/:id/technique')
  async technique(@Req() req, @Param('id') id: string, @Query('step') step?: string) {
    return this.safe(() => this.assist.technique(req.user.userId, { recipeId: id, step: step != null && step !== '' ? Number(step) : undefined }));
  }

  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('pairings')
  async pairings(@Req() req, @Body() body: { ingredient?: string; recipeId?: string; limit?: number }) {
    return this.safe(() => this.assist.pairings(req.user.userId, { ...body }));
  }

  /** Map a fail-fast missing-snapshot into a safe degraded payload (no internal leak). */
  private async safe<T>(fn: () => Promise<T>): Promise<T | { resultStatus: 'unavailable'; reason: string }> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof MissingBehavioralContextError) {
        return { resultStatus: 'unavailable', reason: 'context_unavailable' };
      }
      throw err;
    }
  }
}

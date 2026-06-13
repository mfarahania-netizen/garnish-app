// apps/server/src/ai/ai.controller.ts
import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ChatOrchestrationService } from './chat/chat-orchestration.service';

@Controller('ai')
export class AiController {
  constructor(private readonly chatOrchestration: ChatOrchestrationService) {}

  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // افزایش محدودیت مخصوص چت
  @Post('chat')
  async chat(@Req() req, @Body() body: { prompt: string; conversationId?: string }) {
    const userId = req.user.userId;
    // E47-A3/A8: every chat request routes THROUGH the AI Orchestrator (mandatory snapshot, guards,
    // cost, AICallLog). The reply is the LIVE post-guarded model output only when chat-live is
    // explicitly enabled by env; otherwise it is the deterministic recipe reply (safe default).
    // Response keeps `reply` + `conversationId` (backward-compatible) and adds safe optional fields.
    const { reply, conversationId, status, providerMode, aiCallLogId } = await this.chatOrchestration.handleChat({
      userId,
      prompt: body.prompt,
      conversationId: body.conversationId,
    });
    return { reply, conversationId, providerMode, safetyStatus: status, aiCallLogId };
  }
}

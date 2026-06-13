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
    // E47-A3: every chat request now routes THROUGH the AI Orchestrator (guards/cost/AICallLog,
    // mandatory snapshot, stub model). Response keeps `reply` (backward-compatible) + adds conversationId.
    const { reply, conversationId } = await this.chatOrchestration.handleChat({
      userId,
      prompt: body.prompt,
      conversationId: body.conversationId,
    });
    return { reply, conversationId };
  }
}

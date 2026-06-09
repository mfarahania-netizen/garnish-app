// apps/server/src/ai/ai.controller.ts
import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // افزایش محدودیت مخصوص چت
  @Post('chat')
  async chat(@Req() req, @Body() body: { prompt: string }) {
    const userId = req.user.userId;
    const reply = await this.aiService.handlePrompt(body.prompt, userId);
    return { reply };
  }
}
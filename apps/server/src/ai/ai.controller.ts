import { Controller, Post, Body, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Req() req, @Body() body: { prompt: string }) {
    // استخراج توکن از هدر Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('برای استفاده از دستیار هوشمند، لطفاً ابتدا وارد حساب کاربری خود شوید.', HttpStatus.UNAUTHORIZED);
    }

    try {
      const token = authHeader.substring(7);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const userId = payload.sub || payload.userId;
      const reply = await this.aiService.handlePrompt(body.prompt, userId);
      return { reply };
    } catch (e) {
      throw new HttpException('توکن نامعتبر است. لطفاً دوباره وارد شوید.', HttpStatus.UNAUTHORIZED);
    }
  }
}
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';
const ROLES: ReadonlySet<string> = new Set(['user', 'assistant', 'system', 'tool']);

export interface CreateChatMessageInput {
  userId: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  contentSafetyStatus?: string | null;
  model?: string | null;
  aiCallLogId?: string | null;
}

export interface ChatMemoryMessage {
  role: Extract<ChatRole, 'user' | 'assistant'>;
  content: string;
  createdAt: Date;
}

/**
 * ChatMessage persistence (E47-A2). Minimal create/read for AI Core v1.
 * No medical/diet claim expansion, no vision — it only stores what the orchestrator/chat produces.
 * Legacy chat routing through the orchestrator is E47-A3 (not wired here).
 */
@Injectable()
export class ChatMessageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateChatMessageInput) {
    if (!ROLES.has(input.role)) {
      throw new BadRequestException(`Invalid chat role: ${input.role}`);
    }
    return this.prisma.chatMessage.create({
      data: {
        userId: input.userId,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        contentSafetyStatus: input.contentSafetyStatus ?? null,
        model: input.model ?? null,
        aiCallLogId: input.aiCallLogId ?? null,
      },
    });
  }

  async listByConversation(conversationId: string) {
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listRecentForMemory(userId: string, conversationId: string, limit = 8): Promise<ChatMemoryMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: {
        userId,
        conversationId,
        // Keep all USER turns; keep only assistant turns that actually answered. A blocked/error reply
        // («درخواست‌های زیادی…» / a safety refusal) must NOT pollute the short-term memory the live model reads —
        // otherwise the next turn treats the error as "what the assistant said", apologizes, and loses the thread.
        OR: [
          { role: 'user' },
          { role: 'assistant', NOT: { contentSafetyStatus: { in: ['error', 'blocked_injection', 'blocked_safety', 'blocked_nutrition', 'blocked_cost'] } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });
    return rows.reverse() as ChatMemoryMessage[];
  }
}

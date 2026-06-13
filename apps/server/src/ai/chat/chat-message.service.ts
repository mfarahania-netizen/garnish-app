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
}

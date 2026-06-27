import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Chat conversation management — list / open / new / rename / delete the user's named chat threads.
 *
 * Messages are already persisted (ChatMessage); this adds the Conversation row that groups them with a title
 * so the FE can show a sidebar (one thread for questions, one for the weekly plan, …) and RESUME history on
 * re-entry instead of starting fresh each time. Every read/write is OWNER-CHECKED (a user only touches their own
 * threads). Titles auto-derive from the first user turn and are user-editable.
 */
@Injectable()
export class ConversationsService {
  private readonly logger = new Logger('ConversationsService');

  constructor(private readonly prisma: PrismaService) {}

  /** Called on every chat turn: create the thread on first sight (auto-title from the first prompt), else bump it. */
  async touch(userId: string, conversationId: string, firstPrompt?: string): Promise<void> {
    try {
      const existing = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { userId: true } });
      if (existing) {
        if (existing.userId === userId) await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
        return;
      }
      await this.prisma.conversation.create({ data: { id: conversationId, userId, title: this.deriveTitle(firstPrompt) } });
    } catch (e) {
      this.logger.warn(`conversation touch failed (non-fatal): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** The user's threads, newest activity first, each with a short last-message preview. */
  async list(userId: string) {
    const convos = await this.prisma.conversation.findMany({
      where: { userId, archived: false },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    return Promise.all(
      convos.map(async (c) => {
        const last = await this.prisma.chatMessage.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: 'desc' }, select: { content: true } });
        return { ...c, preview: last ? last.content.slice(0, 80) : null };
      }),
    );
  }

  /** A thread's user/assistant messages in order — null if not found or not the owner. */
  async messages(userId: string, conversationId: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { userId: true } });
    if (!c || c.userId !== userId) return null;
    return this.prisma.chatMessage.findMany({
      where: { conversationId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }

  /** Create a fresh empty thread; the FE points the next turn's conversationId at it. */
  async create(userId: string, title?: string) {
    return this.prisma.conversation.create({
      data: { userId, title: title?.trim().slice(0, 60) || null },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  /** Rename (owner-checked) — null when not found / not owner. */
  async rename(userId: string, conversationId: string, title: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { userId: true } });
    if (!c || c.userId !== userId) return null;
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { title: (title ?? '').trim().slice(0, 60) || null }, select: { id: true, title: true } });
  }

  /** Delete the thread + its messages (owner-checked) — false when not found / not owner. */
  async remove(userId: string, conversationId: string): Promise<boolean> {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { userId: true } });
    if (!c || c.userId !== userId) return false;
    await this.prisma.chatMessage.deleteMany({ where: { conversationId, userId } });
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return true;
  }

  private deriveTitle(prompt?: string): string | null {
    const t = (prompt ?? '').trim().replace(/\s+/g, ' ');
    return t ? t.slice(0, 60) : null;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BehavioralContextSnapshot } from '../ai-core.types';

/**
 * Behavioral Context Snapshot (E47-A3).
 *
 * Every AI call requires a snapshot (Constitution E47). Builds a MINIMAL, valid snapshot from the
 * authenticated user + already-stored NON-sensitive preferences (diet/skill/budget). It does NOT
 * read or infer health, allergy, diagnosis, or other sensitive facts. Real behavioral-signal
 * hydration from the behavior engine is a later phase. Building must never throw — on any error it
 * degrades to the minimal snapshot.
 */
@Injectable()
export class BehavioralContextSnapshotService {
  private readonly logger = new Logger(BehavioralContextSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, opts: { locale?: string } = {}): Promise<BehavioralContextSnapshot> {
    let preferences: Record<string, unknown> = {};
    try {
      const pref = await this.prisma.userPreference.findUnique({ where: { userId } });
      if (pref) {
        // ONLY non-sensitive, user-set preferences. No allergies/health-goals (sensitive).
        preferences = {
          diet: pref.diet ?? null,
          skillLevel: pref.skillLevel ?? null,
          budget: pref.budget ?? null,
        };
      }
    } catch (err) {
      this.logger.warn(`snapshot preferences unavailable; degrading to minimal: ${err instanceof Error ? err.message : String(err)}`);
    }
    return {
      userId,
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
      locale: opts.locale ?? 'fa',
      preferences,
      signals: {},
      consents: ['core'],
      nutritionSourceLocked: false,
      dataMaturity: 'cold-start',
    };
  }

  validate(snapshot: BehavioralContextSnapshot | null | undefined): snapshot is BehavioralContextSnapshot {
    return (
      !!snapshot &&
      typeof snapshot.userId === 'string' &&
      snapshot.userId.trim().length > 0 &&
      typeof snapshot.generatedAt === 'string' &&
      snapshot.generatedAt.length > 0 &&
      typeof snapshot.schemaVersion === 'number'
    );
  }
}

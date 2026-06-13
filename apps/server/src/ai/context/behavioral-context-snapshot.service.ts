import { Injectable } from '@nestjs/common';
import { BehavioralContextSnapshot } from '../ai-core.types';

/**
 * Behavioral Context Snapshot (E47-A1).
 *
 * Every AI call requires a snapshot (Constitution E47). A1 provides a minimal builder + validator;
 * real signal hydration from the behavior engine / feature store is wired in E47-A2.
 */
@Injectable()
export class BehavioralContextSnapshotService {
  async build(userId: string): Promise<BehavioralContextSnapshot> {
    return {
      userId,
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
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

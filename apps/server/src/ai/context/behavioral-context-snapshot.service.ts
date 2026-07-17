import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsentService } from '../../consent/consent.service';
import { BehavioralContextSnapshot } from '../ai-core.types';

// P1-3: signal names that must NEVER reach the AI snapshot (sensitive). Mirrors get-user-food-context's filter.
const SENSITIVE_SIGNAL = /allerg|health|medical|diagnos|disease|symptom|diabet|cholesterol|insulin|blood|weight|calorie|bmi|pregnan|fertility/i;

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
  private readonly consent: ConsentService;

  constructor(
    private readonly prisma: PrismaService,
    consent?: ConsentService,
  ) {
    // Direct offline harnesses historically construct this service without Nest. They still go through
    // the canonical current-policy implementation instead of duplicating a weaker consent query.
    this.consent = consent ?? new ConsentService(prisma);
  }

  async build(userId: string, opts: { locale?: string } = {}): Promise<BehavioralContextSnapshot> {
    let personalizationActive = false;
    try {
      personalizationActive = await this.consent.hasPurpose(
        userId,
        'personalization',
      );
    } catch (err) {
      this.logger.warn(
        `snapshot consent unavailable; personalization disabled: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let preferences: Record<string, unknown> = {};
    try {
      const pref = await this.prisma.userPreference.findUnique({
        where: { userId },
        select: personalizationActive
          ? { diet: true, skillLevel: true, budget: true }
          : { diet: true, skillLevel: true },
      });
      if (pref) {
        // Diet/skill are user-declared core planning inputs. Budget is optional personalization data.
        preferences = {
          diet: pref.diet ?? null,
          skillLevel: pref.skillLevel ?? null,
          ...(personalizationActive
            ? { budget: (pref as { budget?: string | null }).budget ?? null }
            : {}),
        };
      }
    } catch (err) {
      this.logger.warn(`snapshot preferences unavailable; degrading to minimal: ${err instanceof Error ? err.message : String(err)}`);
    }

    // P1-3 (recsys audit): hydrate REAL derived behavioral signals — but ONLY with the user's personalization
    // consent, and REDACTED (signalName + a coarse strength bucket; never a raw value, never a health/allergy
    // signal). No consent → empty signals + cold-start, BYTE-IDENTICAL to before (no personalization consent is
    // granted today). This lets the AI ground "because you recently saved quick meals" in real evidence, and
    // stay honest-limited when there is none.
    let signals: Record<string, unknown> = {};
    let dataMaturity = 'cold-start';
    const consents = ['core'];
    try {
      if (personalizationActive) {
        consents.push('personalization');
        const top = await this.prisma.userBehaviorSignal.findMany({
          where: { userId },
          orderBy: { confidence: 'desc' },
          take: 8,
          select: { signalName: true, confidence: true },
        });
        for (const s of top) {
          if (SENSITIVE_SIGNAL.test(s.signalName)) continue; // never surface health/allergy-shaped signals
          const c = Number(s.confidence ?? 0);
          signals[s.signalName] = c >= 0.66 ? 'high' : c >= 0.33 ? 'medium' : 'low'; // REDACTED coarse strength
        }
        const n = Object.keys(signals).length;
        if (n) dataMaturity = n >= 4 ? 'established' : 'warming';
      }
    } catch (err) {
      this.logger.warn(`snapshot signal hydration skipped; cold-start: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      userId,
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
      locale: opts.locale ?? 'fa',
      preferences,
      signals,
      consents,
      nutritionSourceLocked: false,
      dataMaturity,
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

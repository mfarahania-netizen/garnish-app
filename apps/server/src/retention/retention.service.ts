import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { prunableRules, excludedByClass, RetentionClass } from './retention-policy';

export interface RetentionCandidate {
  model: string;
  class: RetentionClass;
  timeField: string;
  cutoffDays: number;
  cutoffDate: string;
  candidateCount: number;
}

export interface RetentionPreview {
  mode: 'dry-run';
  generatedAt: string;
  destructiveEnabled: boolean;
  totalCandidates: number;
  candidates: RetentionCandidate[];
  excluded: Record<string, string[]>;
  warnings: string[];
}

/** Env flag that would gate a future destructive prune. Default-false: deletion never happens by default. */
export const RETENTION_DESTRUCTIVE_FLAG = 'RETENTION_DESTRUCTIVE_ENABLED';

/**
 * Retention service (E39-1E) — DRY-RUN ONLY.
 *
 * Identifies prune candidates (rows in `standard_365d`/`ephemeral_30d` models older than their cutoff)
 * and reports COUNTS. It never deletes. `audit_long`, `user_owned_active`, and `review_required` classes
 * are excluded entirely. Output is PII-free (model names, counts, cutoff dates only).
 *
 * Destructive execution is intentionally NOT implemented in this phase: `executeRetention()` refuses
 * unless the env flag is set (default false) and, even then, throws — a real prune requires a separate,
 * explicitly approved controlled-execution task.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  static isDestructiveEnabled(): boolean {
    return process.env[RETENTION_DESTRUCTIVE_FLAG] === 'true';
  }

  /** Compute prune candidate counts. Read-only — issues only `count()` queries, never `deleteMany`. */
  async previewRetention(now: Date = new Date()): Promise<RetentionPreview> {
    const candidates: RetentionCandidate[] = [];
    const warnings: string[] = [];

    for (const rule of prunableRules()) {
      const cutoff = new Date(now.getTime() - (rule.cutoffDays as number) * 24 * 60 * 60 * 1000);
      try {
        const candidateCount = await (this.prisma as unknown as Record<string, { count: (args: unknown) => Promise<number> }>)[rule.model].count({
          where: { [rule.timeField as string]: { lt: cutoff } },
        });
        candidates.push({
          model: rule.model,
          class: rule.class,
          timeField: rule.timeField as string,
          cutoffDays: rule.cutoffDays as number,
          cutoffDate: cutoff.toISOString(),
          candidateCount,
        });
      } catch (e) {
        warnings.push(`${rule.model}: count failed (${(e as { code?: string; name?: string }).code ?? (e as Error).name ?? 'error'})`);
      }
    }

    const totalCandidates = candidates.reduce((sum, c) => sum + c.candidateCount, 0);
    const preview: RetentionPreview = {
      mode: 'dry-run',
      generatedAt: now.toISOString(),
      destructiveEnabled: RetentionService.isDestructiveEnabled(),
      totalCandidates,
      candidates,
      excluded: excludedByClass(),
      warnings,
    };
    this.logger.log(`retention dry-run: ${candidates.length} prunable models, ${totalCandidates} candidate rows (NOTHING deleted)`);
    return preview;
  }

  /**
   * Destructive prune — NOT enabled in E39-1E. Refuses by default; even with the flag set it throws,
   * because actual deletion requires a separate approved controlled-execution task.
   */
  async executeRetention(): Promise<never> {
    if (!RetentionService.isDestructiveEnabled()) {
      throw new Error(`Retention destructive prune REFUSED: ${RETENTION_DESTRUCTIVE_FLAG} is not set (default-safe; dry-run only).`);
    }
    throw new Error('Retention destructive prune is NOT implemented in E39-1E (dry-run only). A real prune requires a separate, explicitly approved controlled-execution task.');
  }
}

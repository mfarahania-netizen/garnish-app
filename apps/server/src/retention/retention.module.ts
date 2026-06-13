import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';

/**
 * Retention module (E39-1E) — dry-run foundation.
 *
 * NOTE: intentionally NOT imported into AppModule in this phase. Wiring it (and any dry-run cron) is a
 * gated follow-up. PrismaModule is @Global, so RetentionService resolves PrismaService without an import.
 */
@Module({
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}

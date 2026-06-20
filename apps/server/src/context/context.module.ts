import { Module } from '@nestjs/common';
import { ContextService } from './context.service';

/** L0 — real-time context engine ("every second"). Exported for the L1 ranker + L2a assistant to inject. */
@Module({
  providers: [ContextService],
  exports: [ContextService],
})
export class ContextModule {}

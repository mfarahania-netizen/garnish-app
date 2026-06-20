import { Module } from '@nestjs/common';
import { ConsentService } from './consent.service';

/** L0/B — purpose-scoped opt-in consent. Exported so ingest (analytics), the profile read path, and the
 * consent-grant endpoint converge on ONE consent definition. PrismaModule is @Global. */
@Module({
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}

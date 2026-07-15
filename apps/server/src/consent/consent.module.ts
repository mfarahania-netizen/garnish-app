import { Module } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { PrismaModule } from '../prisma/prisma.module';

/** L0/B — purpose-scoped opt-in consent. Exported so ingest (analytics), the profile read path, and the
 * consent-grant endpoint converge on ONE consent definition. PrismaModule is @Global. */
@Module({
  imports: [PrismaModule],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}

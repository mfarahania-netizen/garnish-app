// apps/server/src/outcomes/outcomes.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthOutcomeService } from './health-outcome.service';
import { BehaviorOutcomeService } from './behavior-outcome.service';
import { AdherenceOutcomeService } from './adherence-outcome.service';
import { ConsentModule } from '../consent/consent.module';

@Module({
  imports: [PrismaModule, ConsentModule],
  providers: [
    HealthOutcomeService,
    BehaviorOutcomeService,
    AdherenceOutcomeService,
  ],
})
export class OutcomesModule {}

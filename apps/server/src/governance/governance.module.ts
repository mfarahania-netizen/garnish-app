// apps/server/src/governance/governance.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DataRetentionService } from './data-retention.service';
import { GovernanceInsightsService } from './governance-insights.service';

@Module({
  imports: [PrismaModule],
  providers: [DataRetentionService, GovernanceInsightsService],
  exports: [GovernanceInsightsService],
})
export class GovernanceModule {}

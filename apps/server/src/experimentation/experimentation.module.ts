// apps/server/src/experimentation/experimentation.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExperimentEngine } from './experiment-engine.service';

@Module({
  imports: [PrismaModule],
  providers: [ExperimentEngine],
  exports: [ExperimentEngine],
})
export class ExperimentationModule {}
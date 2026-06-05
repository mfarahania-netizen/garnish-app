import { Module } from '@nestjs/common';
import { BehaviorEngineService } from './behavior-engine.service';
import { BehaviorEngineController } from './behavior-engine.controller';
import { BehaviorEngineScheduler } from './behavior-engine-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BehaviorEngineService, BehaviorEngineScheduler],
  controllers: [BehaviorEngineController],
  exports: [BehaviorEngineService],
})
export class BehaviorEngineModule {}
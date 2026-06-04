import { Module } from '@nestjs/common';
import { BehaviorEngineService } from './behavior-engine.service';
import { BehaviorEngineController } from './behavior-engine.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BehaviorEngineService],
  controllers: [BehaviorEngineController],
  exports: [BehaviorEngineService],
})
export class BehaviorEngineModule {}
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PersonalizationService } from './personalization.service';

@Module({
  controllers: [AiController],
  providers: [AiService, PersonalizationService],
})
export class AiModule {}
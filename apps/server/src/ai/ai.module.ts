import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PersonalizationService } from './personalization.service';
import { AiCoreModule } from './ai-core.module';
import { ChatOrchestrationService } from './chat/chat-orchestration.service';

/**
 * Legacy AI module. The chat controller now routes through the AI Orchestrator (E47-A3) by
 * importing AiCoreModule (one-directional; AiCoreModule does not depend on AiModule).
 */
@Module({
  imports: [AiCoreModule],
  controllers: [AiController],
  providers: [AiService, PersonalizationService, ChatOrchestrationService],
})
export class AiModule {}

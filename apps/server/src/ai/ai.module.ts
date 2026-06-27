import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PersonalizationService } from './personalization.service';
import { AiCoreModule } from './ai-core.module';
import { ProfileModule } from '../behavior-engine/profile/profile.module';
import { ChatOrchestrationService } from './chat/chat-orchestration.service';
import { GroundedReplyService } from './chat/grounded-reply.service';
import { ConversationsService } from './chat/conversations.service';
import { AgenticChatService } from './chat/agentic-chat.service';
import { AgenticWriteToolsService } from './agentic/agentic-write-tools.service';
import { RecipeSafetyFilterService } from '../recipes/intelligence/recipe-safety-filter.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { ShoppingListModule } from '../shopping-list/shopping-list.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';

/**
 * Legacy AI module. The chat controller now routes through the AI Orchestrator (E47-A3) by
 * importing AiCoreModule (one-directional; AiCoreModule does not depend on AiModule).
 *
 * AI-GROUNDED-ASSISTANT: also imports ProfileModule so GroundedReplyService can read the SAME reconciled
 * living profile (allergy set) the recommendation pipeline uses. No cycle: ProfileModule → AiCoreModule
 * → PrismaModule only; AiModule is imported by neither.
 */
@Module({
  imports: [AiCoreModule, ProfileModule, AnalyticsModule, FavoritesModule, ShoppingListModule, MealPlansModule],
  controllers: [AiController],
  providers: [
    AiService,
    PersonalizationService,
    ChatOrchestrationService,
    GroundedReplyService,
    ConversationsService,
    RecipeSafetyFilterService,
    AgenticChatService,
    AgenticWriteToolsService,
  ],
})
export class AiModule {}

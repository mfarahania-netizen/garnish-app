/**
 * ProfileModule (GARNISH-PROFILE-L4-05) — the living user profile (declared + onboarding engine).
 *
 * Owner-only, consent-aware, backend-only (no UI). Reuses UserFactService (from AiCoreModule) for safe
 * declared-fact persistence and PrismaService for consent/preference/allergy reads.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiCoreModule } from '../../ai/ai-core.module';
import { QuestionSelectionService } from './onboarding/question-selection.service';
import { ProfileReadService } from './read/profile-read.service';
import { ProfileController } from './read/profile.controller';
import { TasteCorrectionService } from '../signals/taste-correction.service';
import { ConsentModule } from '../../consent/consent.module';

@Module({
  imports: [PrismaModule, AiCoreModule, ConsentModule],
  controllers: [ProfileController],
  providers: [QuestionSelectionService, ProfileReadService, TasteCorrectionService],
  exports: [ProfileReadService, QuestionSelectionService, TasteCorrectionService],
})
export class ProfileModule {}

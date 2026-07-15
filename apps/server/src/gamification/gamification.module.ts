import { Module } from '@nestjs/common';
import { ProfileModule } from '../behavior-engine/profile/profile.module';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { ConsentModule } from '../consent/consent.module';

/**
 * GAMIFY-L4-11 — honest gamification. Reuses ProfileReadService (ProfileModule) for declared skill and
 * the S6 IneService (global, from NotificationsModule) for dry-run notification triggers. PrismaService
 * is global. No parallel profile/notifier is created here.
 */
@Module({
  imports: [ProfileModule, ConsentModule],
  providers: [GamificationService],
  controllers: [GamificationController],
  exports: [GamificationService],
})
export class GamificationModule {}

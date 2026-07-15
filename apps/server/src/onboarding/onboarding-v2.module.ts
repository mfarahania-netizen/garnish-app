import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingV2Controller } from './onboarding-v2.controller';
import { OnboardingV2Service } from './onboarding-v2.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnboardingV2Controller],
  providers: [OnboardingV2Service],
  exports: [OnboardingV2Service],
})
export class OnboardingV2Module {}

import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BehaviorEngineService } from './behavior-engine.service';

@Controller('behavior-engine')
@UseGuards(AuthGuard('jwt'), RolesGuard)   // اول احراز هویت، بعد چک نقش
@Roles('admin')                           // فقط ادمین‌ها
export class BehaviorEngineController {
  constructor(private readonly behaviorEngineService: BehaviorEngineService) {}

  // متد test-default کامل حذف شد
}
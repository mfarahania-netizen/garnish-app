import { Controller, Get } from '@nestjs/common';
import { BehaviorEngineService } from './behavior-engine.service';

@Controller('behavior-engine')
export class BehaviorEngineController {
  constructor(private readonly behaviorEngineService: BehaviorEngineService) {}

  @Get('test-default')
  async testDefault() {
    return this.behaviorEngineService.processEventsForTestUser();
  }
}
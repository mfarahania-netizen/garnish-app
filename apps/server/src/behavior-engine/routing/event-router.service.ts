// apps/server/src/behavior-engine/routing/event-router.service.ts
import { Injectable } from '@nestjs/common';
import { ProcessorRegistry } from './processor.registry';

@Injectable()
export class EventRouterService {
  constructor(private readonly registry: ProcessorRegistry) {}

  async route(event: any, userId: string) {
    const processor = this.registry.get(event.type);
    if (processor) {
      await processor.process(event, userId);
    }
  }
}
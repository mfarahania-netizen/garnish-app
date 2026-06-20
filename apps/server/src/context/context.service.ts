import { Injectable } from '@nestjs/common';
import { buildRealTimeContext, RealTimeContext } from './real-time-context';

/**
 * L0 — injectable wrapper around the pure real-time context builder. Consumers (the L1 ranker, the L2a
 * assistant) inject this and call `now()` at serve time to get the "every second" context (time-of-day,
 * meal window, Persian season, cultural occasion). Kept thin so the logic stays pure + unit-tested.
 */
@Injectable()
export class ContextService {
  now(at: Date = new Date()): RealTimeContext {
    return buildRealTimeContext(at);
  }
}

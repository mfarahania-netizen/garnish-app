import { Injectable } from '@nestjs/common';
import { buildRealTimeContext, RealTimeContext, ContextOpts } from './real-time-context';

/**
 * L0 — injectable wrapper around the pure real-time context builder. Consumers (the L1 ranker, the L2a
 * assistant) inject this and call `now(at, { timeZone })` at serve time with the USER's timezone (from
 * their profile/location) so the context is local — Tehran and Amsterdam users get different time-of-day,
 * meal window, and weekend. Kept thin so the logic stays pure + unit-tested.
 */
@Injectable()
export class ContextService {
  now(at: Date = new Date(), opts: ContextOpts = {}): RealTimeContext {
    return buildRealTimeContext(at, opts);
  }
}

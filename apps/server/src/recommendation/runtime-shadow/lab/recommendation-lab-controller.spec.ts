import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RecommendationLabController } from './recommendation-lab-controller';

/** Controller resolves config/env from process.env; admin-guarded at framework layer + in-handler access gate. */
describe('RecommendationLabController', () => {
  const ENV = process.env;
  const controller = new RecommendationLabController();
  const req = { user: { isAdmin: true, roles: ['admin'] } };
  afterEach(() => { process.env = ENV; });

  it('summary: default OFF → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_LAB_MODE: 'off' };
    expect(() => controller.summary(req)).toThrow(ForbiddenException);
  });

  it('summary: production + dev_internal_api → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_LAB_MODE: 'dev_internal_api', NODE_ENV: 'production' };
    expect(() => controller.summary(req)).toThrow(ForbiddenException);
  });

  it('summary: dev_internal_api + non-prod + admin → safe summary (no raw data)', () => {
    process.env = { ...ENV, RECOMMENDATION_LAB_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    const s = controller.summary(req);
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.templates.length).toBe(5);
    expect(JSON.stringify(s)).not.toMatch(/instruction|recipeBody|userText|prompt/i);
  });

  it('run: invalid experimentKey → 400', async () => {
    process.env = { ...ENV, RECOMMENDATION_LAB_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    await expect(controller.run(req, { experimentKey: 'bad key!!' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('run: unknown template → 400', async () => {
    process.env = { ...ENV, RECOMMENDATION_LAB_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    await expect(controller.run(req, { experimentKey: 'a11-not-real' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('run: OFF mode → 403 (before any execution)', async () => {
    process.env = { ...ENV, RECOMMENDATION_LAB_MODE: 'off' };
    await expect(controller.run(req, { experimentKey: 'a11-shadow-dev-balanced' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('run: dev_internal_api + admin → runs registered template, allowed false', async () => {
    process.env = { ...ENV, RECOMMENDATION_LAB_MODE: 'dev_internal_api', NODE_ENV: 'development', RECOMMENDATION_LAB_ALLOW_DRY_RUN: 'true' };
    const exp = await controller.run(req, { experimentKey: 'a11-shadow-dev-balanced' });
    expect(exp.experimentKey).toBe('a11-shadow-dev-balanced');
    expect(exp.promotionGate.allowed).toBe(false);
    expect(exp.liveRankingChangedForUser).toBe(false);
  });
});

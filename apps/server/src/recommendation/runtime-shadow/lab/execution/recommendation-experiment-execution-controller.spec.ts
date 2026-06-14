import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RecommendationExperimentExecutionController } from './recommendation-experiment-execution-controller';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../../recommendation-shadow-profile-feed.types';

const a8 = () => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};
const controller = () => new RecommendationExperimentExecutionController(a8());

describe('RecommendationExperimentExecutionController', () => {
  const ENV = process.env;
  const req = { user: { isAdmin: true, roles: ['admin'] } };
  afterEach(() => { process.env = ENV; });

  it('summary: default OFF → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'off' };
    expect(() => controller().summary(req)).toThrow(ForbiddenException);
  });
  it('summary: production + dev_internal_api → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api', NODE_ENV: 'production' };
    expect(() => controller().summary(req)).toThrow(ForbiddenException);
  });
  it('summary: dev_internal_api + non-prod + admin → redacted summary', () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    const s = controller().summary(req);
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.templates.length).toBe(5);
    expect(s.nextDecisionRequired).toBe('founder_review_results');
  });
  it('run: allow-run false → 403', async () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api', NODE_ENV: 'development', RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN: 'false' };
    await expect(controller().run(req, { templateKey: 'a11-shadow-dev-balanced' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('run: invalid templateKey → 400', async () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api', NODE_ENV: 'development', RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN: 'true' };
    await expect(controller().run(req, { templateKey: 'bad key!!' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('run: unknown template → 400', async () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api', NODE_ENV: 'development', RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN: 'true' };
    await expect(controller().run(req, { templateKey: 'a11-not-real' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('run: OFF mode → 403 before execution', async () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'off' };
    await expect(controller().run(req, { templateKey: 'a11-shadow-dev-balanced' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('run: dev_internal_api + allow-run + admin → executed, no live/product change', async () => {
    process.env = { ...ENV, RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api', NODE_ENV: 'development', RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN: 'true' };
    const r = await controller().run(req, { templateKey: 'a11-shadow-dev-balanced', mode: 'shadow_dev' });
    expect(r.runLedger.status).toBe('completed');
    expect(r.liveRankingChangedForUser).toBe(false);
    expect(r.dossier.nextDecisionRequired).toBe('founder_review_results');
  });
});

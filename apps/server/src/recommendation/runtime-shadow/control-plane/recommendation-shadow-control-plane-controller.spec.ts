import { ForbiddenException } from '@nestjs/common';
import { RecommendationShadowControlPlaneController } from './recommendation-shadow-control-plane-controller';
import { RecommendationShadowControlPlaneService } from './recommendation-shadow-control-plane.service';

/**
 * The controller resolves config/env from process.env. We drive behavior by setting env per test.
 * The route is admin-guarded (AuthGuard('jwt')+RolesGuard) at the framework layer; here we test the
 * in-handler access gate (default-OFF → 403; production → 403; dev_internal_api + non-prod → summary).
 */
describe('RecommendationShadowControlPlaneController.summary', () => {
  const ENV = process.env;
  const svc = new RecommendationShadowControlPlaneService();
  const controller = new RecommendationShadowControlPlaneController(svc);
  const req = { user: { isAdmin: true, roles: ['admin'] } };
  afterEach(() => { process.env = ENV; });

  it('default OFF mode → 403 (even for admin)', async () => {
    process.env = { ...ENV, RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'off' };
    await expect(controller.summary(req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('production + dev_internal_api → 403', async () => {
    process.env = { ...ENV, RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'dev_internal_api', NODE_ENV: 'production' };
    await expect(controller.summary(req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('dev_internal_api + non-production + admin → returns redacted summary', async () => {
    process.env = { ...ENV, RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    const s = await controller.summary(req);
    expect(s.version).toBe(1);
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.promotionGate.allowed).toBe(false);
    expect(JSON.stringify(s)).not.toMatch(/instruction|recipeBody|userText|prompt/i);
  });

  it('service_only mode via HTTP → 403 (route not exposed for HTTP)', async () => {
    process.env = { ...ENV, RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'service_only', NODE_ENV: 'development' };
    await expect(controller.summary(req)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

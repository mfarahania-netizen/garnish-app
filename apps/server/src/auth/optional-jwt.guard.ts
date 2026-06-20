import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT auth with a SAFE fail mode (guardian H1 hardening):
 *  - NO token at all → genuine anonymous → pass through (req.user = null). The caller applies the
 *    documented anonymous policy (no declared allergy profile to enforce).
 *  - token PRESENT but invalid/EXPIRED → REJECT (401). We must NOT silently degrade a logged-in,
 *    possibly-allergic user to "anonymous → unfiltered" because their token went stale; the 401 lets the
 *    web client's interceptor force re-auth instead of serving an unfiltered feed under a dead identity.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (user) return user;
    const req = context.switchToHttp().getRequest();
    const auth = req?.headers?.authorization;
    const hasToken = typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim().length > 0;
    if (hasToken) throw err || new UnauthorizedException('invalid or expired token');
    return null; // truly anonymous
  }
}

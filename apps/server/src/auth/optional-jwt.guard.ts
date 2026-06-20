import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT auth: if a valid token is present it populates req.user; if absent/invalid it does NOT
 * reject (anonymous allowed). Lets an otherwise-public endpoint personalize for logged-in users — e.g.
 * apply the allergy/observance HARD safety filter — while staying open to anonymous visitors.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user || null; // never throw on a missing/invalid token; req.user becomes user-or-null
  }
}

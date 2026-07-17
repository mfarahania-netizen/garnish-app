import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

const PRIVATE_CACHE_CONTROL = 'private, no-store, max-age=0';

type AuthenticatedRequest = Request & { user?: unknown };

function withAuthorizationVary(
  current: number | string | string[] | undefined,
): string {
  const value = Array.isArray(current)
    ? current.join(', ')
    : typeof current === 'string' || typeof current === 'number'
      ? String(current)
      : '';
  if (value === '*') return value;
  const fields = value
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
  if (!fields.some((field) => field.toLowerCase() === 'authorization')) {
    fields.push('Authorization');
  }
  return fields.join(', ');
}

@Injectable()
export class PrivateCacheControlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const authorization = request.headers.authorization;
    const requestUrl = String(request.originalUrl || request.url || '');
    const isCredentialBearingAuthRoute = /(?:^|\/)auth(?:\/|$)/.test(requestUrl.split('?')[0]);
    const isPrivate =
      request.user != null ||
      (typeof authorization === 'string' && authorization.trim() !== '') ||
      isCredentialBearingAuthRoute;

    if (!isPrivate) return next.handle();

    const applyPrivateHeaders = () => {
      response.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      response.setHeader(
        'Vary',
        withAuthorizationVary(response.getHeader('Vary')),
      );
    };

    // Apply before the handler for error paths, then again before Nest serializes a successful body
    // so downstream metadata cannot accidentally restore cacheability.
    applyPrivateHeaders();
    return next.handle().pipe(tap(() => applyPrivateHeaders()));
  }
}

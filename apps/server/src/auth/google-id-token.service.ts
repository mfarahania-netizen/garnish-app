import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, verify } from 'crypto';

interface GoogleJwk {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
}

const GOOGLE_JWKS_TIMEOUT_MS = 5000;
const GOOGLE_JWKS_MAX_CACHE_SECONDS = 24 * 60 * 60;
const GOOGLE_UNKNOWN_KID_REFRESH_INTERVAL_MS = 30_000;

export interface VerifiedGoogleProfile {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '='), 'base64');
}

function parseJwtPart<T>(part: string): T {
  try {
    return JSON.parse(base64UrlDecode(part).toString('utf8')) as T;
  } catch {
    throw new UnauthorizedException('invalid_google_token');
  }
}

@Injectable()
export class GoogleIdTokenService {
  private keys = new Map<string, GoogleJwk>();
  private keysExpireAt = 0;
  private keysLoadedAt = 0;
  private keysLoading: Promise<void> | null = null;

  private isEnabled() {
    return String(process.env.GOOGLE_AUTH_ENABLED || '').trim().toLowerCase() === 'true';
  }

  private clientId() {
    return String(process.env.GOOGLE_CLIENT_ID || '').trim();
  }

  private async fetchKeys() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_JWKS_TIMEOUT_MS);
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: controller.signal });
      if (!res.ok) throw new ServiceUnavailableException('google_jwks_unavailable');
      const cacheControl = res.headers.get('cache-control') || '';
      const rawMaxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
      const maxAge = Math.min(GOOGLE_JWKS_MAX_CACHE_SECONDS, Math.max(60, rawMaxAge));
      const body = await res.json() as { keys?: GoogleJwk[] };
      const nextKeys = new Map(
        (body.keys || [])
          .filter((key) => key.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'))
          .map((key) => [key.kid, key]),
      );
      if (nextKeys.size === 0) throw new ServiceUnavailableException('google_jwks_unavailable');
      const loadedAt = Date.now();
      this.keys = nextKeys;
      this.keysLoadedAt = loadedAt;
      this.keysExpireAt = loadedAt + maxAge * 1000;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('google_jwks_unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async loadKeys(force = false) {
    if (!force && this.keys.size && Date.now() < this.keysExpireAt) return;
    if (this.keysLoading) return this.keysLoading;

    const loading = this.fetchKeys();
    this.keysLoading = loading;
    try {
      await loading;
    } finally {
      if (this.keysLoading === loading) this.keysLoading = null;
    }
  }

  async verifyCredential(credential: string): Promise<VerifiedGoogleProfile> {
    if (!this.isEnabled()) throw new ServiceUnavailableException('google_auth_disabled');
    const expectedAud = this.clientId();
    if (!expectedAud) throw new ServiceUnavailableException('google_auth_not_configured');

    const parts = String(credential || '').split('.');
    if (parts.length !== 3) throw new UnauthorizedException('invalid_google_token');

    const header = parseJwtPart<{ alg?: string; kid?: string }>(parts[0]);
    const payload = parseJwtPart<Record<string, any>>(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) throw new UnauthorizedException('invalid_google_token');

    await this.loadKeys();
    let jwk = this.keys.get(header.kid);
    // Google may rotate signing keys before the prior Cache-Control window
    // ends. Refresh once for an unknown kid, but rate-limit that escape hatch
    // so arbitrary kid values cannot turn login into a JWKS fetch amplifier.
    if (!jwk && Date.now() - this.keysLoadedAt >= GOOGLE_UNKNOWN_KID_REFRESH_INTERVAL_MS) {
      await this.loadKeys(true);
      jwk = this.keys.get(header.kid);
    }
    if (!jwk) throw new UnauthorizedException('invalid_google_token');

    const ok = verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key: jwk as any, format: 'jwk' }),
      base64UrlDecode(parts[2]),
    );
    if (!ok) throw new UnauthorizedException('invalid_google_token');

    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const now = Math.floor(Date.now() / 1000);
    if (!aud.includes(expectedAud)) throw new UnauthorizedException('invalid_google_token');
    // OIDC tokens with multiple audiences must identify the authorized party.
    // Merely listing our client among several audiences is insufficient when
    // `azp` is absent or belongs to another client.
    if ((aud.length > 1 || payload.azp) && payload.azp !== expectedAud) {
      throw new UnauthorizedException('invalid_google_token');
    }
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') throw new UnauthorizedException('invalid_google_token');
    if (typeof payload.exp !== 'number' || payload.exp <= now) throw new UnauthorizedException('invalid_google_token');
    if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new UnauthorizedException('invalid_google_token');
    if (typeof payload.nbf === 'number' && payload.nbf > now + 300) throw new UnauthorizedException('invalid_google_token');
    if (!payload.sub || !payload.email || payload.email_verified !== true) throw new UnauthorizedException('invalid_google_token');

    return {
      googleId: String(payload.sub),
      email: String(payload.email).trim().toLowerCase(),
      name: payload.name ? String(payload.name).trim() : undefined,
      picture: payload.picture ? String(payload.picture).trim() : undefined,
    };
  }
}

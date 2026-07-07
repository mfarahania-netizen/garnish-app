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

  private isEnabled() {
    return String(process.env.GOOGLE_AUTH_ENABLED || '').trim().toLowerCase() === 'true';
  }

  private clientId() {
    return String(process.env.GOOGLE_CLIENT_ID || '').trim();
  }

  private async loadKeys() {
    if (this.keys.size && Date.now() < this.keysExpireAt) return;
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!res.ok) throw new ServiceUnavailableException('google_jwks_unavailable');
    const cacheControl = res.headers.get('cache-control') || '';
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
    const body = await res.json() as { keys?: GoogleJwk[] };
    this.keys = new Map((body.keys || []).filter((k) => k.kid && k.kty === 'RSA').map((k) => [k.kid, k]));
    this.keysExpireAt = Date.now() + Math.max(60, maxAge) * 1000;
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
    const jwk = this.keys.get(header.kid);
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
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') throw new UnauthorizedException('invalid_google_token');
    if (typeof payload.exp !== 'number' || payload.exp <= now) throw new UnauthorizedException('invalid_google_token');
    if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new UnauthorizedException('invalid_google_token');
    if (!payload.sub || !payload.email || payload.email_verified !== true) throw new UnauthorizedException('invalid_google_token');

    return {
      googleId: String(payload.sub),
      email: String(payload.email).trim().toLowerCase(),
      name: payload.name ? String(payload.name).trim() : undefined,
      picture: payload.picture ? String(payload.picture).trim() : undefined,
    };
  }
}

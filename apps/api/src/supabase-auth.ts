import { AuthenticationError, type AuthPort } from '@footebas/application';
import type { FakeAuthIdentity } from '@footebas/contracts';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface SupabaseAuthOptions {
  /** e.g. https://<project-ref>.supabase.co */
  readonly projectUrl: string;
  /** Injectable key source for tests; defaults to the project's JWKS. */
  readonly keys?: JWTVerifyGetKey;
}

const projectKeySets = new Map<string, JWTVerifyGetKey>();

/**
 * The project's JWKS, one per issuer for the whole isolate: the Worker builds
 * a `SupabaseJwtAuth` per request, and a fresh key set would fetch the JWKS
 * on every request. jose keeps the keys inside the set (refetching on an
 * unknown `kid`, after its cooldown, and when they get old), so rotation is
 * still picked up.
 */
export function projectKeys(issuer: string): JWTVerifyGetKey {
  let keys = projectKeySets.get(issuer);
  if (keys === undefined)
    projectKeySets.set(
      issuer,
      (keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))),
    );
  return keys;
}

/**
 * Validates Supabase Auth access tokens with the project's public signing
 * keys (asymmetric, JWKS). No shared secret lives in the API.
 */
export class SupabaseJwtAuth implements AuthPort {
  readonly #issuer: string;
  readonly #keys: JWTVerifyGetKey;

  public constructor(options: SupabaseAuthOptions) {
    const base = options.projectUrl.replace(/\/$/, '');
    this.#issuer = `${base}/auth/v1`;
    this.#keys = options.keys ?? projectKeys(this.#issuer);
  }

  public async authenticate(bearer: string): Promise<FakeAuthIdentity> {
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer;
    try {
      const { payload } = await jwtVerify(token, this.#keys, {
        issuer: this.#issuer,
        audience: 'authenticated',
      });
      const metadata = (payload.user_metadata ?? {}) as Record<string, unknown>;
      const email = typeof payload.email === 'string' ? payload.email : '';
      if (typeof payload.sub !== 'string' || email === '')
        throw new AuthenticationError('token without subject or e-mail');
      const name =
        typeof metadata.full_name === 'string'
          ? metadata.full_name
          : typeof metadata.name === 'string'
            ? metadata.name
            : email.split('@')[0];
      return {
        version: 1,
        userId: payload.sub,
        email,
        displayName: (name ?? email).slice(0, 160),
      };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError('invalid or expired access token');
    }
  }
}

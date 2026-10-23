import { AuthenticationError, type AuthPort } from '@footebas/application';
import type { FakeAuthIdentity } from '@footebas/contracts';

/** Fixed identity owned by the cloud smoke test (`tools/cloud-smoke`). */
export const SMOKE_IDENTITY: FakeAuthIdentity = Object.freeze({
  version: 1,
  userId: 'smoke-user',
  email: 'smoke@footebas.invalid',
  displayName: 'Fumaça',
});

/** Bearer prefix that selects the smoke path: `Bearer smoke:<SMOKE_TOKEN>`. */
export const SMOKE_BEARER_PREFIX = 'smoke:';
/** Shorter secrets are ignored so a weak value never opens the smoke path. */
export const SMOKE_TOKEN_MIN_LENGTH = 32;

const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(value)),
  );
}

/**
 * Constant-time equality: both sides are hashed to fixed-length digests, so
 * neither the content nor the length of the secret leaks through timing.
 */
async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++)
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

/**
 * Lets the cloud smoke test authenticate without a real Supabase user. Only
 * exists when the `SMOKE_TOKEN` secret is configured; every other bearer goes
 * to the wrapped port (Supabase JWT in production).
 */
export class SmokeTokenAuth implements AuthPort {
  readonly #fallback: AuthPort;
  readonly #secret: string;

  public constructor(fallback: AuthPort, secret: string) {
    if (secret.length < SMOKE_TOKEN_MIN_LENGTH)
      throw new RangeError(
        `SMOKE_TOKEN must have at least ${String(SMOKE_TOKEN_MIN_LENGTH)} characters`,
      );
    this.#fallback = fallback;
    this.#secret = secret;
  }

  public async authenticate(bearer: string): Promise<FakeAuthIdentity> {
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer;
    if (!token.startsWith(SMOKE_BEARER_PREFIX))
      return this.#fallback.authenticate(bearer);
    const candidate = token.slice(SMOKE_BEARER_PREFIX.length);
    if (!(await timingSafeEqual(candidate, this.#secret)))
      throw new AuthenticationError('invalid smoke token');
    return { ...SMOKE_IDENTITY };
  }
}

/**
 * Composes the smoke path over `auth` only when a strong enough secret is
 * present; otherwise returns `auth` untouched (the path does not exist).
 */
export function withSmokeAuth(auth: AuthPort, secret?: string): AuthPort {
  if (secret === undefined || secret.length < SMOKE_TOKEN_MIN_LENGTH)
    return auth;
  return new SmokeTokenAuth(auth, secret);
}

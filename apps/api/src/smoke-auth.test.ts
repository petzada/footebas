import { AuthenticationError, type AuthPort } from '@footebas/application';
import { describe, expect, it } from 'vitest';
import { SMOKE_IDENTITY, SmokeTokenAuth, withSmokeAuth } from './smoke-auth.js';

const secret = 'a'.repeat(20) + 'b'.repeat(20) + '0123456789';

/** Stands in for SupabaseJwtAuth: accepts only `Bearer jwt-ok`. */
const supabase: AuthPort = {
  authenticate(bearer) {
    if (bearer === 'Bearer jwt-ok')
      return Promise.resolve({
        version: 1,
        userId: '7b0c1f9e-3d2a-4c1b-9f3e-2a1b0c9d8e7f',
        email: 'marcio@footebas.com',
        displayName: 'Márcio',
      });
    return Promise.reject(
      new AuthenticationError('invalid or expired access token'),
    );
  },
};

describe('auth de fumaça', () => {
  it('autentica o usuário fixo com o token certo', async () => {
    const auth = withSmokeAuth(supabase, secret);
    await expect(auth.authenticate(`Bearer smoke:${secret}`)).resolves.toEqual(
      SMOKE_IDENTITY,
    );
    await expect(auth.authenticate(`smoke:${secret}`)).resolves.toMatchObject({
      userId: 'smoke_user',
      email: 'smoke@footebas.invalid',
      displayName: 'Fumaça',
    });
  });

  it('recusa token errado, truncado ou com sufixo', async () => {
    const auth = withSmokeAuth(supabase, secret);
    for (const wrong of [
      'smoke:',
      `smoke:${secret.slice(0, -1)}`,
      `smoke:${secret}x`,
      `smoke:${secret.toUpperCase()}`,
    ])
      await expect(auth.authenticate(`Bearer ${wrong}`)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
  });

  it('continua delegando JWTs do Supabase', async () => {
    const auth = withSmokeAuth(supabase, secret);
    await expect(auth.authenticate('Bearer jwt-ok')).resolves.toMatchObject({
      email: 'marcio@footebas.com',
    });
    await expect(auth.authenticate('Bearer jwt-bad')).rejects.toThrow(
      /invalid/,
    );
  });

  it('sem o secret o caminho não existe', async () => {
    for (const missing of [undefined, '', 'curto-demais']) {
      const auth = withSmokeAuth(supabase, missing);
      expect(auth).toBe(supabase);
      await expect(
        auth.authenticate(`Bearer smoke:${missing ?? ''}`),
      ).rejects.toThrow(/invalid or expired/);
    }
    expect(() => new SmokeTokenAuth(supabase, 'curto')).toThrow(RangeError);
  });
});

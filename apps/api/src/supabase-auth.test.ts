import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { SupabaseJwtAuth } from './supabase-auth.js';

const projectUrl = 'https://example-ref.supabase.co';

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'key-1', alg: 'ES256' };
  const auth = new SupabaseJwtAuth({
    projectUrl,
    keys: createLocalJWKSet({ keys: [jwk] }),
  });
  const sign = (
    claims: Record<string, unknown>,
    issuer = `${projectUrl}/auth/v1`,
  ) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setSubject('7b0c1f9e-3d2a-4c1b-9f3e-2a1b0c9d8e7f')
      .setExpirationTime('1h')
      .sign(privateKey);
  return { auth, sign };
}

describe('Supabase Auth na API', () => {
  it('aceita token válido e usa o sub como dono das carreiras', async () => {
    const { auth, sign } = await setup();
    const token = await sign({
      email: 'marcio@footebas.com',
      user_metadata: { full_name: 'Márcio' },
    });
    await expect(auth.authenticate(`Bearer ${token}`)).resolves.toEqual({
      version: 1,
      userId: '7b0c1f9e-3d2a-4c1b-9f3e-2a1b0c9d8e7f',
      email: 'marcio@footebas.com',
      displayName: 'Márcio',
    });
  });

  it('recusa emissor de outro projeto e token adulterado', async () => {
    const { auth, sign } = await setup();
    const foreign = await sign(
      { email: 'a@b.com' },
      'https://other.supabase.co/auth/v1',
    );
    await expect(auth.authenticate(foreign)).rejects.toThrow(/invalid/);
    const token = await sign({ email: 'a@b.com' });
    await expect(auth.authenticate(`${token}x`)).rejects.toThrow(/invalid/);
  });
});

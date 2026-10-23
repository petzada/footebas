import { describe, expect, it } from 'vitest';
import { createTestSigner } from './testing.js';
import {
  parsePublicKeyPems,
  RemotePublicKeys,
  StaticPublicKeys,
  verifyWithSource,
} from './webhook-signature.js';

const body = '{"event":"OPENPIX:CHARGE_COMPLETED","charge":{"value":4990}}';

describe('assinatura do webhook Woovi (RSA-SHA256, base64)', () => {
  it('aceita a assinatura sobre o corpo cru e recusa adulteração', async () => {
    const signer = await createTestSigner();
    const keys = new StaticPublicKeys([signer.publicKeyPem]);
    const signature = await signer.sign(body);
    await expect(verifyWithSource(keys, body, signature)).resolves.toBe(true);
    await expect(
      verifyWithSource(keys, body.replace('4990', '1'), signature),
    ).resolves.toBe(false);
    await expect(verifyWithSource(keys, body, undefined)).resolves.toBe(false);
    await expect(verifyWithSource(keys, body, '%%%')).resolves.toBe(false);
  });

  it('recusa assinatura de outra chave e aceita qualquer chave da rotação', async () => {
    const woovi = await createTestSigner();
    const attacker = await createTestSigner();
    const forged = await attacker.sign(body);
    await expect(
      verifyWithSource(
        new StaticPublicKeys([woovi.publicKeyPem]),
        body,
        forged,
      ),
    ).resolves.toBe(false);
    await expect(
      verifyWithSource(
        new StaticPublicKeys([woovi.publicKeyPem, attacker.publicKeyPem]),
        body,
        forged,
      ),
    ).resolves.toBe(true);
  });

  it('lê PEM puro, PEM com \\n literal e PEM em base64', async () => {
    const { publicKeyPem } = await createTestSigner();
    expect(parsePublicKeyPems(publicKeyPem)).toHaveLength(1);
    expect(
      parsePublicKeyPems(publicKeyPem.replaceAll('\n', '\\n')),
    ).toHaveLength(1);
    expect(parsePublicKeyPems(btoa(publicKeyPem))).toHaveLength(1);
    expect(parsePublicKeyPems(publicKeyPem + publicKeyPem)).toHaveLength(2);
    expect(parsePublicKeyPems('')).toEqual([]);
  });

  it('busca as chaves publicadas pela Woovi e recarrega na rotação', async () => {
    const old = await createTestSigner();
    const rotated = await createTestSigner();
    let published = old.publicKeyPem;
    let clock = 0;
    const urls: string[] = [];
    const keys = new RemotePublicKeys({
      apiUrl: 'https://api.woovi-sandbox.test/',
      now: () => clock,
      fetch: (url) => {
        urls.push(url);
        return Promise.resolve(
          Response.json({
            public_keys: [{ key: published, is_current: true }],
          }),
        );
      },
    });
    await expect(
      verifyWithSource(keys, body, await old.sign(body)),
    ).resolves.toBe(true);
    expect(urls).toEqual([
      'https://api.woovi-sandbox.test/api/v1/webhook/public-keys',
    ]);
    published = rotated.publicKeyPem;
    clock = 2 * 60 * 1000;
    await expect(
      verifyWithSource(keys, body, await rotated.sign(body)),
    ).resolves.toBe(true);
    expect(urls).toHaveLength(2);
  });
});

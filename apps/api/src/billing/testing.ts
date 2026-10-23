// Test support: an RSA key pair standing in for Woovi's signing key.
const ALGORITHM = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
} as const;

function toBase64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface TestSigner {
  /** PEM (SPKI) public key, as Woovi publishes it. */
  readonly publicKeyPem: string;
  /** base64(RSA-SHA256(body)) — the `x-webhook-signature` value. */
  sign(body: string): Promise<string>;
}

export async function createTestSigner(): Promise<TestSigner> {
  const pair = await crypto.subtle.generateKey(ALGORITHM, true, [
    'sign',
    'verify',
  ]);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  const lines = toBase64(spki).match(/.{1,64}/g) ?? [];
  return {
    publicKeyPem: `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----\n`,
    async sign(body: string) {
      return toBase64(
        await crypto.subtle.sign(
          ALGORITHM,
          pair.privateKey,
          new TextEncoder().encode(body),
        ),
      );
    },
  };
}

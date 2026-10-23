// Woovi webhook authenticity (docs: /docs/webhook/seguranca/webhook-signature-validation
// and /docs/webhook/seguranca/webhook-public-keys):
//   header `x-webhook-signature` = base64(RSA-SHA256(raw body, Woovi private key))
//   public keys: GET <api>/api/v1/webhook/public-keys -> { public_keys: [{ key (PEM SPKI), is_current }] }
// During a rotation more than one key is valid, so any listed key may verify.
// Verification runs on the raw body exactly as received (never re-serialized).

export const WOOVI_SIGNATURE_HEADER = 'x-webhook-signature';

const encoder = new TextEncoder();
/** WebCrypto key (no DOM lib here, so derive the type from the API). */
export type VerifyKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;
const ALGORITHM = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/\s+/g, ''));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Splits one or more PEM public keys. Accepts the PEM itself or the
 * base64-encoded PEM that the Woovi panel/docs also show.
 */
export function parsePublicKeyPems(value: string): string[] {
  let source = value.trim();
  if (source === '') return [];
  if (!source.includes('BEGIN PUBLIC KEY')) {
    try {
      source = new TextDecoder().decode(base64ToBytes(source));
    } catch {
      return [];
    }
  }
  // Env vars often carry literal "\n" sequences instead of newlines.
  source = source.replace(/\\n/g, '\n');
  return [
    ...source.matchAll(
      /-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/g,
    ),
  ].map((match) => match[0]);
}

async function importPem(pem: string): Promise<VerifyKey> {
  const body = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '');
  return crypto.subtle.importKey(
    'spki',
    base64ToBytes(body),
    ALGORITHM,
    false,
    ['verify'],
  );
}

/** True when any key verifies `signature` (base64) over `rawBody`. */
export async function verifyWooviSignature(
  rawBody: string,
  signature: string | undefined,
  keys: readonly VerifyKey[],
): Promise<boolean> {
  if (signature === undefined || signature.trim() === '' || keys.length === 0)
    return false;
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64ToBytes(signature.trim());
  } catch {
    return false;
  }
  const data = encoder.encode(rawBody);
  for (const key of keys) {
    try {
      if (await crypto.subtle.verify(ALGORITHM, key, bytes, data)) return true;
    } catch {
      // Malformed signature for this key: try the next one.
    }
  }
  return false;
}

export interface PublicKeySource {
  keys(): Promise<readonly VerifyKey[]>;
  /** Forces the next `keys()` to reload (key rotation); no-op for static keys. */
  refresh?(): void;
}

/** Keys pinned through WOOVI_WEBHOOK_PUBLIC_KEYS (preferred in production). */
export class StaticPublicKeys implements PublicKeySource {
  readonly #keys: Promise<readonly VerifyKey[]>;

  public constructor(pems: readonly string[]) {
    if (pems.length === 0) throw new RangeError('no public key provided');
    this.#keys = Promise.all(pems.map(importPem));
  }

  public keys(): Promise<readonly VerifyKey[]> {
    return this.#keys;
  }
}

interface CacheEntry {
  readonly loadedAt: number;
  readonly keys: Promise<readonly VerifyKey[]>;
}
const remoteCache = new Map<string, CacheEntry>();

/**
 * Fetches Woovi's published keys from `<apiUrl>/api/v1/webhook/public-keys`
 * (no auth) and caches them per isolate for `ttlMs`.
 */
export class RemotePublicKeys implements PublicKeySource {
  readonly #url: string;
  readonly #fetch: (input: string) => Promise<Response>;
  readonly #ttlMs: number;
  readonly #now: () => number;

  public constructor(options: {
    apiUrl: string;
    fetch?: (input: string) => Promise<Response>;
    ttlMs?: number;
    now?: () => number;
  }) {
    this.#url = `${options.apiUrl.replace(/\/+$/, '')}/api/v1/webhook/public-keys`;
    this.#fetch = options.fetch ?? ((input) => fetch(input));
    this.#ttlMs = options.ttlMs ?? 60 * 60 * 1000;
    this.#now = options.now ?? Date.now;
  }

  async #load(): Promise<readonly VerifyKey[]> {
    const response = await this.#fetch(this.#url);
    if (!response.ok)
      throw new Error(`public keys fetch failed (${String(response.status)})`);
    const body = (await response.json()) as {
      public_keys?: readonly { key?: unknown }[];
    };
    const pems = (body.public_keys ?? [])
      .map((entry) => entry.key)
      .filter((key): key is string => typeof key === 'string')
      .flatMap(parsePublicKeyPems);
    if (pems.length === 0) throw new Error('no public keys published');
    return Promise.all(pems.map(importPem));
  }

  public keys(): Promise<readonly VerifyKey[]> {
    const cached = remoteCache.get(this.#url);
    if (cached !== undefined && this.#now() - cached.loadedAt < this.#ttlMs)
      return cached.keys;
    const keys = this.#load();
    remoteCache.set(this.#url, { loadedAt: this.#now(), keys });
    keys.catch(() => remoteCache.delete(this.#url));
    return keys;
  }

  /** Reloads at most once a minute, so forged requests cannot hammer Woovi. */
  public refresh(): void {
    const cached = remoteCache.get(this.#url);
    if (cached !== undefined && this.#now() - cached.loadedAt < 60_000) return;
    remoteCache.delete(this.#url);
  }
}

/** Verifies with the source, reloading remote keys once on failure (rotation). */
export async function verifyWithSource(
  source: PublicKeySource,
  rawBody: string,
  signature: string | undefined,
): Promise<boolean> {
  if (await verifyWooviSignature(rawBody, signature, await source.keys()))
    return true;
  if (source.refresh === undefined || signature === undefined) return false;
  source.refresh();
  return verifyWooviSignature(rawBody, signature, await source.keys());
}

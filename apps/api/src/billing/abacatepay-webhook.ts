// AbacatePay webhooks (v2): authenticity and interpretation.
// Docs: https://docs.abacatepay.com/pages/webhooks.md
//   - The `secret` set on the webhook arrives in the `webhookSecret` query
//     parameter of every delivery; it is what proves the origin.
//   - `X-Webhook-Signature` is base64 HMAC-SHA256 of the raw body keyed with
//     AbacatePay's published public key; it proves the body was not altered.
//   - Every retry of an event carries the same top-level `id` (idempotency).
import type { Json } from './billing-repository.js';
import {
  redactPersonalData,
  type InterpretedWebhook,
} from './webhook-events.js';

export const ABACATEPAY_SIGNATURE_HEADER = 'x-webhook-signature';

/** Public HMAC key published in AbacatePay's webhook security docs. */
export const ABACATEPAY_PUBLIC_HMAC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

const encoder = new TextEncoder();
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;
const field = (value: unknown, key: string): unknown =>
  isObject(value) ? value[key] : undefined;

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(value)),
  );
}

/** Constant-time equality over SHA-256 digests (length never leaks). */
export async function sameSecret(
  left: string,
  right: string,
): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++)
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

export async function abacateSignature(
  rawBody: string,
  key = ABACATEPAY_PUBLIC_HMAC_KEY,
): Promise<string> {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(rawBody)),
  );
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Accepts the delivery only when the URL secret matches; when the signature
 * header is present it must match the body too.
 */
export async function verifyAbacateWebhook(
  rawBody: string,
  headers: Readonly<Record<string, string | undefined>>,
  query: Readonly<Record<string, string | undefined>>,
  secret: string,
): Promise<boolean> {
  if (secret === '' || !(await sameSecret(query.webhookSecret ?? '', secret)))
    return false;
  const signature = headers[ABACATEPAY_SIGNATURE_HEADER];
  if (signature === undefined || signature === '') return true;
  return sameSecret(await abacateSignature(rawBody), signature);
}

/** Turns a verified AbacatePay event into a billing effect. */
export function interpretAbacateWebhook(
  body: unknown,
  now: Date,
): InterpretedWebhook {
  const type = text(field(body, 'event')) ?? 'unknown';
  const eventId = text(field(body, 'id')) ?? `${type}:${now.toISOString()}`;
  const payload = redactPersonalData(isObject(body) ? body : {}) as Json;
  const transparent = field(field(body, 'data'), 'transparent');
  const chargeId = text(field(transparent, 'id'));
  const correlationId =
    text(field(transparent, 'externalId')) ??
    text(field(field(transparent, 'metadata'), 'correlationID'));
  const ignored: InterpretedWebhook = {
    id: eventId,
    type,
    payload,
    effect: { kind: 'ignored' },
  };

  if (type === 'transparent.completed') {
    const status = text(field(transparent, 'status'));
    if (
      correlationId === undefined ||
      (status !== 'PAID' && status !== 'APPROVED')
    )
      return ignored;
    const amount = field(transparent, 'amount');
    return {
      id: eventId,
      type,
      payload,
      effect: {
        kind: 'paid',
        correlationId,
        amountCents: typeof amount === 'number' ? amount : Number.NaN,
        paidAt: text(field(transparent, 'updatedAt')) ?? now.toISOString(),
        charge: redactPersonalData(transparent) as Json,
      },
    };
  }

  if (type === 'transparent.refunded' && chargeId !== undefined)
    return {
      id: eventId,
      type,
      payload,
      // The service stores the original charge id as the refund reference.
      effect: { kind: 'refund_confirmed', endToEndIds: [chargeId] },
    };

  return ignored;
}

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

/**
 * Where the charge object may sit in a v2 event. The public docs only show
 * the envelope (`id`, `event`, `apiVersion`, `devMode`, `data`), so parsing
 * is tolerant: the first object found wins.
 */
const CHARGE_PATHS: readonly (readonly string[])[] = [
  ['data', 'transparent'],
  ['data', 'pixQrCode'],
  ['data', 'charge'],
  ['data', 'payment'],
  ['data', 'billing'],
  ['data'],
];

function at(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((current, key) => field(current, key), value);
}

/** Charge object of the event, or `data` itself when nothing nests it. */
function chargeOf(body: unknown): Readonly<Record<string, unknown>> {
  for (const path of CHARGE_PATHS) {
    const candidate = at(body, path);
    if (isObject(candidate) && text(candidate.id) !== undefined)
      return candidate;
  }
  const data = field(body, 'data');
  return isObject(data) ? data : {};
}

/** AbacatePay charge id (`pix_char_…`) of the event, wherever it is. */
export function abacateChargeId(body: unknown): string | undefined {
  const data = field(body, 'data');
  return (
    text(chargeOf(body).id) ??
    text(field(data, 'transparentId')) ??
    text(field(data, 'pixQrCodeId')) ??
    text(field(data, 'chargeId'))
  );
}

const PAID_STATUSES = new Set(['PAID', 'APPROVED', 'REDEEMED']);

async function sha256Hex(value: string): Promise<string> {
  return [...(await digest(value))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Turns a verified AbacatePay event into a billing effect. The order is
 * matched by the provider charge id first: AbacatePay does not echo
 * `externalId` or `metadata` back (observed in production), so our
 * correlationID is only a fallback.
 */
export async function interpretAbacateWebhook(
  body: unknown,
  now: Date,
  rawBody: string = JSON.stringify(body),
): Promise<InterpretedWebhook> {
  const type = text(field(body, 'event')) ?? 'unknown';
  const charge = chargeOf(body);
  const chargeId = abacateChargeId(body);
  // Retries carry the same `id`; without one, derive a stable key (never
  // the clock, which would make every retry look new).
  const eventId =
    text(field(body, 'id')) ??
    (chargeId === undefined
      ? `${type}:sha256:${await sha256Hex(rawBody)}`
      : `${type}:${chargeId}`);
  const payload = redactPersonalData(isObject(body) ? body : {}) as Json;
  const data = field(body, 'data');
  const correlationId =
    text(charge.externalId) ??
    text(field(charge.metadata, 'correlationID')) ??
    text(field(data, 'externalId')) ??
    text(field(field(data, 'metadata'), 'correlationID'));
  const ignored: InterpretedWebhook = {
    id: eventId,
    type,
    payload,
    effect: { kind: 'ignored' },
  };

  if (type === 'transparent.completed') {
    const status = text(charge.status);
    // The event name already says "paid"; a status, when present, must agree.
    if (
      (chargeId === undefined && correlationId === undefined) ||
      (status !== undefined && !PAID_STATUSES.has(status))
    )
      return ignored;
    const amount = charge.amount;
    return {
      id: eventId,
      type,
      payload,
      effect: {
        kind: 'paid',
        ...(chargeId === undefined ? {} : { providerChargeId: chargeId }),
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(typeof amount === 'number' ? { amountCents: amount } : {}),
        paidAt: text(charge.updatedAt) ?? now.toISOString(),
        charge: redactPersonalData(charge) as Json,
      },
    };
  }

  if (
    (type === 'transparent.refunded' ||
      type === 'transparent.disputed' ||
      type === 'transparent.lost') &&
    chargeId !== undefined
  )
    return {
      id: eventId,
      type,
      payload,
      effect: {
        // A dispute takes the money back until it is settled: revoke now.
        // `lost` (dispute lost) is final, like a refund.
        kind: type === 'transparent.disputed' ? 'disputed' : 'refund_confirmed',
        providerChargeIds: [chargeId],
        // Refunds started in the app store the charge id as their reference.
        endToEndIds: [chargeId],
      },
    };

  return ignored;
}

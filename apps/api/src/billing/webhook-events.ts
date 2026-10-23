// Turns a verified Woovi webhook body into a billing effect plus a stable
// idempotency key. Woovi payloads carry no event id, so the key is derived
// from the event type and the business identifier it refers to:
//   OPENPIX:CHARGE_*                       -> `<event>:<charge.correlationID>`
//   PIX_TRANSACTION_REFUND_SENT_*          -> `<event>:<refundTransaction.endToEndId>`
//   anything else                          -> `<event>:sha256(raw body)`
// Event names: https://developers.woovi.com/docs/webhook/webhook-events-type
import type { BillingEffect, Json } from './billing-repository.js';

export interface InterpretedWebhook {
  readonly id: string;
  readonly type: string;
  readonly payload: Json;
  readonly effect: BillingEffect;
}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;
const field = (value: unknown, key: string): unknown =>
  isObject(value) ? value[key] : undefined;

/** Keys holding payer/customer personal data (CPF, names, bank accounts). */
const PERSONAL_KEYS = new Set([
  'customer',
  'payer',
  'taxID',
  'debitParty',
  'creditParty',
  'holder',
  'infoPagador',
  'email',
  'phone',
  'name',
]);

/** Deep copy without personal data (LGPD): only what reconciliation needs. */
export function redactPersonalData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPersonalData);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PERSONAL_KEYS.has(key))
      .map(([key, item]) => [key, redactPersonalData(item)]),
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const CHARGE_PAID_EVENTS = new Set([
  'OPENPIX:CHARGE_COMPLETED',
  'OPENPIX:CHARGE_COMPLETED_NOT_SAME_CUSTOMER_PAYER',
]);
export const CHARGE_EXPIRED_EVENT = 'OPENPIX:CHARGE_EXPIRED';
export const REFUND_CONFIRMED_EVENT = 'PIX_TRANSACTION_REFUND_SENT_CONFIRMED';
export const REFUND_REJECTED_EVENT = 'PIX_TRANSACTION_REFUND_SENT_REJECTED';

export async function interpretWooviWebhook(
  body: unknown,
  rawBody: string,
  now: Date,
): Promise<InterpretedWebhook> {
  // Woovi's registration ping uses `evento` instead of `event`.
  const type =
    text(field(body, 'event')) ?? text(field(body, 'evento')) ?? 'unknown';
  const payload = redactPersonalData(isObject(body) ? body : {}) as Json;
  const fallback = async (): Promise<InterpretedWebhook> => ({
    id: `${type}:${await sha256Hex(rawBody)}`,
    type,
    payload,
    effect: { kind: 'ignored' },
  });

  if (CHARGE_PAID_EVENTS.has(type) || type === CHARGE_EXPIRED_EVENT) {
    const charge = field(body, 'charge');
    const correlationId = text(field(charge, 'correlationID'));
    if (correlationId === undefined) return fallback();
    const id = `${type}:${correlationId}`;
    if (type === CHARGE_EXPIRED_EVENT)
      return { id, type, payload, effect: { kind: 'expired', correlationId } };
    const pix = field(body, 'pix');
    const value = field(charge, 'value');
    const pixEndToEndId = text(field(pix, 'endToEndId'));
    return {
      id,
      type,
      payload,
      effect: {
        kind: 'paid',
        correlationId,
        amountCents: typeof value === 'number' ? value : Number.NaN,
        paidAt:
          text(field(charge, 'paidAt')) ??
          text(field(pix, 'time')) ??
          now.toISOString(),
        ...(pixEndToEndId === undefined ? {} : { pixEndToEndId }),
        charge: redactPersonalData(charge) as Json,
      },
    };
  }

  if (type === REFUND_CONFIRMED_EVENT || type === REFUND_REJECTED_EVENT) {
    const refund = field(body, 'refundTransaction');
    const original = field(body, 'originalTransaction');
    const refundId =
      text(field(refund, 'endToEndId')) ?? text(field(refund, 'globalID'));
    if (refundId === undefined) return fallback();
    const endToEndIds = [
      text(field(refund, 'endToEndId')),
      text(field(original, 'endToEndId')),
    ].filter((item): item is string => item !== undefined);
    return {
      id: `${type}:${refundId}`,
      type,
      payload,
      effect: {
        kind:
          type === REFUND_CONFIRMED_EVENT
            ? 'refund_confirmed'
            : 'refund_rejected',
        endToEndIds,
      },
    };
  }

  return fallback();
}

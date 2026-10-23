// AbacatePay REST client (API v2) for the Workers runtime: plain `fetch`.
// Docs: https://docs.abacatepay.com/llms.txt — Checkout Transparente PIX:
//   POST /transparents/create   GET /transparents/check?id=   POST /transparents/refund
// Auth: `Authorization: Bearer <api key>`; amounts in cents; responses use the
// `{ data, success, error }` envelope. Dev mode and production share the URL —
// the key decides the environment.
import {
  WooviApiError,
  type CreateChargeInput,
  type RefundChargeInput,
  type WooviCharge,
  type WooviChargeStatus,
  type WooviClient,
  type WooviRefund,
} from './woovi-client.js';

export const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v2';

export interface AbacatePayClientOptions {
  /** Secret ABACATEPAY_API_KEY (`wrangler secret put`). */
  readonly apiKey: string;
  readonly apiUrl?: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

interface Envelope {
  readonly data?: unknown;
  readonly success?: boolean;
  readonly error?: unknown;
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** AbacatePay charge status → the provider-neutral status the service uses. */
export function chargeStatusOf(status: unknown): WooviChargeStatus {
  switch (status) {
    case 'PAID':
    case 'APPROVED':
    case 'REDEEMED':
    case 'REFUNDED':
    case 'UNDER_DISPUTE':
      return 'COMPLETED';
    case 'EXPIRED':
    case 'CANCELLED':
    case 'FAILED':
      return 'EXPIRED';
    default:
      return 'ACTIVE';
  }
}

export function chargeFromAbacate(
  correlationID: string,
  data: Readonly<Record<string, unknown>>,
): WooviCharge {
  const id = text(data.id);
  const brCode = text(data.brCode);
  const image = text(data.brCodeBase64);
  const expiresAt = text(data.expiresAt);
  const paidAt =
    chargeStatusOf(data.status) === 'COMPLETED'
      ? text(data.updatedAt)
      : undefined;
  return {
    correlationID,
    status: chargeStatusOf(data.status),
    value: typeof data.amount === 'number' ? data.amount : 0,
    ...(brCode === undefined ? {} : { brCode }),
    ...(image === undefined ? {} : { qrCodeImage: image }),
    ...(expiresAt === undefined ? {} : { expiresDate: expiresAt }),
    ...(id === undefined ? {} : { globalID: id }),
    ...(paidAt === undefined ? {} : { paidAt }),
    raw: data,
  };
}

/**
 * PIX provider over AbacatePay's transparent checkout. `getCharge` and
 * `refundCharge` need AbacatePay's own charge id (`pix_char_…`), which the
 * service stores on the order as `providerChargeId`.
 */
export class AbacatePayClient implements WooviClient {
  readonly #apiKey: string;
  readonly #apiUrl: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  public constructor(options: AbacatePayClientOptions) {
    if (options.apiKey.trim() === '')
      throw new RangeError('ABACATEPAY_API_KEY is required');
    this.#apiKey = options.apiKey.trim();
    this.#apiUrl = (options.apiUrl ?? ABACATEPAY_API_URL).replace(/\/$/, '');
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs ?? 10_000;
  }

  async #call(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<Readonly<Record<string, unknown>>> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#apiUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      throw new WooviApiError('AbacatePay unreachable');
    }
    let envelope: Envelope;
    try {
      envelope = (await response.json()) as Envelope;
    } catch {
      throw new WooviApiError(
        `AbacatePay answered ${String(response.status)} without JSON`,
        response.status,
      );
    }
    if (!response.ok || envelope.success === false || !isObject(envelope.data))
      throw new WooviApiError(
        `AbacatePay ${path} failed (${String(response.status)}): ${
          text(envelope.error) ?? 'unknown error'
        }`,
        response.status,
      );
    return envelope.data;
  }

  public async createCharge(input: CreateChargeInput): Promise<WooviCharge> {
    const data = await this.#call('POST', '/transparents/create', {
      method: 'PIX',
      data: {
        amount: input.value,
        expiresIn: input.expiresIn,
        ...(input.comment === undefined ? {} : { description: input.comment }),
        externalId: input.correlationID,
        metadata: { correlationID: input.correlationID },
      },
    });
    return chargeFromAbacate(input.correlationID, data);
  }

  public async getCharge(
    correlationID: string,
    providerId?: string,
  ): Promise<WooviCharge | undefined> {
    if (providerId === undefined) return undefined;
    const data = await this.#call(
      'GET',
      `/transparents/check?id=${encodeURIComponent(providerId)}`,
    );
    return chargeFromAbacate(correlationID, data);
  }

  public async refundCharge(
    chargeCorrelationID: string,
    input: RefundChargeInput,
    providerId?: string,
  ): Promise<WooviRefund> {
    if (providerId === undefined)
      throw new WooviApiError(
        `charge ${chargeCorrelationID} has no AbacatePay id to refund`,
      );
    try {
      const data = await this.#call('POST', '/transparents/refund', {
        id: providerId,
        ...(input.comment === undefined ? {} : { reason: input.comment }),
      });
      return {
        correlationID: input.correlationID,
        // The original charge id is what `transparent.refunded` carries.
        endToEndId: providerId,
        status: data.status === 'COMPLETE' ? 'CONFIRMED' : 'IN_PROCESSING',
        value:
          typeof data.amount === 'number' ? data.amount : (input.value ?? 0),
        raw: data,
      };
    } catch (error) {
      // "Esta cobrança já foi reembolsada." — treat as already refunded.
      if (error instanceof WooviApiError && /reembolsad/i.test(error.message))
        return {
          correlationID: input.correlationID,
          endToEndId: providerId,
          status: 'CONFIRMED',
          value: input.value ?? 0,
          raw: { originalId: providerId, alreadyRefunded: true },
        };
      throw error;
    }
  }
}

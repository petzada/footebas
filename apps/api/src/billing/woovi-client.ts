// Woovi (OpenPix) REST client for the Workers runtime: plain `fetch`, no SDK.
// Docs: https://developers.woovi.com (API reference: /api/openapi.json).
//   Production: https://api.woovi.com   Sandbox: https://api.woovi-sandbox.com
//   Auth: `Authorization: <AppID>` (raw AppID, no "Bearer").

export type WooviChargeStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export interface WooviCharge {
  readonly correlationID: string;
  readonly status: WooviChargeStatus;
  readonly value: number;
  readonly brCode?: string;
  readonly qrCodeImage?: string;
  readonly paymentLinkUrl?: string;
  readonly expiresDate?: string;
  readonly globalID?: string;
  readonly transactionID?: string;
  readonly paidAt?: string;
  /** Raw charge object as returned by Woovi (for audit). */
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface WooviRefund {
  readonly correlationID: string;
  /** e.g. IN_PROCESSING, CONFIRMED, REJECTED */
  readonly status: string;
  readonly value: number;
  readonly endToEndId?: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface CreateChargeInput {
  /** Unique per order; Woovi dedupes with `return_existing=true`. */
  readonly correlationID: string;
  /** Amount in cents (BRL). */
  readonly value: number;
  /** Seconds until the QR code expires (Woovi minimum: 300). */
  readonly expiresIn: number;
  readonly comment?: string;
}

export interface RefundChargeInput {
  /** The refund's own correlationID (idempotency key on Woovi). */
  readonly correlationID: string;
  /** Cents; omitted = full amount. */
  readonly value?: number;
  readonly comment?: string;
}

/** Port used by the billing service; the HTTP adapter and test fakes implement it. */
export interface WooviClient {
  createCharge(input: CreateChargeInput): Promise<WooviCharge>;
  getCharge(correlationID: string): Promise<WooviCharge | undefined>;
  refundCharge(
    chargeCorrelationID: string,
    input: RefundChargeInput,
  ): Promise<WooviRefund>;
}

/** Upstream failure (network, timeout, 4xx/5xx). Never carries the AppID. */
export class WooviApiError extends Error {
  public constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'WooviApiError';
  }
}

export const WOOVI_PRODUCTION_URL = 'https://api.woovi.com';
export const WOOVI_SANDBOX_URL = 'https://api.woovi-sandbox.com';

export interface WooviHttpClientOptions {
  /** WOOVI_API_URL: sandbox or production base URL. */
  readonly apiUrl: string;
  /** WOOVI_APP_ID secret. */
  readonly appId: string;
  readonly fetch?: (input: string, init: RequestInit) => Promise<Response>;
  readonly timeoutMs?: number;
}

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export function parseWooviCharge(value: unknown): WooviCharge {
  if (!isObject(value)) throw new WooviApiError('charge missing in response');
  const correlationID = text(value.correlationID);
  const status = value.status;
  if (
    correlationID === undefined ||
    (status !== 'ACTIVE' && status !== 'COMPLETED' && status !== 'EXPIRED') ||
    typeof value.value !== 'number'
  )
    throw new WooviApiError('unexpected charge shape');
  const optional = {
    brCode: text(value.brCode),
    qrCodeImage: text(value.qrCodeImage),
    paymentLinkUrl: text(value.paymentLinkUrl),
    expiresDate: text(value.expiresDate),
    globalID: text(value.globalID),
    transactionID: text(value.transactionID),
    paidAt: text(value.paidAt),
  };
  return {
    correlationID,
    status,
    value: value.value,
    ...(Object.fromEntries(
      Object.entries(optional).filter(([, item]) => item !== undefined),
    ) as Partial<Record<keyof typeof optional, string>>),
    raw: value,
  };
}

function parseRefund(value: unknown): WooviRefund {
  if (!isObject(value)) throw new WooviApiError('refund missing in response');
  const correlationID = text(value.correlationID);
  const status = text(value.status);
  if (
    correlationID === undefined ||
    status === undefined ||
    typeof value.value !== 'number'
  )
    throw new WooviApiError('unexpected refund shape');
  const endToEndId = text(value.endToEndId);
  return {
    correlationID,
    status,
    value: value.value,
    ...(endToEndId === undefined ? {} : { endToEndId }),
    raw: value,
  };
}

export class WooviHttpClient implements WooviClient {
  readonly #base: string;
  readonly #appId: string;
  readonly #fetch: (input: string, init: RequestInit) => Promise<Response>;
  readonly #timeoutMs: number;

  public constructor(options: WooviHttpClientOptions) {
    if (options.appId.trim() === '')
      throw new RangeError('WOOVI_APP_ID is required');
    this.#base = options.apiUrl.replace(/\/+$/, '');
    this.#appId = options.appId.trim();
    // Never call a detached global `fetch` on Workers ("Illegal invocation").
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs ?? 10_000;
  }

  async #request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#base}${path}`, {
        method,
        headers: {
          authorization: this.#appId,
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error';
      throw new WooviApiError(`woovi request failed (${name})`);
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = undefined;
    }
    return { status: response.status, json };
  }

  #fail(status: number, json: unknown, action: string): never {
    const detail =
      isObject(json) && typeof json.error === 'string'
        ? `: ${json.error.slice(0, 200)}`
        : '';
    throw new WooviApiError(
      `woovi ${action} failed with ${String(status)}${detail}`,
      status,
    );
  }

  public async createCharge(input: CreateChargeInput): Promise<WooviCharge> {
    const { status, json } = await this.#request(
      'POST',
      '/api/v1/charge?return_existing=true',
      {
        correlationID: input.correlationID,
        value: input.value,
        type: 'DYNAMIC',
        expiresIn: input.expiresIn,
        ...(input.comment === undefined ? {} : { comment: input.comment }),
      },
    );
    if (status < 200 || status >= 300)
      this.#fail(status, json, 'create charge');
    if (!isObject(json)) throw new WooviApiError('empty charge response');
    const charge = parseWooviCharge(json.charge);
    // The top-level brCode is the canonical "copia e cola" string.
    const brCode = text(json.brCode) ?? charge.brCode;
    return brCode === undefined ? charge : { ...charge, brCode };
  }

  public async getCharge(
    correlationID: string,
  ): Promise<WooviCharge | undefined> {
    const { status, json } = await this.#request(
      'GET',
      `/api/v1/charge/${encodeURIComponent(correlationID)}`,
    );
    if (status === 404) return undefined;
    if (status < 200 || status >= 300) this.#fail(status, json, 'get charge');
    if (!isObject(json)) throw new WooviApiError('empty charge response');
    return parseWooviCharge(json.charge);
  }

  public async refundCharge(
    chargeCorrelationID: string,
    input: RefundChargeInput,
  ): Promise<WooviRefund> {
    const { status, json } = await this.#request(
      'POST',
      `/api/v1/charge/${encodeURIComponent(chargeCorrelationID)}/refund`,
      {
        correlationID: input.correlationID,
        ...(input.value === undefined ? {} : { value: input.value }),
        ...(input.comment === undefined
          ? {}
          : { comment: input.comment.slice(0, 140) }),
      },
    );
    if (status < 200 || status >= 300) this.#fail(status, json, 'refund');
    if (!isObject(json)) throw new WooviApiError('empty refund response');
    return parseRefund(json.refund);
  }
}

/** Stand-in when WOOVI_APP_ID is not configured: every call fails cleanly. */
export class UnconfiguredWooviClient implements WooviClient {
  public createCharge(): Promise<WooviCharge> {
    return Promise.reject(new WooviApiError('billing not configured'));
  }
  public getCharge(): Promise<WooviCharge | undefined> {
    return Promise.reject(new WooviApiError('billing not configured'));
  }
  public refundCharge(): Promise<WooviRefund> {
    return Promise.reject(new WooviApiError('billing not configured'));
  }
}

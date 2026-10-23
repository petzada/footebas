// Offline Woovi stand-in for tests and the local dev server. Behaves like the
// real API where billing depends on it: idempotent charge per correlationID,
// status transitions and refunds keyed by their own correlationID.
import type {
  CreateChargeInput,
  RefundChargeInput,
  WooviCharge,
  WooviChargeStatus,
  WooviClient,
  WooviRefund,
} from './woovi-client.js';
import { WooviApiError } from './woovi-client.js';

export class FakeWooviClient implements WooviClient {
  readonly #charges = new Map<string, WooviCharge>();
  readonly #refunds = new Map<string, WooviRefund>();
  public readonly calls: { method: string; correlationID: string }[] = [];
  /** Status the next refund is answered with (Woovi usually: IN_PROCESSING). */
  public refundStatus = 'IN_PROCESSING';
  /** When set, every call fails like an unreachable provider. */
  public failing = false;

  public constructor(private readonly now: () => Date = () => new Date()) {}

  #guard(method: string, correlationID: string): void {
    this.calls.push({ method, correlationID });
    if (this.failing) throw new WooviApiError('woovi request failed (fake)');
  }

  public createCharge(input: CreateChargeInput): Promise<WooviCharge> {
    this.#guard('createCharge', input.correlationID);
    const existing = this.#charges.get(input.correlationID);
    if (existing) return Promise.resolve(existing);
    const id = input.correlationID;
    const charge: WooviCharge = {
      correlationID: id,
      status: 'ACTIVE',
      value: input.value,
      brCode: `00020101021226FAKEBRCODE${id}5204000053039865802BR6304ABCD`,
      qrCodeImage: `https://api.woovi-sandbox.com/openpix/charge/brcode/image/${id}.png`,
      paymentLinkUrl: `https://woovi-sandbox.com/pay/${id}`,
      expiresDate: new Date(
        this.now().getTime() + input.expiresIn * 1000,
      ).toISOString(),
      globalID: `fake-global-${id}`,
      raw: { correlationID: id, value: input.value, status: 'ACTIVE' },
    };
    this.#charges.set(id, charge);
    return Promise.resolve(charge);
  }

  public getCharge(correlationID: string): Promise<WooviCharge | undefined> {
    this.#guard('getCharge', correlationID);
    return Promise.resolve(this.#charges.get(correlationID));
  }

  public refundCharge(
    chargeCorrelationID: string,
    input: RefundChargeInput,
  ): Promise<WooviRefund> {
    this.#guard('refundCharge', chargeCorrelationID);
    const charge = this.#charges.get(chargeCorrelationID);
    if (charge?.status !== 'COMPLETED')
      return Promise.reject(
        new WooviApiError('woovi refund failed with 400', 400),
      );
    const existing = this.#refunds.get(input.correlationID);
    if (existing) return Promise.resolve(existing);
    const refund: WooviRefund = {
      correlationID: input.correlationID,
      status: this.refundStatus,
      value: input.value ?? charge.value,
      endToEndId: `D${input.correlationID}`,
      raw: { correlationID: input.correlationID, status: this.refundStatus },
    };
    this.#refunds.set(input.correlationID, refund);
    return Promise.resolve(refund);
  }

  /** Test helper: moves a charge to a new status (e.g. paid in the app). */
  public setStatus(correlationID: string, status: WooviChargeStatus): void {
    const charge = this.#charges.get(correlationID);
    if (!charge) throw new Error(`unknown charge ${correlationID}`);
    this.#charges.set(correlationID, {
      ...charge,
      status,
      ...(status === 'COMPLETED' ? { paidAt: this.now().toISOString() } : {}),
    });
  }
}

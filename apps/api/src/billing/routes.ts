// Billing and profile routes (Fase 8). Same neutral route shape as
// ../routes.ts, so they run on Workers (fetch router) and Fastify alike.
import {
  ApplicationError,
  AuthenticationError,
  type AuthPort,
} from '@footebas/application';
import type { ApiReply, ApiRequest, ApiRoute } from '../routes.js';
import type { BillingService } from './service.js';

export interface BillingRouteDependencies {
  readonly service: BillingService;
  readonly auth: AuthPort;
}

const security = { security: [{ bearerAuth: [] }] };
const json = (body: unknown, status = 200): ApiReply => ({ status, body });

async function identity(auth: AuthPort, request: ApiRequest) {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ') || value.length === 7)
    throw new AuthenticationError('bearer token required');
  return auth.authenticate(value);
}

export function billingRoutes(deps: BillingRouteDependencies): ApiRoute[] {
  const { service, auth } = deps;
  return [
    {
      method: 'GET',
      path: '/v1/me',
      schema: { ...security, summary: 'Profile, plan and license' },
      async handler(request) {
        return json(await service.me(await identity(auth, request)));
      },
    },
    {
      method: 'POST',
      path: '/v1/billing/checkout',
      schema: {
        ...security,
        summary: 'Open (or reuse) the PIX charge for the full license',
      },
      async handler(request) {
        const { userId } = await identity(auth, request);
        return json(await service.checkout(userId), 201);
      },
    },
    {
      method: 'GET',
      path: '/v1/billing/orders/:id',
      schema: {
        ...security,
        summary: 'Order status (owner only)',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1, maxLength: 80 } },
        },
      },
      async handler(request) {
        const { userId } = await identity(auth, request);
        const id = request.params.id ?? '';
        if (id === '')
          throw new ApplicationError('VALIDATION_ERROR', 'order id required');
        return json(await service.order(userId, id));
      },
    },
    {
      method: 'POST',
      path: '/v1/billing/refund',
      schema: {
        ...security,
        summary: 'Request the license refund (up to 7 days after payment)',
      },
      async handler(request) {
        const { userId } = await identity(auth, request);
        return json(await service.refund(userId), 202);
      },
    },
    {
      method: 'POST',
      path: '/v1/billing/webhook',
      schema: {
        summary: 'Woovi webhook (RSA signature in x-webhook-signature, no JWT)',
      },
      async handler(request) {
        if (request.rawBody === undefined)
          throw new ApplicationError('VALIDATION_ERROR', 'raw body required');
        const result = await service.webhook(request.rawBody, request.headers);
        return json({ ok: true, ...result });
      },
    },
  ];
}

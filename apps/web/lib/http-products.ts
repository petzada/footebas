import type { CareerApiPort } from '@/lib/career-api';
import { ApiRequestError, type HttpCareerApi } from '@/lib/http-career-api';
import {
  LicenseAlreadyActiveError,
  PaymentProviderUnavailableError,
  type AccountPort,
  type CheckoutView,
  type OrderView,
  type ProfileView,
  type RefundView,
} from '@/lib/account-product';
import type { InboxMessage, InboxPort, InboxView } from '@/lib/inbox-product';
import type {
  MyRankingEntry,
  RankingPort,
  RankingView,
} from '@/lib/ranking-product';
import type { SeasonPort, SeasonView } from '@/lib/season-product';

/** `GET /v1/careers/:id/season`. */
export function httpSeasonPort(api: HttpCareerApi): SeasonPort {
  return { load: () => api.read<SeasonView>('season') };
}

/** `GET /v1/rankings` (public) and `GET /v1/rankings/me`. */
export function httpRankingPort(api: HttpCareerApi): RankingPort {
  return {
    leaderboard(scope, period) {
      const query = new URLSearchParams({ scope });
      if (period) query.set('period', period);
      return api.call<RankingView>('GET', `/v1/rankings?${query.toString()}`);
    },
    async mine() {
      try {
        const model = await api.call<{ entries: MyRankingEntry[] }>(
          'GET',
          '/v1/rankings/me',
        );
        return model.entries;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401)
          return null;
        throw error;
      }
    },
  };
}

/**
 * Inbox from the home read model; `ResolveInboxDecision` for generated
 * messages and the existing offer commands for transfer/sponsor offers.
 */
export function httpInboxPort(
  api: HttpCareerApi,
  port: CareerApiPort = api,
): InboxPort {
  const load = async (): Promise<InboxView> => {
    const home = await api.read<{
      currentDate: string;
      inbox?: InboxMessage[];
    }>('home');
    return { currentDate: home.currentDate, messages: home.inbox ?? [] };
  };
  return {
    load,
    async resolve(messageId, optionId) {
      await api.command('ResolveInboxDecision', { messageId, optionId });
      return load();
    },
    async decideOffer(kind, offerId, decision) {
      if (kind === 'sponsor_offer')
        await port.decideSponsorship(offerId, decision);
      else await port.decideMarketOffer(offerId, decision);
      return load();
    },
  };
}

function providerAware<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 502)
      throw new PaymentProviderUnavailableError();
    throw error;
  });
}

/** `GET /v1/me` and the billing routes. */
export function httpAccountPort(api: HttpCareerApi): AccountPort {
  return {
    me: () => api.call<ProfileView>('GET', '/v1/me'),
    checkout: () =>
      providerAware(
        api.call<CheckoutView>('POST', '/v1/billing/checkout'),
      ).catch(async (error: unknown) => {
        if (!(error instanceof ApiRequestError) || error.status !== 409)
          throw error;
        // 409 is either "license already active" (the payment went through,
        // maybe in another tab) or a charge that could not be opened; the
        // profile tells them apart without parsing server messages.
        const profile = await api
          .call<ProfileView>('GET', '/v1/me')
          .catch(() => undefined);
        if (profile?.plan === 'licensed') throw new LicenseAlreadyActiveError();
        throw new Error('Não foi possível gerar o PIX agora. Tente de novo.');
      }),
    order: (orderId) =>
      providerAware(
        api.call<OrderView>(
          'GET',
          `/v1/billing/orders/${encodeURIComponent(orderId)}`,
        ),
      ),
    refund: () =>
      providerAware(api.call<RefundView>('POST', '/v1/billing/refund')),
    uploadAvatar: (file) => api.upload<{ url: string }>('/v1/me/avatar', file),
  };
}

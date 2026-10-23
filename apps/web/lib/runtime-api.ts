import { InMemoryCareerApi, type CareerApiPort } from '@/lib/career-api';
import { SupabaseAuth, type AuthPort } from '@/lib/auth';
import type { CompetitionProductPort } from '@/lib/competition-product';
import { HttpCareerApi, httpCompetitionPort } from '@/lib/http-career-api';
import {
  httpAccountPort,
  httpInboxPort,
  httpRankingPort,
  httpSeasonPort,
} from '@/lib/http-products';
import { createFakeAccountPort, type AccountPort } from '@/lib/account-product';
import { createFakeInboxPort, type InboxPort } from '@/lib/inbox-product';
import {
  cachedRankingPort,
  createFakeRankingPort,
  type RankingPort,
} from '@/lib/ranking-product';
import { createFakeSeasonPort, type SeasonPort } from '@/lib/season-product';

export interface CareerRuntime {
  readonly api: CareerApiPort;
  /** Real sign-in; `null` keeps the local e-mail flow (demo and dev mode). */
  readonly auth: AuthPort | null;
}

export type AuthMode = 'supabase' | 'dev';

export function authMode(): AuthMode {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'dev' ? 'dev' : 'supabase';
}

/**
 * Picks the authoritative HTTP adapter when NEXT_PUBLIC_API_URL is set and
 * the local in-memory port otherwise (offline demo and component tests).
 * Over HTTP the bearer comes from Supabase Auth, unless
 * NEXT_PUBLIC_AUTH_MODE=dev enables the local dev session.
 */
export function createCareerRuntime(): CareerRuntime {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!baseUrl) return { api: new InMemoryCareerApi(), auth: null };
  if (authMode() === 'dev') {
    let storage: Storage | undefined;
    try {
      storage = globalThis.localStorage;
    } catch {
      storage = undefined;
    }
    return {
      api: new HttpCareerApi({
        baseUrl,
        devSession: true,
        ...(storage ? { storage } : {}),
      }),
      auth: null,
    };
  }
  const auth = new SupabaseAuth();
  return {
    api: new HttpCareerApi({
      baseUrl,
      getAccessToken: (options) => auth.getAccessToken(options),
    }),
    auth,
  };
}

export function competitionPortFor(
  api: CareerApiPort,
): CompetitionProductPort | undefined {
  return api instanceof HttpCareerApi ? httpCompetitionPort(api) : undefined;
}

/** Season, inbox, ranking and account ports over the same runtime. */
export interface ProductPorts {
  readonly season: SeasonPort;
  readonly inbox: InboxPort;
  readonly ranking: RankingPort;
  readonly account: AccountPort;
}

const portsByApi = new WeakMap<CareerApiPort, ProductPorts>();

/**
 * Offline demo: paying the fake PIX licenses the in-memory career runtime
 * too, like the server does with the entitlements.
 */
function licensingDemo(account: AccountPort, api: CareerApiPort): AccountPort {
  if (!(api instanceof InMemoryCareerApi)) return account;
  return {
    ...account,
    async order(orderId) {
      const order = await account.order(orderId);
      if (order.status === 'paid') api.grantLicense();
      return order;
    },
  };
}

/**
 * Offline demo: the inbox fake keeps its own messages, but the badge and the
 * Notícias come from `career.world.news`; reading or deleting through the
 * inbox port must reach the in-memory career too, like the server does.
 */
function inboxDemo(inbox: InboxPort, api: CareerApiPort): InboxPort {
  if (!(api instanceof InMemoryCareerApi)) return inbox;
  return {
    ...inbox,
    async markRead(messageIds) {
      api.markNewsRead(messageIds);
      return inbox.markRead(messageIds);
    },
    async remove(messageId) {
      api.removeNews(messageId);
      return inbox.remove(messageId);
    },
  };
}

/**
 * Over HTTP every port talks to the authoritative server; the in-memory
 * runtime (offline demo, tests) gets deterministic fakes. One set per
 * runtime: the Central and the Caixa de entrada/Histórico/Ranking screens
 * read the same inbox, season and ranking (and share the ranking cache).
 */
export function productPortsFor(api: CareerApiPort): ProductPorts {
  const known = portsByApi.get(api);
  if (known) return known;
  const ports: ProductPorts =
    api instanceof HttpCareerApi
      ? {
          season: httpSeasonPort(api),
          inbox: httpInboxPort(api),
          ranking: cachedRankingPort(httpRankingPort(api)),
          account: httpAccountPort(api),
        }
      : {
          season: createFakeSeasonPort(),
          inbox: inboxDemo(createFakeInboxPort(), api),
          ranking: createFakeRankingPort(),
          account: licensingDemo(createFakeAccountPort(), api),
        };
  portsByApi.set(api, ports);
  return ports;
}

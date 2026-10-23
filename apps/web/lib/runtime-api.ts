import { InMemoryCareerApi, type CareerApiPort } from '@/lib/career-api';
import { SupabaseAuth, type AuthPort } from '@/lib/auth';
import type { CompetitionProductPort } from '@/lib/competition-product';
import { HttpCareerApi, httpCompetitionPort } from '@/lib/http-career-api';

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

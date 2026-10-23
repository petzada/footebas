import { InMemoryCareerApi, type CareerApiPort } from '@/lib/career-api';
import type { CompetitionProductPort } from '@/lib/competition-product';
import { HttpCareerApi, httpCompetitionPort } from '@/lib/http-career-api';

/**
 * Picks the authoritative HTTP adapter when NEXT_PUBLIC_API_URL is set and
 * the local in-memory port otherwise (offline demo and component tests).
 */
export function createCareerApi(): CareerApiPort {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return new InMemoryCareerApi();
  let storage: Storage | undefined;
  try {
    storage = globalThis.localStorage;
  } catch {
    storage = undefined;
  }
  return new HttpCareerApi({
    baseUrl: baseUrl.replace(/\/$/, ''),
    ...(storage ? { storage } : {}),
  });
}

export function competitionPortFor(
  api: CareerApiPort,
): CompetitionProductPort | undefined {
  return api instanceof HttpCareerApi ? httpCompetitionPort(api) : undefined;
}

// Real-user metrics from the web (wave 0 of docs/10-latencia-e-escala.md):
// Core Web Vitals plus the game's own screen timings, sent with
// `navigator.sendBeacon` and written to the logs. No user identity, no URLs
// beyond the page kind, no free text but a short element selector.
import { z } from 'zod';
import type { ApiRoute } from './routes.js';

export const RUM_PATH = '/v1/telemetry/vitals';

export const rumReportSchema = z.object({
  page: z.enum(['game', 'landing']),
  /** `navigator.connection.effectiveType` (`4g`, `3g`…), when exposed. */
  connection: z.string().max(12).optional(),
  metrics: z
    .array(
      z.object({
        name: z.enum([
          'LCP',
          'INP',
          'CLS',
          'FCP',
          'TTFB',
          'screen-switch',
          'central-visible',
        ]),
        value: z.number().nonnegative().max(600_000),
        rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
        /** Screen id, or the selector behind LCP/INP/CLS. */
        label: z.string().max(80).optional(),
        navigationType: z.string().max(24).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export type RumReport = z.infer<typeof rumReportSchema>;

/**
 * `POST /v1/telemetry/vitals`: anonymous, answered 204 and never read back.
 * Beacons go out as `text/plain` (no CORS preflight), so the body may arrive
 * as a string.
 */
export function rumRoute(record: (report: RumReport) => void): ApiRoute {
  return {
    method: 'POST',
    path: RUM_PATH,
    schema: {
      summary: 'Real-user web metrics (Core Web Vitals, screen timings)',
    },
    handler(request) {
      const body: unknown =
        typeof request.body === 'string'
          ? (JSON.parse(request.body) as unknown)
          : request.body;
      record(rumReportSchema.parse(body));
      return Promise.resolve({ status: 204, body: undefined });
    },
  };
}

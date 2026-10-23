// Measurement helpers for Server-Timing and the request logs (wave 0 of
// docs/10-latencia-e-escala.md): how many Postgres queries a request sent and
// which Cloudflare location ran the code.
import { consoleLogSink, errorFields } from './observability.js';

/**
 * Counts the queries a postgres.js client sends: pass `hook` as its `debug`
 * option. The hook only counts; it never sees parameters or logs anything.
 */
export class QueryCounter {
  public count = 0;
  public readonly hook = (): void => {
    this.count++;
  };
}

/** Colo code in a `/cdn-cgi/trace` body (`colo=GRU`), if present. */
export function coloOfTrace(trace: string): string | undefined {
  return /^colo=([A-Z0-9]+)$/m.exec(trace)?.[1];
}

/** Colo code that served a Worker request (`request.cf.colo`). */
export function coloOfRequest(request: Request): string | undefined {
  const cf = (request as Request & { cf?: { colo?: unknown } }).cf;
  return typeof cf?.colo === 'string' ? cf.colo : undefined;
}

let isolateColo: string | undefined;
let probing: Promise<void> | undefined;

/**
 * Location of the isolate running this code (a Durable Object has no
 * `request.cf` of its own): probed once per isolate in the background and
 * logged, `undefined` until the probe answers.
 */
export function isolateLocation(
  probe: () => Promise<string> = async () =>
    (await fetch('https://www.cloudflare.com/cdn-cgi/trace')).text(),
): string | undefined {
  probing ??= probe()
    .then((trace) => {
      isolateColo = coloOfTrace(trace) ?? 'unknown';
      consoleLogSink({
        type: 'career_object',
        level: 'info',
        route: 'location',
        colo: isolateColo,
      });
    })
    .catch((error: unknown) => {
      probing = undefined;
      consoleLogSink({
        type: 'career_object',
        level: 'warn',
        route: 'location',
        ...errorFields(error),
      });
    });
  return isolateColo;
}

// Workers adapter: the same route table behind a plain fetch handler.
import { ApplicationError } from '@footebas/application';
import {
  apiRoutes,
  errorBody,
  mapError,
  type ApiDependencies,
} from './routes.js';
import type { RequestCompletion } from './observability.js';
import type { RateLimitDecision } from './rate-limit.js';

export interface FetchHandlerOptions {
  /** Runs after route matching, before the body is read; denied → 429. */
  readonly rateLimit?: (
    request: Request,
    route: string | undefined,
  ) => Promise<RateLimitDecision>;
  /** Called once per request with the outcome (structured logging). */
  readonly onComplete?: (completion: RequestCompletion) => void;
  /** Monotonic-ish clock in milliseconds (default `Date.now`). */
  readonly now?: () => number;
  /**
   * Runs after rate limiting and body parsing, before the route handler. A
   * returned response (e.g. from the career Durable Object) is sent as is,
   * with this router's CORS and request id headers.
   */
  readonly forward?: (input: ForwardInput) => Promise<Response | undefined>;
}

export interface ForwardInput {
  readonly request: Request;
  /** Matched route pattern, e.g. `/v1/careers/:id/home`. */
  readonly route: string;
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly rawBody: string;
  readonly requestId: string;
}

interface CompiledRoute {
  readonly method: string;
  readonly pattern: RegExp;
  readonly names: readonly string[];
  readonly route: ReturnType<typeof apiRoutes>[number];
}

// Handlers close over per-request dependencies, but a path always compiles to
// the same pattern: keep those for the isolate's lifetime.
const patterns = new Map<
  string,
  { readonly pattern: RegExp; readonly names: readonly string[] }
>();

function patternOf(path: string) {
  let compiled = patterns.get(path);
  if (compiled === undefined) {
    const names: string[] = [];
    const source = path
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':'))
          return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        names.push(segment.slice(1));
        return '([^/]+)';
      })
      .join('/');
    compiled = { pattern: new RegExp(`^${source}/?$`), names };
    patterns.set(path, compiled);
  }
  return compiled;
}

function compile(routes: ReturnType<typeof apiRoutes>): CompiledRoute[] {
  return routes.map((route) => ({
    method: route.method,
    ...patternOf(route.path),
    route,
  }));
}

/**
 * How long browsers may reuse a preflight (Chromium caps it at 7200 s);
 * without it every cross-origin call from the game pays an extra OPTIONS.
 */
const PREFLIGHT_MAX_AGE_SECONDS = 7200;

export function createFetchHandler(
  deps: ApiDependencies,
  options: FetchHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const routes = compile(apiRoutes(deps));
  const origins = new Set(deps.corsOrigins ?? []);
  const limit = deps.bodyLimit ?? 64 * 1024;
  // Image uploads (avatars) only; JSON routes keep the small limit above.
  const binaryLimit = 2 * 1024 * 1024 + 1024;
  const now = options.now ?? Date.now;
  const dispatch = async (
    request: Request,
    requestId: string,
    state: { route: string; error?: unknown },
  ): Promise<Response> => {
    const headers = new Headers({
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
      'x-request-id': requestId,
    });
    const origin = request.headers.get('origin');
    if (origin !== null && origins.has(origin)) {
      headers.set('access-control-allow-origin', origin);
      headers.set('vary', 'origin');
      headers.set(
        'access-control-allow-headers',
        'authorization, content-type, idempotency-key, if-none-match',
      );
      headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
      headers.set(
        'access-control-expose-headers',
        'etag, idempotency-key, retry-after, x-request-id',
      );
      if (request.method === 'OPTIONS') {
        state.route = 'preflight';
        headers.set(
          'access-control-max-age',
          String(PREFLIGHT_MAX_AGE_SECONDS),
        );
        return new Response(null, { status: 204, headers });
      }
    }
    const respond = (
      status: number,
      body: unknown,
      type = 'application/json',
    ) => {
      headers.set('content-type', type);
      return new Response(
        typeof body === 'string' && type !== 'application/json'
          ? body
          : JSON.stringify(body),
        { status, headers },
      );
    };
    try {
      const url = new URL(request.url);
      let found:
        { compiled: CompiledRoute; match: RegExpExecArray } | undefined;
      for (const compiled of routes) {
        if (compiled.method !== request.method) continue;
        const match = compiled.pattern.exec(url.pathname);
        if (match) {
          found = { compiled, match };
          break;
        }
      }
      if (found) state.route = found.compiled.route.path;
      const decision = await options.rateLimit?.(
        request,
        found?.compiled.route.path,
      );
      if (decision && !decision.allowed) {
        headers.set('retry-after', String(decision.retryAfterSeconds));
        return respond(429, {
          ...errorBody(
            requestId,
            'RATE_LIMITED',
            'rate limit exceeded; retry later',
          ),
          retryAfterSeconds: decision.retryAfterSeconds,
        });
      }
      if (found?.compiled.route.binary) {
        const { compiled, match } = found;
        const declared = Number(request.headers.get('content-length') ?? 0);
        if (declared > binaryLimit)
          return respond(
            413,
            errorBody(requestId, 'VALIDATION_ERROR', 'request body too large'),
          );
        const result = await compiled.route.handler({
          params: Object.fromEntries(
            compiled.names.map((name, index) => [
              name,
              decodeURIComponent(match[index + 1] ?? ''),
            ]),
          ),
          query: Object.fromEntries(url.searchParams),
          headers: Object.fromEntries(request.headers),
          body: undefined,
          bytes: async () => {
            const bytes = await request.arrayBuffer();
            if (bytes.byteLength > binaryLimit)
              throw new ApplicationError(
                'VALIDATION_ERROR',
                'request body too large',
              );
            return bytes;
          },
        });
        for (const [name, value] of Object.entries(result.headers ?? {}))
          headers.set(name, value);
        return respond(result.status ?? 200, result.body);
      }
      if (found) {
        const { compiled, match } = found;
        const text = request.method === 'GET' ? '' : await request.text();
        if (text.length > limit)
          return respond(
            413,
            errorBody(requestId, 'VALIDATION_ERROR', 'request body too large'),
          );
        let body: unknown;
        try {
          body = text === '' ? undefined : (JSON.parse(text) as unknown);
        } catch {
          return respond(
            400,
            errorBody(
              requestId,
              'VALIDATION_ERROR',
              'request validation failed',
            ),
          );
        }
        const params = Object.fromEntries(
          compiled.names.map((name, index) => [
            name,
            decodeURIComponent(match[index + 1] ?? ''),
          ]),
        );
        const forwarded = await options.forward?.({
          request,
          route: compiled.route.path,
          params,
          body,
          rawBody: text,
          requestId,
        });
        if (forwarded !== undefined) {
          for (const [name, value] of forwarded.headers)
            if (!name.startsWith('access-control-') && name !== 'vary')
              headers.set(name, value);
          headers.set('x-request-id', requestId);
          return new Response(forwarded.body, {
            status: forwarded.status,
            headers,
          });
        }
        const result = await compiled.route.handler({
          params,
          query: Object.fromEntries(url.searchParams),
          headers: Object.fromEntries(request.headers),
          body,
          rawBody: text,
        });
        for (const [name, value] of Object.entries(result.headers ?? {}))
          headers.set(name, value);
        return respond(
          result.status ?? 200,
          result.body,
          result.contentType ?? 'application/json',
        );
      }
      return respond(404, errorBody(requestId, 'NOT_FOUND', 'route not found'));
    } catch (error) {
      const mapped = mapError(error, requestId);
      if (mapped.status >= 500) state.error = error;
      return respond(mapped.status, mapped.body);
    }
  };
  return async (request) => {
    const started = now();
    const requestId =
      deps.nextRequestId?.() ??
      `request_${crypto.randomUUID().replaceAll('-', '')}`;
    const state: { route: string; error?: unknown } = { route: 'unmatched' };
    const response = await dispatch(request, requestId, state);
    options.onComplete?.({
      requestId,
      method: request.method,
      route: state.route,
      status: response.status,
      durationMs: Math.max(0, now() - started),
      ...(state.error === undefined ? {} : { error: state.error }),
    });
    return response;
  };
}

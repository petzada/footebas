// Workers adapter: the same route table behind a plain fetch handler.
import {
  apiRoutes,
  errorBody,
  mapError,
  type ApiDependencies,
} from './routes.js';

interface CompiledRoute {
  readonly method: string;
  readonly pattern: RegExp;
  readonly names: readonly string[];
  readonly route: ReturnType<typeof apiRoutes>[number];
}

function compile(routes: ReturnType<typeof apiRoutes>): CompiledRoute[] {
  return routes.map((route) => {
    const names: string[] = [];
    const source = route.path
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':'))
          return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        names.push(segment.slice(1));
        return '([^/]+)';
      })
      .join('/');
    return {
      method: route.method,
      pattern: new RegExp(`^${source}/?$`),
      names,
      route,
    };
  });
}

export function createFetchHandler(
  deps: ApiDependencies,
): (request: Request) => Promise<Response> {
  const routes = compile(apiRoutes(deps));
  const origins = new Set(deps.corsOrigins ?? []);
  const limit = deps.bodyLimit ?? 64 * 1024;
  return async (request) => {
    const requestId =
      deps.nextRequestId?.() ??
      `request_${crypto.randomUUID().replaceAll('-', '')}`;
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
        'authorization, content-type, idempotency-key',
      );
      headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
      headers.set('access-control-expose-headers', 'idempotency-key');
      if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers });
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
      for (const compiled of routes) {
        if (compiled.method !== request.method) continue;
        const match = compiled.pattern.exec(url.pathname);
        if (!match) continue;
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
        const result = await compiled.route.handler({
          params,
          query: Object.fromEntries(url.searchParams),
          headers: Object.fromEntries(request.headers),
          body,
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
      return respond(mapped.status, mapped.body);
    }
  };
}

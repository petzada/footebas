import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  apiRoutes,
  errorBody,
  mapError,
  type ApiDependencies,
  type ApiRequest,
} from './routes.js';

export type { ApiDependencies } from './routes.js';
export { createFetchHandler } from './fetch-router.js';

function flatten(
  value: Readonly<Record<string, unknown>>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      Array.isArray(item)
        ? item.join(',')
        : typeof item === 'string'
          ? item
          : item === undefined
            ? undefined
            : JSON.stringify(item),
    ]),
  );
}

/** Node adapter (local server, tests, OpenAPI) over the neutral route table. */
export async function buildApi(
  deps: ApiDependencies,
): Promise<FastifyInstance> {
  let requestSequence = 0;
  const app = Fastify({
    bodyLimit: deps.bodyLimit ?? 64 * 1024,
    genReqId: () =>
      deps.nextRequestId?.() ?? `request_${String(++requestSequence)}`,
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Footebas API', version: '1.0.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      },
    },
  });
  if (deps.documentation ?? true)
    await app.register(swaggerUi, { routePrefix: '/documentation' });

  // Keep the raw JSON text next to the parsed body: webhook signatures
  // (Woovi) are verified over the exact bytes received.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      const text = typeof body === 'string' ? body : body.toString('utf8');
      (request as { rawBody?: string }).rawBody = text;
      const invalid = () =>
        Object.assign(new Error('invalid JSON body'), {
          statusCode: 400,
          validation: [],
        });
      if (text === '') {
        done(null, undefined);
        return;
      }
      if (/"__proto__"\s*:/.test(text)) {
        done(invalid(), undefined);
        return;
      }
      try {
        done(null, JSON.parse(text) as unknown);
      } catch {
        done(invalid(), undefined);
      }
    },
  );

  const origins = new Set(deps.corsOrigins ?? []);
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin === undefined || !origins.has(origin)) return;
    reply.header('access-control-allow-origin', origin);
    reply.header('vary', 'origin');
    reply.header(
      'access-control-allow-headers',
      'authorization, content-type, idempotency-key',
    );
    reply.header('access-control-allow-methods', 'GET, POST, OPTIONS');
    reply.header('access-control-expose-headers', 'idempotency-key');
    if (request.method === 'OPTIONS') await reply.code(204).send();
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('cache-control', 'no-store');
    return payload;
  });

  for (const route of apiRoutes(deps))
    app.route({
      method: route.method,
      url: route.path,
      ...(route.schema ? { schema: route.schema } : {}),
      async handler(request, reply) {
        const rawBody = (request as { rawBody?: unknown }).rawBody;
        const input: ApiRequest = {
          params: flatten(request.params as Record<string, unknown>) as Record<
            string,
            string
          >,
          query: flatten((request.query ?? {}) as Record<string, unknown>),
          headers: flatten(request.headers),
          body: request.body,
          ...(typeof rawBody === 'string' ? { rawBody } : {}),
        };
        const result = await route.handler(input);
        for (const [name, value] of Object.entries(result.headers ?? {}))
          reply.header(name, value);
        if (result.contentType) reply.type(result.contentType);
        return reply.code(result.status ?? 200).send(result.body);
      },
    });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody(request.id, 'NOT_FOUND', 'route not found')),
  );
  app.setErrorHandler((error, request, reply) => {
    const mapped = mapError(error, request.id);
    reply.code(mapped.status).send(mapped.body);
  });
  await app.ready();
  return app;
}

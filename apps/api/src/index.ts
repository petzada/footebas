import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  ApplicationError,
  AuthenticationError,
  type FootebasApplication,
  type JobQueuePort,
} from '@footebas/application';
import {
  apiErrorSchema,
  commandAcceptedSchema,
  commandSchema,
  jobSseEventSchema,
  jobStatusSchema,
  type ApiError,
  type JobSseEvent,
  type JobStatus,
} from '@footebas/contracts';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface ApiDependencies {
  readonly application: FootebasApplication;
  readonly jobs: JobQueuePort;
  readonly nextRequestId?: () => string;
  readonly now?: () => Date;
  readonly bodyLimit?: number;
}

const bearer = (request: FastifyRequest): string => {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ') || value.length === 7)
    throw new AuthenticationError('bearer token required');
  return value;
};
const commonSchema = {
  security: [{ bearerAuth: [] }],
  response: { 400: {}, 401: {}, 403: {}, 404: {}, 409: {}, 500: {} },
};
const paramsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
} as const;

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
  await app.register(swaggerUi, { routePrefix: '/documentation' });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('cache-control', 'no-store');
    return payload;
  });

  app.post(
    '/v1/commands',
    {
      schema: {
        ...commonSchema,
        summary: 'Execute an authoritative game command',
        body: {
          oneOf: [
            'CreateCareer',
            'SelectClub',
            'SetLineup',
            'SetTactics',
            'AdvanceDate',
            'SimulateMatch',
          ].map((type) => ({
            type: 'object',
            required: [
              'version',
              'commandId',
              'idempotencyKey',
              'expectedVersion',
              'type',
              'payload',
            ],
            properties: {
              version: { const: 1 },
              commandId: { type: 'string' },
              idempotencyKey: { type: 'string' },
              expectedVersion: { type: 'integer' },
              type: { const: type },
              payload: { type: 'object' },
            },
          })),
        },
        response: {
          ...commonSchema.response,
          202: {
            type: 'object',
            required: ['version', 'commandId', 'careerId', 'aggregateVersion'],
            properties: {
              version: { const: 1 },
              commandId: { type: 'string' },
              careerId: { type: 'string' },
              aggregateVersion: { type: 'integer' },
              jobId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const command = commandSchema.parse(request.body);
      const result = commandAcceptedSchema.parse(
        await deps.application.execute(bearer(request), command),
      );
      return reply.code(202).send(result);
    },
  );

  const reads = {
    home: deps.application.home.bind(deps.application),
    squad: deps.application.squad.bind(deps.application),
    'next-match': deps.application.nextMatch.bind(deps.application),
    standings: deps.application.standings.bind(deps.application),
    'post-match': deps.application.postMatch.bind(deps.application),
  } as const;
  for (const [name, query] of Object.entries(reads)) {
    app.get(
      `/v1/careers/:id/${name}`,
      { schema: { ...commonSchema, params: paramsSchema } },
      async (request) => {
        const { id } = paramsSchemaParse(request.params);
        return query(bearer(request), id);
      },
    );
  }

  app.get(
    '/v1/jobs/:id',
    { schema: { ...commonSchema, params: paramsSchema } },
    async (request) => {
      const { id } = paramsSchemaParse(request.params);
      const { status } = await authorizedJob(deps, bearer(request), id);
      return jobStatusSchema.parse(status);
    },
  );

  app.get(
    '/v1/jobs/:id/events',
    { schema: { ...commonSchema, params: paramsSchema } },
    async (request, reply) => {
      const { id } = paramsSchemaParse(request.params);
      const { status, aggregateVersion } = await authorizedJob(
        deps,
        bearer(request),
        id,
      );
      const event = statusEvent(
        status,
        aggregateVersion,
        deps.now?.() ?? new Date(),
      );
      jobSseEventSchema.parse(event);
      reply.type('text/event-stream; charset=utf-8');
      reply.header('connection', 'keep-alive');
      return `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    },
  );

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody(request, 'NOT_FOUND', 'route not found')),
  );
  app.setErrorHandler((error, request, reply) => {
    const mapped = mapError(error, request);
    reply.code(mapped.status).send(mapped.body);
  });
  await app.ready();
  return app;
}

function paramsSchemaParse(value: unknown): { id: string } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  )
    throw new ZodError([]);
  return { id: value.id };
}
async function authorizedJob(
  deps: ApiDependencies,
  token: string,
  jobId: string,
): Promise<{ status: JobStatus; aggregateVersion: number }> {
  const status = await deps.jobs.status(jobId);
  if (!status) throw new ApplicationError('NOT_FOUND', 'job not found');
  const home = await deps.application.home(token, status.careerId);
  return { status, aggregateVersion: home.aggregateVersion };
}
function statusEvent(
  status: JobStatus,
  aggregateVersion: number,
  now: Date,
): JobSseEvent {
  const base = {
    version: 1 as const,
    eventId: `event_${status.jobId}_${status.state}`,
    jobId: status.jobId,
    occurredAt: now.toISOString(),
  };
  if (status.state === 'succeeded')
    return {
      ...base,
      type: 'job.completed',
      data: { careerId: status.careerId, aggregateVersion },
    };
  if (status.state === 'failed')
    return {
      ...base,
      type: 'job.failed',
      data: {
        code: status.errorCode ?? 'JOB_FAILED',
        message: 'simulation failed',
        retryable: status.attempt < 20,
      },
    };
  if (status.state === 'running')
    return { ...base, type: 'job.progress', data: status.progress };
  return { ...base, type: 'job.status', data: status };
}
function errorBody(
  request: FastifyRequest,
  code: ApiError['code'],
  message: string,
): ApiError {
  const base = { version: 1 as const, requestId: request.id, code, message };
  if (code === 'NOT_FOUND')
    return apiErrorSchema.parse({ ...base, resource: 'request' });
  if (code === 'VERSION_CONFLICT')
    return apiErrorSchema.parse({
      ...base,
      expectedVersion: 0,
      actualVersion: 0,
    });
  return apiErrorSchema.parse(base);
}
function mapError(
  error: unknown,
  request: FastifyRequest,
): { status: number; body: ApiError } {
  if (
    error instanceof ZodError ||
    (typeof error === 'object' && error !== null && 'validation' in error)
  )
    return {
      status: 400,
      body: errorBody(request, 'VALIDATION_ERROR', 'request validation failed'),
    };
  if (error instanceof AuthenticationError)
    return {
      status: 401,
      body: errorBody(request, 'UNAUTHORIZED', 'authentication required'),
    };
  if (error instanceof ApplicationError) {
    const statuses = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      VERSION_CONFLICT: 409,
      VALIDATION_ERROR: 400,
    } as const;
    return {
      status: statuses[error.code],
      body: errorBody(request, error.code, error.message),
    };
  }
  return {
    status: 500,
    body: errorBody(request, 'INTERNAL_ERROR', 'internal server error'),
  };
}

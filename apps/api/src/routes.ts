// Framework-neutral API: one table of routes and one error mapping, served
// by Fastify locally (with OpenAPI) and by a plain fetch router on Workers.
import {
  ApplicationError,
  AuthenticationError,
  CareerLimitReachedError,
  PhaseFourAuthorizationError,
  PhaseFourConflictError,
  PhaseFourNotFoundError,
  PhaseFiveAuthorizationError,
  PhaseFiveConflictError,
  PhaseFiveNotFoundError,
  TransferMarketError,
  type AuthPort,
  type FakeBearerAuth,
  type FootebasApplication,
  type JobQueuePort,
  type PhaseFiveCompetitionService,
  type PhaseFourApplicationService,
  type RankingService,
} from '@footebas/application';
import {
  apiErrorSchema,
  careerBundleReadModelSchema,
  careerListReadModelSchema,
  careerSeasonReadModelSchema,
  careerWorldReadModelSchema,
  commandAcceptedSchema,
  commandSchema,
  comparePlayersQuerySchema,
  competitionCalendarReadModelSchema,
  competitionPyramidReadModelSchema,
  devSessionRequestSchema,
  jobSseEventSchema,
  jobStatusSchema,
  marketSearchQuerySchema,
  myRankingReadModelSchema,
  nextSeasonTransitionReadModelSchema,
  phaseFiveCommandSchema,
  phaseFiveReceiptSchema,
  phaseFourCareerReadModelSchema,
  phaseFourCommandSchema,
  phaseFourHistoryReadModelSchema,
  phaseFourLeaderboardReadModelSchema,
  phaseFourReceiptSchema,
  postMatchReadModelSchema,
  rankingReadModelSchema,
  type ApiError,
  type JobSseEvent,
  type JobStatus,
} from '@footebas/contracts';
import { ZodError } from 'zod';
import {
  billingRoutes,
  type BillingRouteDependencies,
} from './billing/routes.js';
import { avatarRoutes, type AvatarRouteDependencies } from './avatar-routes.js';
import { WooviApiError } from './billing/woovi-client.js';
import { rumRoute, type RumReport } from './rum-route.js';

export interface ApiDependencies {
  readonly application: FootebasApplication;
  readonly jobs: JobQueuePort;
  readonly nextRequestId?: () => string;
  readonly now?: () => Date;
  readonly bodyLimit?: number;
  readonly phaseFour?: Readonly<{
    application: PhaseFourApplicationService;
    auth: AuthPort;
  }>;
  readonly phaseFive?: Readonly<{
    application: PhaseFiveCompetitionService;
    auth: AuthPort;
  }>;
  /** Global ranking snapshots (`GET /v1/rankings`, ADR 0013). */
  readonly rankings?: RankingService;
  /** Licença única via Woovi/PIX and `GET /v1/me` (Fase 8). */
  readonly billing?: BillingRouteDependencies;
  readonly avatars?: AvatarRouteDependencies;
  /** Development-only sign-in that issues fake bearer tokens. Never in production. */
  readonly devAuth?: FakeBearerAuth;
  /**
   * Called after an accepted CreateCareer (also an idempotent replay); must
   * not throw or block (the Worker warms the career's Durable Object).
   */
  readonly onCareerCreated?: (careerId: string) => void;
  /** Records real-user web metrics (`POST /v1/telemetry/vitals`). */
  readonly rum?: (report: RumReport) => void;
  /** Browser origins allowed to call the API (CORS). */
  readonly corsOrigins?: readonly string[];
  /** Serves /documentation (Swagger UI, Node only). */
  readonly documentation?: boolean;
  /** Probe behind `GET /health` (no auth). */
  readonly health?: Readonly<{
    /** Deployed build identifier (e.g. Workers version id). */
    version: string;
    /** Lightweight database round trip such as `select 1`; absent in memory. */
    database?: () => Promise<void>;
    /** Upper bound for the database probe (default 2000 ms). */
    timeoutMs?: number;
  }>;
}

export type HealthDatabaseState =
  'ok' | 'error' | 'timeout' | 'skipped' | 'in_memory';

export interface HealthReport {
  readonly ok: boolean;
  readonly version: string;
  readonly time: string;
  readonly database: HealthDatabaseState;
  readonly databaseMs?: number;
}

async function probeDatabase(
  check: () => Promise<void>,
  timeoutMs: number,
): Promise<'ok' | 'error' | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => {
      resolve('timeout');
    }, timeoutMs);
  });
  try {
    return await Promise.race([check().then(() => 'ok' as const), timeout]);
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

function healthRoute(deps: ApiDependencies): ApiRoute {
  return {
    method: 'GET',
    path: '/health',
    schema: {
      summary: 'Liveness probe; `deep=0` skips the database round trip',
      querystring: {
        type: 'object',
        properties: { deep: { type: 'string' } },
      },
    },
    async handler(request) {
      const health = deps.health;
      const time = (deps.now?.() ?? new Date()).toISOString();
      const version = health?.version ?? 'unknown';
      if (request.query.deep === '0')
        return json({ ok: true, version, time, database: 'skipped' });
      if (health?.database === undefined)
        return json({ ok: true, version, time, database: 'in_memory' });
      const started = Date.now();
      const database = await probeDatabase(
        health.database,
        health.timeoutMs ?? 2000,
      );
      const report: HealthReport = {
        ok: database === 'ok',
        version,
        time,
        database,
        databaseMs: Date.now() - started,
      };
      return json(report, report.ok ? 200 : 503);
    },
  };
}

export interface ApiRequest {
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string | undefined>>;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: unknown;
  /** Body exactly as received (webhook signatures are computed over it). */
  readonly rawBody?: string;
  /** Binary routes only: the raw request bytes (image uploads). */
  readonly bytes?: () => Promise<ArrayBuffer>;
}

export interface ApiReply {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly contentType?: string;
  readonly body: unknown;
}

export interface ApiRoute {
  readonly method: 'GET' | 'POST';
  /** Fastify-style path, `:name` for parameters. */
  readonly path: string;
  /** OpenAPI/JSON schema used by the Fastify adapter. */
  readonly schema?: Readonly<Record<string, unknown>>;
  /** Body is binary (not JSON): handlers read it through `bytes()`. */
  readonly binary?: boolean;
  handler(request: ApiRequest): Promise<ApiReply>;
}

export const commonSchema = {
  security: [{ bearerAuth: [] }],
  response: { 400: {}, 401: {}, 403: {}, 404: {}, 409: {}, 500: {} },
};
const paramsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
} as const;
const withId = { ...commonSchema, params: paramsSchema };

const json = (body: unknown, status = 200): ApiReply => ({ status, body });

function bearer(request: ApiRequest): string {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ') || value.length === 7)
    throw new AuthenticationError('bearer token required');
  return value;
}

function idOf(request: ApiRequest): string {
  const id = request.params.id;
  if (id === undefined || id.length === 0) throw new ZodError([]);
  return id;
}

export function apiRoutes(deps: ApiDependencies): readonly ApiRoute[] {
  const app = deps.application;
  const routes: ApiRoute[] = [
    healthRoute(deps),
    {
      method: 'GET',
      path: '/v1/public/stats',
      schema: {
        summary: 'Coaches, clubs and athletes counters for the home screen',
      },
      async handler() {
        // docs/09 decision 9: counters come from the database, cached ~5 min.
        return {
          status: 200,
          headers: {
            'cache-control': 'public, max-age=300, s-maxage=300',
          },
          body: await app.publicStats(),
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/commands',
      schema: {
        ...commonSchema,
        summary: 'Execute an authoritative game command',
        body: {
          oneOf: [
            'CreateCareer',
            'DeleteCareer',
            'SelectClub',
            'SetLineup',
            'AutoPickLineup',
            'SetTactics',
            'AdvanceDate',
            'SimulateMatch',
            'DecideSponsorshipOffer',
            'CounterSponsorshipOffer',
            'ConfigureFanMembership',
            'ResolveInboxDecision',
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
      async handler(request) {
        const command = commandSchema.parse(request.body);
        const header = request.headers['idempotency-key'];
        if (header !== undefined && header !== command.idempotencyKey)
          throw new ApplicationError(
            'VALIDATION_ERROR',
            'idempotency-key header must match the versioned command body',
          );
        const result = commandAcceptedSchema.parse(
          await app.execute(bearer(request), command),
        );
        if (command.type === 'CreateCareer')
          deps.onCareerCreated?.(result.careerId);
        return {
          status: 202,
          headers: { 'idempotency-key': command.idempotencyKey },
          body: result,
        };
      },
    },
    {
      method: 'GET',
      path: '/v1/careers',
      schema: commonSchema,
      async handler(request) {
        return json(
          careerListReadModelSchema.parse(await app.careers(bearer(request))),
        );
      },
    },
  ];

  const reads: Readonly<
    Record<string, (token: string, id: string) => Promise<unknown>>
  > = {
    home: (token, id) => app.home(token, id),
    squad: (token, id) => app.squad(token, id),
    office: (token, id) => app.careerOffice(token, id),
    'next-match': (token, id) => app.nextMatch(token, id),
    standings: (token, id) => app.standings(token, id),
    tables: (token, id) => app.tables(token, id),
    'post-match': (token, id) => app.postMatch(token, id),
    world: async (token, id) =>
      careerWorldReadModelSchema.parse(await app.careerWorld(token, id)),
    competitions: async (token, id) =>
      competitionPyramidReadModelSchema.parse(
        await app.competitions(token, id),
      ),
    calendar: async (token, id) =>
      competitionCalendarReadModelSchema.parse(await app.calendar(token, id)),
    'next-season': async (token, id) =>
      nextSeasonTransitionReadModelSchema.parse(
        await app.seasonTransition(token, id),
      ),
    season: async (token, id) =>
      careerSeasonReadModelSchema.parse(await app.careerSeason(token, id)),
  };
  for (const [name, query] of Object.entries(reads))
    routes.push({
      method: 'GET',
      path: `/v1/careers/:id/${name}`,
      schema: withId,
      async handler(request) {
        return json(await query(bearer(request), idOf(request)));
      },
    });

  routes.push({
    method: 'GET',
    path: '/v1/careers/:id/bundle',
    schema: {
      ...withId,
      summary:
        'Central in one read: home, squad summary, next match, table and inbox (ETag by aggregate version)',
    },
    async handler(request) {
      const { aggregateVersion, bundle } = await app.careerBundle(
        bearer(request),
        idOf(request),
        bundleVersionOf(request.headers['if-none-match']),
      );
      const headers = {
        etag: bundleEtag(aggregateVersion),
        // Cacheable by the browser, revalidated with If-None-Match each time.
        'cache-control': 'private, no-cache',
      };
      return bundle === undefined
        ? { status: 304, headers, body: undefined }
        : {
            status: 200,
            headers,
            body: careerBundleReadModelSchema.parse(bundle),
          };
    },
  });

  routes.push({
    method: 'GET',
    path: '/v1/careers/:id/market',
    schema: {
      ...withId,
      summary:
        'Market screen: cash, transfer window, listings, offers, loans and search',
    },
    async handler(request) {
      const raw = request.query;
      const numeric = (value?: string) =>
        value === undefined || value === '' ? undefined : Number(value);
      const flag = (value?: string) =>
        value === undefined ? undefined : value === 'true';
      const query = Object.fromEntries(
        Object.entries({
          text: raw.text === '' ? undefined : raw.text,
          position: raw.position,
          minStrength: numeric(raw.minStrength),
          maxAge: numeric(raw.maxAge),
          maxValue: numeric(raw.maxValue),
          freeAgentsOnly: flag(raw.freeAgentsOnly),
          origin: raw.origin,
          includeOwnSquad: flag(raw.includeOwnSquad),
          limit: numeric(raw.limit),
        }).filter(([, value]) => value !== undefined),
      );
      return json(
        await app.careerMarket(bearer(request), idOf(request), query),
      );
    },
  });

  routes.push({
    method: 'POST',
    path: '/v1/careers/:id/match-preview',
    schema: {
      ...withId,
      summary:
        'Simulate the next managed match with tentative instructions without committing',
      body: {
        type: 'object',
        additionalProperties: false,
        properties: { instructions: { type: 'array', maxItems: 12 } },
      },
    },
    async handler(request) {
      const body = request.body as { instructions?: unknown } | undefined;
      return json(
        postMatchReadModelSchema.parse(
          await app.previewMatch(
            bearer(request),
            idOf(request),
            body?.instructions ?? [],
          ),
        ),
      );
    },
  });

  if (deps.devAuth !== undefined) {
    const devAuth = deps.devAuth;
    routes.push({
      method: 'POST',
      path: '/v1/dev/session',
      handler(request) {
        const { email, displayName } = devSessionRequestSchema.parse(
          request.body,
        );
        const userId = `user_${email
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')}`;
        return Promise.resolve(
          json({
            bearer: devAuth.issue({
              userId,
              email,
              displayName: displayName ?? email.split('@')[0] ?? email,
            }),
            userId,
          }),
        );
      },
    });
  }

  if (deps.phaseFour !== undefined) {
    const phaseFour = deps.phaseFour;
    const application = deps.application;
    // Owner of an unlocked career: careers locked after a refund cannot be
    // read or receive commands here either (only deleted).
    const authenticated = async (request: ApiRequest) =>
      (await phaseFour.auth.authenticate(bearer(request))).userId;
    const user = async (request: ApiRequest) => {
      const userId = await authenticated(request);
      await application.assertCareerUnlocked(userId, idOf(request));
      return userId;
    };
    routes.push(
      {
        method: 'POST',
        path: '/v1/phase-four/commands',
        schema: { ...commonSchema, body: { type: 'object' } },
        async handler(request) {
          const userId = await authenticated(request);
          const command = phaseFourCommandSchema.parse(request.body);
          await application.assertCareerUnlocked(userId, command.careerId);
          return json(
            phaseFourReceiptSchema.parse(
              await phaseFour.application.execute(userId, command),
            ),
          );
        },
      },
      {
        method: 'GET',
        path: '/v1/phase-four/careers/:id/overview',
        schema: withId,
        async handler(request) {
          return json(
            phaseFourCareerReadModelSchema.parse(
              await phaseFour.application.readModel(
                await user(request),
                idOf(request),
              ),
            ),
          );
        },
      },
      {
        method: 'GET',
        path: '/v1/phase-four/careers/:id/market',
        schema: withId,
        async handler(request) {
          const raw = request.query;
          const numeric = (value?: string) =>
            value === undefined || value === '' ? undefined : Number(value);
          const query = marketSearchQuerySchema.parse(
            Object.fromEntries(
              Object.entries({
                text: raw.text === '' ? undefined : raw.text,
                position: raw.position,
                minStrength: numeric(raw.minStrength),
                maxAge: numeric(raw.maxAge),
                maxValue: numeric(raw.maxValue),
                freeAgentsOnly:
                  raw.freeAgentsOnly === undefined
                    ? undefined
                    : raw.freeAgentsOnly === 'true',
              }).filter(([, value]) => value !== undefined),
            ),
          );
          return json(
            await phaseFour.application.market(
              await user(request),
              idOf(request),
              query,
            ),
          );
        },
      },
      {
        method: 'GET',
        path: '/v1/phase-four/careers/:id/scout/:playerId',
        schema: commonSchema,
        async handler(request) {
          return json(
            await phaseFour.application.scout(
              await user(request),
              idOf(request),
              request.params.playerId ?? '',
            ),
          );
        },
      },
      {
        method: 'GET',
        path: '/v1/phase-four/careers/:id/compare',
        schema: withId,
        async handler(request) {
          const id = idOf(request);
          const query = comparePlayersQuerySchema.parse({
            careerId: id,
            playerIds: (request.query.playerIds ?? '')
              .split(',')
              .filter((value) => value.length > 0),
          });
          return json(
            await phaseFour.application.compare(
              await user(request),
              id,
              query.playerIds,
            ),
          );
        },
      },
      {
        method: 'GET',
        path: '/v1/phase-four/careers/:id/history',
        schema: withId,
        async handler(request) {
          return json(
            phaseFourHistoryReadModelSchema.parse(
              await phaseFour.application.history(
                await user(request),
                idOf(request),
              ),
            ),
          );
        },
      },
      {
        method: 'GET',
        path: '/v1/phase-four/careers/:id/leaderboard',
        schema: withId,
        async handler(request) {
          const month = request.query.month;
          if (month === undefined)
            throw new PhaseFourConflictError('leaderboard month is required');
          return json(
            phaseFourLeaderboardReadModelSchema.parse(
              await phaseFour.application.leaderboard(
                await user(request),
                idOf(request),
                month,
              ),
            ),
          );
        },
      },
    );
  }

  if (deps.phaseFive !== undefined) {
    const phaseFive = deps.phaseFive;
    const user = async (request: ApiRequest) =>
      (await phaseFive.auth.authenticate(bearer(request))).userId;
    routes.push({
      method: 'POST',
      path: '/v1/phase-five/commands',
      schema: { ...commonSchema, body: { type: 'object' } },
      async handler(request) {
        const userId = await user(request);
        const command = phaseFiveCommandSchema.parse(request.body);
        return json(
          phaseFiveReceiptSchema.parse(
            await phaseFive.application.execute(userId, command),
          ),
        );
      },
    });
    const projections = {
      competitions: async (userId: string, id: string) =>
        competitionPyramidReadModelSchema.parse(
          await phaseFive.application.pyramid(userId, id),
        ),
      calendar: async (userId: string, id: string) =>
        competitionCalendarReadModelSchema.parse(
          await phaseFive.application.calendar(userId, id),
        ),
      'next-season': async (userId: string, id: string) =>
        nextSeasonTransitionReadModelSchema.parse(
          await phaseFive.application.transition(userId, id),
        ),
    };
    for (const [name, project] of Object.entries(projections))
      routes.push({
        method: 'GET',
        path: `/v1/phase-five/careers/:id/${name}`,
        schema: withId,
        async handler(request) {
          return json(await project(await user(request), idOf(request)));
        },
      });
  }

  if (deps.rankings !== undefined) {
    const rankings = deps.rankings;
    routes.push(
      {
        method: 'GET',
        path: '/v1/rankings',
        schema: {
          summary:
            'Global coach ranking snapshot (scope=global|rise|monthly, period=YYYY-MM)',
          querystring: {
            type: 'object',
            properties: {
              scope: { type: 'string', enum: ['global', 'rise', 'monthly'] },
              period: { type: 'string' },
              limit: { type: 'string' },
            },
          },
        },
        async handler(request) {
          const query = Object.fromEntries(
            Object.entries({
              scope: request.query.scope,
              period: request.query.period,
              limit: request.query.limit,
            }).filter(([, value]) => value !== undefined && value !== ''),
          );
          // Snapshots change every 15 minutes (Cron Trigger); cache ~5 min.
          return {
            status: 200,
            headers: {
              'cache-control': 'public, max-age=300, s-maxage=300',
            },
            body: rankingReadModelSchema.parse(
              await rankings.leaderboard(query),
            ),
          };
        },
      },
      {
        method: 'GET',
        path: '/v1/rankings/me',
        schema: {
          ...commonSchema,
          summary: 'Position of the authenticated user in each ranking scope',
        },
        async handler(request) {
          return json(
            myRankingReadModelSchema.parse(
              await rankings.mine(bearer(request)),
            ),
          );
        },
      },
    );
  }

  if (deps.billing !== undefined) routes.push(...billingRoutes(deps.billing));
  if (deps.avatars !== undefined) routes.push(...avatarRoutes(deps.avatars));
  if (deps.rum !== undefined) routes.push(rumRoute(deps.rum));

  routes.push(
    {
      method: 'GET',
      path: '/v1/jobs/:id',
      schema: withId,
      async handler(request) {
        const { status } = await authorizedJob(
          deps,
          bearer(request),
          idOf(request),
        );
        return json(jobStatusSchema.parse(status));
      },
    },
    {
      method: 'GET',
      path: '/v1/jobs/:id/events',
      schema: withId,
      async handler(request) {
        const { status, aggregateVersion } = await authorizedJob(
          deps,
          bearer(request),
          idOf(request),
        );
        const event = statusEvent(
          status,
          aggregateVersion,
          deps.now?.() ?? new Date(),
        );
        jobSseEventSchema.parse(event);
        return {
          contentType: 'text/event-stream; charset=utf-8',
          headers: { connection: 'keep-alive' },
          body: `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        };
      },
    },
  );
  return routes;
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
        retryable:
          status.errorCode !== 'MAX_ATTEMPTS_EXCEEDED' &&
          status.errorCode !== 'WORKER_TIMEOUT' &&
          status.attempt < 20,
      },
    };
  if (status.state === 'running')
    return { ...base, type: 'job.progress', data: status.progress };
  return { ...base, type: 'job.status', data: status };
}

/** Weak ETag of the Central bundle: shape revision and aggregate version. */
export function bundleEtag(aggregateVersion: number): string {
  return `W/"bundle-1-${String(aggregateVersion)}"`;
}

/** Aggregate version named by an `If-None-Match` header, if any. */
export function bundleVersionOf(
  header: string | undefined,
): number | undefined {
  for (const tag of (header ?? '').split(',')) {
    const match = /^(?:W\/)?"bundle-1-(\d+)"$/.exec(tag.trim());
    if (match?.[1] !== undefined) return Number(match[1]);
  }
  return undefined;
}

export function errorBody(
  requestId: string,
  code: ApiError['code'],
  message: string,
): ApiError {
  const base = { version: 1 as const, requestId, code, message };
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

export function mapError(
  error: unknown,
  requestId: string,
): { status: number; body: ApiError } {
  if (
    error instanceof ZodError ||
    (typeof error === 'object' && error !== null && 'validation' in error)
  )
    return {
      status: 400,
      body: errorBody(
        requestId,
        'VALIDATION_ERROR',
        'request validation failed',
      ),
    };
  if (error instanceof WooviApiError)
    return {
      status: 502,
      body: errorBody(
        requestId,
        'INTERNAL_ERROR',
        'payment provider unavailable',
      ),
    };
  if (error instanceof CareerLimitReachedError)
    return { status: 403, body: error.toApiError(requestId) };
  if (error instanceof AuthenticationError)
    return {
      status: 401,
      body: errorBody(requestId, 'UNAUTHORIZED', 'authentication required'),
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
      body: errorBody(requestId, error.code, error.message),
    };
  }
  if (
    error instanceof PhaseFourAuthorizationError ||
    error instanceof PhaseFiveAuthorizationError
  )
    return {
      status: 403,
      body: errorBody(requestId, 'FORBIDDEN', error.message),
    };
  if (
    error instanceof PhaseFourNotFoundError ||
    error instanceof PhaseFiveNotFoundError
  )
    return {
      status: 404,
      body: errorBody(requestId, 'NOT_FOUND', error.message),
    };
  if (error instanceof TransferMarketError)
    return { status: 409, body: error.toApiError(requestId) };
  if (
    error instanceof PhaseFourConflictError ||
    error instanceof PhaseFiveConflictError
  )
    return {
      status: 409,
      body: errorBody(requestId, 'VERSION_CONFLICT', error.message),
    };
  return {
    status: 500,
    body: errorBody(requestId, 'INTERNAL_ERROR', 'internal server error'),
  };
}

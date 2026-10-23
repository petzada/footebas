// Career Durable Object (ADR 0014): one object per career keeps the hydrated
// aggregate in memory and runs that career's commands, reads and simulation
// jobs through the same route table as the Worker.
import {
  FootebasApplication,
  InMemoryArchiveStorage,
  InMemoryStorage,
  Mulberry32RandomFactory,
  NoopTelemetry,
  PhaseFourApplicationService,
  RandomIdGenerator,
  UnifiedPhaseFourRepository,
  catalogCareerContent,
  type AuthPort,
  type CareerContentPort,
  type CareerSlotsPort,
  type EntitlementsPort,
  type IdGenerator,
  type JobQueuePort,
  type SimulationJob,
} from '@footebas/application';
import type { JobStatus } from '@footebas/contracts';
import {
  PostgresCareerSaveStore,
  PostgresCareerSlots,
  PostgresEntitlements,
  SystemClock,
  type CareerSaveStore,
  type Clock,
} from '@footebas/database';
import postgres from 'postgres';
import {
  cachedCareerSlots,
  cachedLicensedEntitlements,
} from './career-access-cache.js';
import {
  DurableCareerUnitOfWork,
  type CareerObjectStorage,
} from './career-unit-of-work.js';
import {
  createFetchHandler,
  type ForwardInput,
  type TimingMetric,
} from './fetch-router.js';
import { consoleLogSink, errorFields } from './observability.js';
import { QueueJobStore, type SimulationQueue } from './queue-job-store.js';
import { isolateLocation, QueryCounter } from './request-timing.js';
import { withSmokeAuth } from './smoke-auth.js';
import { SupabaseJwtAuth } from './supabase-auth.js';

/** Internal path of the queue consumer; never matched by the public router. */
export const CAREER_JOB_PATH = '/internal/jobs/run';
/** Internal path that loads a just-created career; never public either. */
export const CAREER_WARM_PATH = '/internal/careers/warm';
const CAREER_HEADER = 'x-footebas-career';

export interface CareerObjectDependencies {
  readonly storage: CareerObjectStorage;
  readonly store: () => CareerSaveStore;
  readonly jobs: () => JobQueuePort;
  readonly auth: AuthPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly content?: CareerContentPort;
  /** Plan limits (careers, starting club); free plan when absent. */
  readonly entitlements?: () => EntitlementsPort;
  /** Creation order of the user's careers (locked careers after a refund). */
  readonly careerSlots?: () => CareerSlotsPort;
  /** Free plan starts in Série C (docs/05 §5); on in production. */
  readonly enforceStartingDivision?: boolean;
  /** Postgres queries sent so far by this object (Server-Timing `do-pg`). */
  readonly queries?: () => number;
  /** Cloudflare location running this object, once known (`do-colo`). */
  readonly location?: () => string | undefined;
}

/** Runtime-independent core of the career object (tested with fakes). */
export class CareerObject {
  public readonly unitOfWork: DurableCareerUnitOfWork;
  private readonly content: CareerContentPort;

  public constructor(private readonly deps: CareerObjectDependencies) {
    this.content = deps.content ?? catalogCareerContent;
    this.unitOfWork = new DurableCareerUnitOfWork({
      storage: deps.storage,
      store: deps.store,
      content: this.content,
      clock: deps.clock,
    });
  }

  private application(jobs: JobQueuePort): FootebasApplication {
    return new FootebasApplication({
      auth: this.deps.auth,
      clock: this.deps.clock,
      ids: this.deps.ids,
      jobs,
      storage: new InMemoryStorage(),
      telemetry: new NoopTelemetry(),
      unitOfWork: this.unitOfWork,
      content: this.content,
      ...(this.deps.entitlements === undefined
        ? {}
        : { entitlements: this.deps.entitlements() }),
      ...(this.deps.careerSlots === undefined
        ? {}
        : { careerSlots: this.deps.careerSlots() }),
      ...(this.deps.enforceStartingDivision === true
        ? { enforceStartingDivision: true }
        : {}),
    });
  }

  /** Runs a simulation job of this career (queue consumer). */
  public runJob(job: SimulationJob): Promise<JobStatus> {
    return this.application(this.deps.jobs()).runJob(job, {
      requeueOnFailure: false,
    });
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === CAREER_JOB_PATH && request.method === 'POST')
      return Response.json(
        await this.runJob((await request.json()) as SimulationJob),
      );
    if (url.pathname === CAREER_WARM_PATH && request.method === 'POST') {
      const careerId = request.headers.get(CAREER_HEADER) ?? '';
      if (careerId.length === 0) return new Response(null, { status: 400 });
      await this.unitOfWork.warm(careerId);
      return new Response(null, { status: 204 });
    }
    const jobs = this.deps.jobs();
    const application = this.application(jobs);
    const phaseFour = new PhaseFourApplicationService({
      repository: new UnifiedPhaseFourRepository(this.unitOfWork, this.content),
      archives: new InMemoryArchiveStorage(),
      clock: this.deps.clock,
      ids: this.deps.ids,
      random: new Mulberry32RandomFactory(),
    });
    const requestId = request.headers.get('x-request-id');
    // Deltas of this object's counters while the request ran (approximate
    // when requests overlap, as reads can).
    const stages = { ...this.unitOfWork.stages };
    const queries = this.deps.queries?.() ?? 0;
    const timings = (): TimingMetric[] => {
      const location = this.deps.location?.();
      return [
        ...(['queue', 'load', 'commit'] as const).map((name) => ({
          name,
          dur: this.unitOfWork.stages[name] - stages[name],
        })),
        ...(this.deps.queries === undefined
          ? []
          : [
              {
                name: 'pg',
                desc: `n=${String(this.deps.queries() - queries)}`,
              },
            ]),
        ...(location === undefined ? [] : [{ name: 'colo', desc: location }]),
      ];
    };
    return createFetchHandler(
      {
        application,
        jobs,
        phaseFour: { application: phaseFour, auth: this.deps.auth },
        ...(requestId === null ? {} : { nextRequestId: () => requestId }),
      },
      {
        timingPrefix: 'do-',
        timings,
        onComplete: (completion) => {
          if (completion.error !== undefined)
            consoleLogSink({
              type: 'career_object',
              level: 'error',
              requestId: completion.requestId,
              route: completion.route,
              status: completion.status,
              careerId: request.headers.get(CAREER_HEADER) ?? 'unknown',
              ...errorFields(completion.error),
            });
        },
      },
    )(request);
  }
}

/** Bindings the career object reads (a subset of the Worker's `Env`). */
export interface CareerObjectEnv {
  readonly HYPERDRIVE: { readonly connectionString: string };
  readonly SIMULATION_QUEUE: SimulationQueue;
  readonly SUPABASE_URL: string;
  readonly SMOKE_TOKEN?: string;
}

/**
 * Idle seconds before the object's Postgres connections close. An open
 * outbound connection keeps a Durable Object alive (and billed for duration)
 * for up to 15 minutes; reconnecting through Hyperdrive costs a few ms.
 */
const POSTGRES_IDLE_TIMEOUT_SECONDS = 10;

/**
 * Cloudflare class (SQLite-backed, `migrations` in wrangler.jsonc). Its
 * Postgres client lives as long as the object: concurrent requests of a
 * Durable Object share one I/O context.
 */
export class CareerDurableObject {
  private readonly object: CareerObject;
  private sql: postgres.Sql | undefined;

  public constructor(
    state: { readonly storage: CareerObjectStorage },
    env: CareerObjectEnv,
  ) {
    const clock = new SystemClock();
    const queries = new QueryCounter();
    const sql = () =>
      (this.sql ??= postgres(env.HYPERDRIVE.connectionString, {
        max: 2,
        fetch_types: false,
        idle_timeout: POSTGRES_IDLE_TIMEOUT_SECONDS,
        debug: queries.hook,
      }));
    // Lives as long as the object, so reads stay in memory most of the time.
    const entitlements = cachedLicensedEntitlements(
      () => new PostgresEntitlements(sql()),
    );
    const careerSlots = cachedCareerSlots(() => new PostgresCareerSlots(sql()));
    this.object = new CareerObject({
      storage: state.storage,
      store: () => new PostgresCareerSaveStore(sql(), clock),
      jobs: () => new QueueJobStore(sql(), env.SIMULATION_QUEUE),
      auth: withSmokeAuth(
        new SupabaseJwtAuth({ projectUrl: env.SUPABASE_URL }),
        env.SMOKE_TOKEN,
      ),
      clock,
      ids: new RandomIdGenerator(),
      entitlements: () => entitlements,
      careerSlots: () => careerSlots,
      enforceStartingDivision: true,
      queries: () => queries.count,
      location: () => isolateLocation(),
    });
  }

  public fetch(request: Request): Promise<Response> {
    return this.object.fetch(request);
  }
}

// --- Worker side ---------------------------------------------------------------

export interface CareerObjectStub {
  fetch(request: Request): Promise<Response>;
}
/** Subset of `DurableObjectNamespace` used by the Worker. */
export interface CareerObjectNamespace {
  idFromName(name: string): unknown;
  get(id: never, options?: { locationHint?: string }): CareerObjectStub;
}

/**
 * Where new career objects are created. Durable Objects do not spawn in South
 * America (a `sam` hint lands in eastern North America), and the database is
 * in AWS us-east-1: say so explicitly. Only the first `get()` of an object
 * uses the hint; existing objects never move.
 */
export const CAREER_OBJECT_LOCATION = 'enam';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Career a request belongs to, when it must run in the career object:
 * career reads, career commands (all but CreateCareer) and phase four.
 * Lists, job status, rankings and billing stay on Postgres.
 */
export function careerOfRoute(
  route: string,
  params: Readonly<Record<string, string>>,
  body: unknown,
): string | undefined {
  if (
    route.startsWith('/v1/careers/:id/') ||
    route.startsWith('/v1/phase-four/careers/:id/')
  )
    return params.id;
  if (
    route === '/v1/commands' &&
    isRecord(body) &&
    body.type !== 'CreateCareer' &&
    isRecord(body.payload) &&
    typeof body.payload.careerId === 'string'
  )
    return body.payload.careerId;
  if (
    route === '/v1/phase-four/commands' &&
    isRecord(body) &&
    typeof body.careerId === 'string'
  )
    return body.careerId;
  return undefined;
}

function stubOf(
  namespace: CareerObjectNamespace,
  careerId: string,
): CareerObjectStub {
  return namespace.get(namespace.idFromName(careerId) as never, {
    locationHint: CAREER_OBJECT_LOCATION,
  });
}

/** `forward` option of the Worker's router: career routes go to the object. */
export function careerForwarder(
  namespace: CareerObjectNamespace,
): (input: ForwardInput) => Promise<Response | undefined> {
  return async ({ request, route, params, body, rawBody, requestId }) => {
    const careerId = careerOfRoute(route, params, body);
    if (careerId === undefined || careerId.length === 0) return undefined;
    const headers = new Headers(request.headers);
    headers.set('x-request-id', requestId);
    headers.set(CAREER_HEADER, careerId);
    return stubOf(namespace, careerId).fetch(
      new Request(request.url, {
        method: request.method,
        headers,
        ...(request.method === 'GET' || request.method === 'HEAD'
          ? {}
          : { body: rawBody }),
      }),
    );
  };
}

/** Queue consumer side: runs the job inside the career's object. */
export async function runJobInCareerObject(
  namespace: CareerObjectNamespace,
  job: SimulationJob,
): Promise<JobStatus> {
  const response = await stubOf(namespace, job.careerId).fetch(
    new Request(`https://career.internal${CAREER_JOB_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(job),
    }),
  );
  if (!response.ok)
    throw new Error(
      `career object answered ${String(response.status)} for job ${job.id}`,
    );
  return (await response.json()) as JobStatus;
}

/**
 * After CreateCareer (Worker side, off the response path): has the new
 * career's object load it from Postgres now, so its first command (usually
 * SelectClub) finds it in memory instead of paying the cold load. Purely an
 * optimization: the object loads the same way on demand if this never runs.
 */
export async function warmCareerObject(
  namespace: CareerObjectNamespace,
  careerId: string,
): Promise<void> {
  const response = await stubOf(namespace, careerId).fetch(
    new Request(`https://career.internal${CAREER_WARM_PATH}`, {
      method: 'POST',
      headers: { [CAREER_HEADER]: careerId },
    }),
  );
  if (!response.ok)
    throw new Error(
      `career object answered ${String(response.status)} warming ${careerId}`,
    );
}

// Cloudflare Workers entry: HTTP API (fetch), simulation consumer (queue) and
// the ranking snapshot job (scheduled, Cron Trigger).
// Persistence is Supabase Postgres through Hyperdrive; auth is Supabase JWT.
// Career commands, reads and jobs run in the career Durable Object when the
// `CAREERS` binding exists (ADR 0014); without it they use Postgres directly.
import {
  FootebasApplication,
  InMemoryArchiveStorage,
  InMemoryStorage,
  Mulberry32RandomFactory,
  NoopTelemetry,
  PhaseFourApplicationService,
  RandomIdGenerator,
  RankingService,
  UnifiedPhaseFourRepository,
  type AuthPort,
  type SimulationJob,
} from '@footebas/application';
import {
  PostgresEntitlements,
  PostgresRankingStore,
  PostgresUnitOfWork,
  SystemClock,
} from '@footebas/database';
import postgres from 'postgres';
import { PostgresBillingRepository } from './billing/billing-repository-postgres.js';
import { r2AvatarStore } from './avatar-routes.js';
import { AbacatePayClient } from './billing/abacatepay-client.js';
import { BillingService, DEFAULT_BILLING_CONFIG } from './billing/service.js';
import {
  parsePublicKeyPems,
  RemotePublicKeys,
  StaticPublicKeys,
} from './billing/webhook-signature.js';
import {
  UnconfiguredWooviClient,
  WOOVI_SANDBOX_URL,
  WooviHttpClient,
} from './billing/woovi-client.js';
import {
  careerForwarder,
  runJobInCareerObject,
  type CareerObjectNamespace,
} from './career-durable-object.js';
import { createFetchHandler } from './fetch-router.js';
import {
  consoleLogSink,
  errorFields,
  jobLogEntry,
  requestLogEntry,
  type JobOutcome,
} from './observability.js';
import {
  rateLimitGuard,
  WorkersRateLimiter,
  type RateLimitBinding,
} from './rate-limit.js';
import { identifyRequest } from './request-identity.js';
import { QueueJobStore } from './queue-job-store.js';
import { errorBody } from './routes.js';
import { withSmokeAuth } from './smoke-auth.js';
import { SupabaseJwtAuth } from './supabase-auth.js';

interface QueueMessage<T> {
  readonly body: T;
  /** Delivery count (1 on the first attempt). */
  readonly attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}
interface MessageBatch<T> {
  readonly messages: readonly QueueMessage<T>[];
}
interface ScheduledController {
  readonly cron: string;
  readonly scheduledTime: number;
}

export interface Env {
  readonly HYPERDRIVE: { readonly connectionString: string };
  readonly SIMULATION_QUEUE: { send(body: SimulationJob): Promise<void> };
  readonly SUPABASE_URL: string;
  readonly CORS_ORIGINS?: string;
  /** Secret (wrangler secret put SMOKE_TOKEN) enabling the cloud smoke bearer. */
  readonly SMOKE_TOKEN?: string;
  /** R2 bucket for coach avatars (public at AVATAR_PUBLIC_URL). */
  readonly AVATARS?: Parameters<typeof r2AvatarStore>[0];
  readonly AVATAR_PUBLIC_URL?: string;
  /** Workers version metadata binding, reported by GET /health. */
  readonly CF_VERSION_METADATA?: { readonly id: string; readonly tag?: string };
  /** PIX provider (var): `abacatepay` (default, ADR 0016) or `woovi`. */
  readonly PAYMENT_PROVIDER?: string;
  /** Secret: AbacatePay API key (`wrangler secret put ABACATEPAY_API_KEY`). */
  readonly ABACATEPAY_API_KEY?: string;
  /** Secret: value set as `secret` on the AbacatePay webhook. */
  readonly ABACATEPAY_WEBHOOK_SECRET?: string;
  /** Woovi base URL (var): sandbox or https://api.woovi.com. */
  readonly WOOVI_API_URL?: string;
  /** Secret: Woovi AppID (`wrangler secret put WOOVI_APP_ID`). */
  readonly WOOVI_APP_ID?: string;
  /** Optional pinned webhook public key(s), PEM or base64 PEM. */
  readonly WOOVI_WEBHOOK_PUBLIC_KEYS?: string;
  /** Optional secret: `authorization` header value set on the Woovi webhook. */
  readonly WOOVI_WEBHOOK_SECRET?: string;
  /** License price in cents (default 4990). */
  readonly LICENSE_PRICE_CENTS?: string;
  /** PIX charge lifetime in seconds (default 3600, min 300). */
  readonly LICENSE_CHARGE_EXPIRES_IN?: string;
  /** Rate Limiting bindings (`ratelimits` in wrangler.jsonc). */
  readonly RATE_LIMIT_COMMANDS?: RateLimitBinding;
  readonly RATE_LIMIT_READS?: RateLimitBinding;
  readonly RATE_LIMIT_PUBLIC?: RateLimitBinding;
  /** Career Durable Objects (`CareerDurableObject`, ADR 0014). */
  readonly CAREERS?: CareerObjectNamespace;
}

export { CareerDurableObject } from './career-durable-object.js';

/** Mirrors `max_retries` of the simulation consumer in wrangler.jsonc. */
const QUEUE_MAX_RETRIES = 5;

function workerVersion(env: Env): string {
  return env.CF_VERSION_METADATA?.id ?? 'unknown';
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function billing(env: Env, sql: postgres.Sql, auth: AuthPort) {
  const apiUrl = env.WOOVI_API_URL ?? WOOVI_SANDBOX_URL;
  const appId = env.WOOVI_APP_ID?.trim() ?? '';
  const pinned = parsePublicKeyPems(env.WOOVI_WEBHOOK_PUBLIC_KEYS ?? '');
  const abacate = (env.PAYMENT_PROVIDER ?? 'abacatepay') === 'abacatepay';
  const abacateKey = env.ABACATEPAY_API_KEY?.trim() ?? '';
  const provider = abacate
    ? abacateKey === ''
      ? new UnconfiguredWooviClient()
      : new AbacatePayClient({ apiKey: abacateKey })
    : appId === ''
      ? new UnconfiguredWooviClient()
      : new WooviHttpClient({ apiUrl, appId });
  const webhookSecret = abacate
    ? env.ABACATEPAY_WEBHOOK_SECRET
    : env.WOOVI_WEBHOOK_SECRET;
  const service = new BillingService({
    repository: new PostgresBillingRepository(sql),
    woovi: provider,
    webhookProvider: abacate ? 'abacatepay' : 'woovi',
    entitlements: new PostgresEntitlements(sql),
    webhookKeys:
      pinned.length > 0
        ? new StaticPublicKeys(pinned)
        : new RemotePublicKeys({ apiUrl }),
    ...(webhookSecret === undefined ? {} : { webhookSecret }),
    config: {
      priceCents: positiveInteger(
        env.LICENSE_PRICE_CENTS,
        DEFAULT_BILLING_CONFIG.priceCents,
      ),
      chargeExpiresInSeconds: positiveInteger(
        env.LICENSE_CHARGE_EXPIRES_IN,
        DEFAULT_BILLING_CONFIG.chargeExpiresInSeconds,
      ),
    },
  });
  return { service, auth };
}

/** Billing reconciliation step of the cron; logs and never throws. */
async function reconcileBilling(
  env: Env,
  sql: postgres.Sql,
  auth: AuthPort,
  cron: string,
  version: string,
): Promise<void> {
  const started = Date.now();
  try {
    const run = await billing(env, sql, auth).service.reconcile();
    consoleLogSink({
      type: 'cron',
      level: run.failed > 0 ? 'warn' : 'info',
      task: 'billing_reconcile',
      cron,
      durationMs: Date.now() - started,
      version,
      ...run,
    });
  } catch (error) {
    consoleLogSink({
      type: 'cron',
      level: 'error',
      task: 'billing_reconcile',
      cron,
      durationMs: Date.now() - started,
      version,
      ...errorFields(error),
    });
  }
}

function compose(env: Env) {
  const sql = postgres(env.HYPERDRIVE.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: false,
  });
  const clock = new SystemClock();
  const ids = new RandomIdGenerator();
  const auth = withSmokeAuth(
    new SupabaseJwtAuth({ projectUrl: env.SUPABASE_URL }),
    env.SMOKE_TOKEN,
  );
  const unitOfWork = new PostgresUnitOfWork(sql, clock);
  const jobs = new QueueJobStore(sql, env.SIMULATION_QUEUE);
  const application = new FootebasApplication({
    auth,
    clock,
    entitlements: new PostgresEntitlements(sql),
    enforceStartingDivision: true,
    ids,
    jobs,
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
  });
  const phaseFour = new PhaseFourApplicationService({
    repository: new UnifiedPhaseFourRepository(unitOfWork),
    archives: new InMemoryArchiveStorage(),
    clock,
    ids,
    random: new Mulberry32RandomFactory(),
  });
  const rankings = new RankingService({
    store: new PostgresRankingStore(sql),
    clock,
    auth,
  });
  return { sql, auth, jobs, application, phaseFour, rankings };
}

async function handle(request: Request, env: Env): Promise<Response> {
  const version = workerVersion(env);
  const identity = await identifyRequest(request);
  const limiter = new WorkersRateLimiter({
    command: env.RATE_LIMIT_COMMANDS,
    read: env.RATE_LIMIT_READS,
    public: env.RATE_LIMIT_PUBLIC,
  });
  const { sql, auth, jobs, application, phaseFour, rankings } = compose(env);
  try {
    return await createFetchHandler(
      {
        application,
        jobs,
        phaseFour: { application: phaseFour, auth },
        rankings,
        billing: billing(env, sql, auth),
        ...(env.AVATARS === undefined
          ? {}
          : {
              avatars: {
                auth,
                store: r2AvatarStore(env.AVATARS),
                publicBaseUrl:
                  env.AVATAR_PUBLIC_URL ?? 'https://cdn.footebas.com.br',
              },
            }),
        corsOrigins: (env.CORS_ORIGINS ?? 'https://footebas.com.br')
          .split(',')
          .map((origin) => origin.trim()),
        health: {
          version,
          timeoutMs: 2000,
          database: async () => {
            await sql`select 1`;
          },
        },
      },
      {
        rateLimit: rateLimitGuard(limiter, identity),
        ...(env.CAREERS === undefined
          ? {}
          : { forward: careerForwarder(env.CAREERS) }),
        onComplete: (completion) => {
          consoleLogSink(requestLogEntry(completion, identity, version));
        },
      },
    )(request);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handle(request, env);
    } catch (error) {
      // Composition failed before the router could answer: log, stay generic.
      const requestId = `request_${crypto.randomUUID().replaceAll('-', '')}`;
      consoleLogSink({
        type: 'request',
        level: 'error',
        requestId,
        method: request.method,
        route: 'unhandled',
        status: 500,
        version: workerVersion(env),
        ...errorFields(error),
      });
      return new Response(
        JSON.stringify(
          errorBody(requestId, 'INTERNAL_ERROR', 'internal server error'),
        ),
        {
          status: 500,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
            'x-request-id': requestId,
          },
        },
      );
    }
  },
  /**
   * Cron Trigger (wrangler.jsonc `triggers.crons`, every 15 min): the
   * billing reconciliation (payments, refunds and disputes whose webhook
   * never arrived), then the ranking snapshots. A billing failure is logged
   * and never skips the rankings.
   */
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const version = workerVersion(env);
    const { sql, auth, rankings } = compose(env);
    // Never throws: its outcome is logged on its own line.
    await reconcileBilling(env, sql, auth, controller.cron, version);
    const started = Date.now();
    try {
      const run = await rankings.generateSnapshots();
      consoleLogSink({
        type: 'cron',
        level: 'info',
        task: 'ranking_snapshots',
        cron: controller.cron,
        durationMs: Date.now() - started,
        version,
        snapshots: run.snapshots.map(
          ({ scope, period, rows }) => `${scope}:${period}:${String(rows)}`,
        ),
      });
    } catch (error) {
      consoleLogSink({
        type: 'cron',
        level: 'error',
        task: 'ranking_snapshots',
        cron: controller.cron,
        durationMs: Date.now() - started,
        version,
        ...errorFields(error),
      });
      throw error;
    } finally {
      await sql.end({ timeout: 1 });
    }
  },
  async queue(batch: MessageBatch<SimulationJob>, env: Env): Promise<void> {
    const version = workerVersion(env);
    const { sql, application } = compose(env);
    try {
      for (const message of batch.messages) {
        const started = Date.now();
        let result: JobOutcome;
        let failure: unknown;
        try {
          const status =
            env.CAREERS === undefined
              ? await application.runJob(message.body, {
                  requeueOnFailure: false,
                })
              : await runJobInCareerObject(env.CAREERS, message.body);
          if (status.state === 'failed') {
            message.retry({ delaySeconds: 5 });
            result =
              message.attempts > QUEUE_MAX_RETRIES ? 'dead_letter' : 'retry';
          } else {
            message.ack();
            result = status.state;
          }
        } catch (error) {
          failure = error;
          message.retry({ delaySeconds: 5 });
          result =
            message.attempts > QUEUE_MAX_RETRIES ? 'dead_letter' : 'error';
        }
        consoleLogSink(
          jobLogEntry(
            {
              jobId: message.body.id,
              careerId: message.body.careerId,
              attempts: message.attempts,
              durationMs: Date.now() - started,
              result,
              ...(failure === undefined ? {} : { error: failure }),
            },
            version,
          ),
        );
      }
    } finally {
      await sql.end({ timeout: 1 });
    }
  },
};

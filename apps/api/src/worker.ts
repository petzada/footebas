// Cloudflare Workers entry: HTTP API (fetch) and simulation consumer (queue).
// Persistence is Supabase Postgres through Hyperdrive; auth is Supabase JWT.
import {
  FootebasApplication,
  InMemoryArchiveStorage,
  InMemoryStorage,
  Mulberry32RandomFactory,
  NoopTelemetry,
  PhaseFourApplicationService,
  RandomIdGenerator,
  UnifiedPhaseFourRepository,
  type AuthPort,
  type JobQueuePort,
  type SimulationJob,
} from '@footebas/application';
import type { JobStatus } from '@footebas/contracts';
import {
  PostgresEntitlements,
  PostgresUnitOfWork,
  SystemClock,
} from '@footebas/database';
import postgres from 'postgres';
import { PostgresBillingRepository } from './billing/billing-repository-postgres.js';
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
import { createFetchHandler } from './fetch-router.js';
import { withSmokeAuth } from './smoke-auth.js';
import { SupabaseJwtAuth } from './supabase-auth.js';

interface QueueMessage<T> {
  readonly body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}
interface MessageBatch<T> {
  readonly messages: readonly QueueMessage<T>[];
}

export interface Env {
  readonly HYPERDRIVE: { readonly connectionString: string };
  readonly SIMULATION_QUEUE: { send(body: SimulationJob): Promise<void> };
  readonly SUPABASE_URL: string;
  readonly CORS_ORIGINS?: string;
  /** Secret (wrangler secret put SMOKE_TOKEN) enabling the cloud smoke bearer. */
  readonly SMOKE_TOKEN?: string;
  /** Workers version metadata binding, reported by GET /health. */
  readonly CF_VERSION_METADATA?: { readonly id: string; readonly tag?: string };
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
  const service = new BillingService({
    repository: new PostgresBillingRepository(sql),
    woovi:
      appId === ''
        ? new UnconfiguredWooviClient()
        : new WooviHttpClient({ apiUrl, appId }),
    entitlements: new PostgresEntitlements(sql),
    webhookKeys:
      pinned.length > 0
        ? new StaticPublicKeys(pinned)
        : new RemotePublicKeys({ apiUrl }),
    ...(env.WOOVI_WEBHOOK_SECRET === undefined
      ? {}
      : { webhookSecret: env.WOOVI_WEBHOOK_SECRET }),
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

/** Job status lives in Postgres; Cloudflare Queues carries the job itself. */
class QueueJobStore implements JobQueuePort {
  public constructor(
    private readonly sql: postgres.Sql,
    private readonly queue?: Env['SIMULATION_QUEUE'],
  ) {}

  public async enqueue(job: SimulationJob): Promise<void> {
    await this.sql`
      insert into footebas.simulation_jobs (id, career_id, user_id, job)
      values (${job.id}, ${job.careerId}, ${job.userId}, ${this.sql.json(job as never)})
      on conflict (id) do update set job = excluded.job, user_id = excluded.user_id`;
    await this.queue?.send(job);
  }

  public take(): Promise<SimulationJob | undefined> {
    return Promise.resolve(undefined);
  }

  public async status(jobId: string): Promise<JobStatus | undefined> {
    const rows = await this.sql<{ status: JobStatus | null }[]>`
      select status from footebas.simulation_jobs where id = ${jobId}`;
    return rows[0]?.status ?? undefined;
  }

  public async update(status: JobStatus): Promise<void> {
    await this.sql`
      insert into footebas.simulation_jobs (id, career_id, status, updated_at)
      values (${status.jobId}, ${status.careerId}, ${this.sql.json(status)}, now())
      on conflict (id) do update set status = excluded.status, updated_at = now()`;
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
  return { sql, auth, jobs, application, phaseFour };
}

async function handle(request: Request, env: Env): Promise<Response> {
  const { sql, auth, jobs, application, phaseFour } = compose(env);
  try {
    return await createFetchHandler({
      application,
      jobs,
      phaseFour: { application: phaseFour, auth },
      billing: billing(env, sql, auth),
      corsOrigins: (env.CORS_ORIGINS ?? 'https://footebas.com.br')
        .split(',')
        .map((origin) => origin.trim()),
      health: {
        version: env.CF_VERSION_METADATA?.id ?? 'unknown',
        timeoutMs: 2000,
        database: async () => {
          await sql`select 1`;
        },
      },
    })(request);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
  async queue(batch: MessageBatch<SimulationJob>, env: Env): Promise<void> {
    const { sql, application } = compose(env);
    try {
      for (const message of batch.messages) {
        const status = await application.runJob(message.body, {
          requeueOnFailure: false,
        });
        if (status.state === 'failed') message.retry({ delaySeconds: 5 });
        else message.ack();
      }
    } finally {
      await sql.end({ timeout: 1 });
    }
  },
};

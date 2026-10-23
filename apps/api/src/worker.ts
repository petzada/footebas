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
  type JobQueuePort,
  type SimulationJob,
} from '@footebas/application';
import type { JobStatus } from '@footebas/contracts';
import { PostgresUnitOfWork, SystemClock } from '@footebas/database';
import postgres from 'postgres';
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

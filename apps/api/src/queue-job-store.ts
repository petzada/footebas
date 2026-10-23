import type { JobQueuePort, SimulationJob } from '@footebas/application';
import type { JobStatus } from '@footebas/contracts';
import type postgres from 'postgres';

export interface SimulationQueue {
  send(body: SimulationJob): Promise<void>;
}

/** Job status lives in Postgres; Cloudflare Queues carries the job itself. */
export class QueueJobStore implements JobQueuePort {
  public constructor(
    private readonly sql: postgres.Sql,
    private readonly queue?: SimulationQueue,
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

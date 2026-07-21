import type { JobStatus } from '@footebas/contracts';
import type { JobQueuePort, SimulationJob } from '@footebas/application';

export interface DeadLetter {
  readonly job: SimulationJob;
  readonly status: JobStatus;
}

export interface WorkerJobQueuePort extends JobQueuePort {
  deadLetter(jobId: string, status: JobStatus): Promise<void>;
  deadLetters(): readonly DeadLetter[];
}

export class InMemoryWorkerJobQueue implements WorkerJobQueuePort {
  private readonly pending: SimulationJob[] = [];
  private readonly known = new Map<string, SimulationJob>();
  private readonly statuses = new Map<string, JobStatus>();
  private readonly dead = new Map<string, DeadLetter>();

  public enqueue(job: SimulationJob): Promise<void> {
    this.known.set(job.id, structuredClone(job));
    if (!this.dead.has(job.id) && !this.pending.some(({ id }) => id === job.id))
      this.pending.push(structuredClone(job));
    return Promise.resolve();
  }

  public take(): Promise<SimulationJob | undefined> {
    return Promise.resolve(this.pending.shift());
  }

  public status(jobId: string): Promise<JobStatus | undefined> {
    const status = this.statuses.get(jobId);
    return Promise.resolve(status && structuredClone(status));
  }

  public update(status: JobStatus): Promise<void> {
    this.statuses.set(status.jobId, structuredClone(status));
    return Promise.resolve();
  }

  public deadLetter(jobId: string, status: JobStatus): Promise<void> {
    const job = this.known.get(jobId);
    if (!job) throw new Error(`cannot dead-letter unknown job ${jobId}`);
    this.pending.splice(
      0,
      this.pending.length,
      ...this.pending.filter(({ id }) => id !== jobId),
    );
    const terminal = structuredClone(status);
    this.statuses.set(jobId, terminal);
    this.dead.set(jobId, { job: structuredClone(job), status: terminal });
    return Promise.resolve();
  }

  public deadLetters(): readonly DeadLetter[] {
    return [...this.dead.values()].map((entry) => structuredClone(entry));
  }
}

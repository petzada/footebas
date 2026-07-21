import type { Clock } from '@footebas/application';
import type { JobStatus } from '@footebas/contracts';
import type { Scheduler } from './scheduler.js';
import type { WorkerJobQueuePort } from './queue.js';

export interface JobRunner {
  runNextJob(): Promise<JobStatus | undefined>;
}

export interface WorkerRuntimeOptions {
  readonly maxAttempts?: number;
  readonly backoffMilliseconds?: (attempt: number) => number;
  readonly timeoutMilliseconds?: number;
}

export interface RunResult {
  readonly kind: 'idle' | 'succeeded' | 'retry_scheduled' | 'terminal';
  readonly status?: JobStatus;
}

export interface WorkerHealth {
  readonly acceptingWork: boolean;
  readonly running: boolean;
  readonly healthy: boolean;
  readonly lastCompletedAt?: string;
  readonly lastError?: string;
}

export class WorkerRuntime {
  private acceptingWork = true;
  private running = false;
  private healthy = true;
  private lastCompletedAt?: string;
  private lastError?: string;
  private readonly maxAttempts: number;
  private readonly timeoutMilliseconds: number;
  private readonly backoff: (attempt: number) => number;

  public constructor(
    private readonly runner: JobRunner,
    private readonly queue: WorkerJobQueuePort,
    private readonly clock: Clock,
    private readonly scheduler: Scheduler,
    options: WorkerRuntimeOptions = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? 30_000;
    this.backoff =
      options.backoffMilliseconds ?? ((attempt) => 100 * 2 ** (attempt - 1));
    if (
      !Number.isInteger(this.maxAttempts) ||
      this.maxAttempts < 1 ||
      this.maxAttempts > 20
    )
      throw new RangeError('maxAttempts must be an integer from 1 to 20');
    if (
      !Number.isFinite(this.timeoutMilliseconds) ||
      this.timeoutMilliseconds <= 0
    )
      throw new RangeError('timeoutMilliseconds must be positive');
  }

  public async runOnce(): Promise<RunResult> {
    if (!this.acceptingWork || this.running) return { kind: 'idle' };
    this.running = true;
    const startedAt = this.clock.now().getTime();
    try {
      const status = await this.runner.runNextJob();
      if (!status) return { kind: 'idle' };
      const elapsed = this.clock.now().getTime() - startedAt;
      if (elapsed > this.timeoutMilliseconds && status.state !== 'failed') {
        this.healthy = false;
        this.lastError = `job ${status.jobId} exceeded logical timeout`;
      }
      if (status.state === 'succeeded') {
        this.lastCompletedAt = this.clock.now().toISOString();
        return { kind: 'succeeded', status };
      }
      if (status.state !== 'failed') return { kind: 'terminal', status };
      if (status.attempt >= this.maxAttempts) {
        const terminal = {
          ...status,
          errorCode:
            elapsed > this.timeoutMilliseconds
              ? 'WORKER_TIMEOUT'
              : 'MAX_ATTEMPTS_EXCEEDED',
        };
        await this.queue.deadLetter(status.jobId, terminal);
        this.lastError = terminal.errorCode;
        return { kind: 'terminal', status: terminal };
      }
      await this.scheduler.delay(this.backoff(status.attempt));
      return { kind: 'retry_scheduled', status };
    } catch (error) {
      this.healthy = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.running = false;
    }
  }

  public async drain(maxJobs = 1_000): Promise<readonly RunResult[]> {
    if (!Number.isInteger(maxJobs) || maxJobs < 1)
      throw new RangeError('maxJobs must be positive');
    const results: RunResult[] = [];
    while (this.acceptingWork && results.length < maxJobs) {
      const result = await this.runOnce();
      if (result.kind === 'idle') break;
      results.push(result);
    }
    return results;
  }

  public shutdown(): void {
    this.acceptingWork = false;
  }

  public health(): WorkerHealth {
    return {
      acceptingWork: this.acceptingWork,
      running: this.running,
      healthy: this.healthy,
      ...(this.lastCompletedAt
        ? { lastCompletedAt: this.lastCompletedAt }
        : {}),
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }
}

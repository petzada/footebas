import type { FakeAuthIdentity, JobStatus, Session } from '@footebas/contracts';

export interface Clock {
  now(): Date;
}
export interface IdGenerator {
  next(kind: string): string;
}
export interface AuthPort {
  authenticate(bearer: string): Promise<FakeAuthIdentity>;
}
export interface StoragePort {
  put(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
}
export interface TelemetryPort {
  event(
    name: string,
    attributes?: Readonly<Record<string, string | number | boolean>>,
  ): void;
  error(error: unknown, attributes?: Readonly<Record<string, string>>): void;
}
export interface SimulationJob {
  readonly id: string;
  readonly commandId: string;
  readonly careerId: string;
  readonly userId: string;
  readonly expectedVersion: number;
  readonly fixtureId?: string;
}
export interface JobQueuePort {
  enqueue(job: SimulationJob): Promise<void>;
  take(): Promise<SimulationJob | undefined>;
  status(jobId: string): Promise<JobStatus | undefined>;
  update(status: JobStatus): Promise<void>;
}

export class AuthenticationError extends Error {}

export class FakeClock implements Clock {
  public constructor(private instant = new Date('2026-07-21T12:00:00.000Z')) {}
  public now(): Date {
    return new Date(this.instant);
  }
  public advance(milliseconds: number): void {
    this.instant = new Date(this.instant.getTime() + milliseconds);
  }
}
export class SequentialIdGenerator implements IdGenerator {
  private value = 0;
  public next(kind: string): string {
    this.value += 1;
    return `${kind}_${String(this.value)}`;
  }
}
export class FakeBearerAuth implements AuthPort {
  private readonly identities = new Map<string, FakeAuthIdentity>();
  public issue(identity: Omit<FakeAuthIdentity, 'version'>): string {
    const token = `fake.${identity.userId}`;
    this.identities.set(token, { version: 1, ...identity });
    return token;
  }
  public startSession(
    identity: Omit<FakeAuthIdentity, 'version'>,
    clock: Clock,
    ids: IdGenerator,
    ttlMilliseconds = 3_600_000,
  ): { readonly bearer: string; readonly session: Session } {
    const bearer = this.issue(identity);
    const issuedAt = clock.now();
    return {
      bearer,
      session: {
        version: 1,
        sessionId: ids.next('session'),
        identity: { version: 1, ...identity },
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + ttlMilliseconds).toISOString(),
      },
    };
  }
  public authenticate(bearer: string): Promise<FakeAuthIdentity> {
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer;
    const identity = this.identities.get(token);
    if (!identity)
      throw new AuthenticationError('invalid or expired bearer token');
    return Promise.resolve(structuredClone(identity));
  }
}
export class InMemoryStorage implements StoragePort {
  private readonly values = new Map<string, Uint8Array>();
  public put(key: string, value: Uint8Array): Promise<void> {
    this.values.set(key, value.slice());
    return Promise.resolve();
  }
  public get(key: string): Promise<Uint8Array | undefined> {
    return Promise.resolve(this.values.get(key)?.slice());
  }
}
export class NoopTelemetry implements TelemetryPort {
  public event(name: string): void {
    void name;
  }
  public error(error: unknown): void {
    void error;
  }
}
export class InMemoryJobQueue implements JobQueuePort {
  private readonly jobs: SimulationJob[] = [];
  private readonly statuses = new Map<string, JobStatus>();
  public enqueue(job: SimulationJob): Promise<void> {
    if (
      !this.jobs.some(({ id }) => id === job.id) &&
      this.statuses.get(job.id)?.state !== 'succeeded'
    )
      this.jobs.push(structuredClone(job));
    return Promise.resolve();
  }
  public take(): Promise<SimulationJob | undefined> {
    return Promise.resolve(this.jobs.shift());
  }
  public status(jobId: string): Promise<JobStatus | undefined> {
    const value = this.statuses.get(jobId);
    return Promise.resolve(value && structuredClone(value));
  }
  public update(status: JobStatus): Promise<void> {
    this.statuses.set(status.jobId, structuredClone(status));
    return Promise.resolve();
  }
}

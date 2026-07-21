import type { Clock } from '@footebas/application';

export interface Scheduler {
  delay(milliseconds: number): Promise<void>;
}

/** Deterministic scheduler: waiting advances logical time and never sleeps. */
export class FakeScheduler implements Scheduler {
  public readonly delays: number[] = [];

  public constructor(
    private readonly clock: Clock & { advance(milliseconds: number): void },
  ) {}

  public delay(milliseconds: number): Promise<void> {
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      throw new RangeError('delay must be a non-negative finite number');
    this.delays.push(milliseconds);
    this.clock.advance(milliseconds);
    return Promise.resolve();
  }
}

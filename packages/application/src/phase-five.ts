import type {
  CompetitionCalendarReadModel,
  CompetitionPyramidReadModel,
  NextSeasonTransitionReadModel,
  PhaseFiveCommand,
  PhaseFiveReceipt,
} from '@footebas/contracts';

export interface PhaseFiveCompetitionState {
  readonly careerId: string;
  readonly ownerId: string;
  readonly version: number;
  readonly pyramid: CompetitionPyramidReadModel;
  readonly calendar: CompetitionCalendarReadModel;
  readonly nextSeason: NextSeasonTransitionReadModel;
}

export interface StoredPhaseFiveReceipt {
  readonly fingerprint: string;
  readonly receipt: PhaseFiveReceipt;
}

export interface PhaseFiveCompetitionPort {
  load(careerId: string): Promise<PhaseFiveCompetitionState | undefined>;
  receiptByKey(
    careerId: string,
    key: string,
  ): Promise<StoredPhaseFiveReceipt | undefined>;
  receiptByCommandId(
    careerId: string,
    commandId: string,
  ): Promise<StoredPhaseFiveReceipt | undefined>;
  commit(input: {
    state: PhaseFiveCompetitionState;
    expectedVersion: number;
    idempotencyKey: string;
    record: StoredPhaseFiveReceipt;
  }): Promise<void>;
  withCareerLock<T>(careerId: string, work: () => Promise<T>): Promise<T>;
}

export interface PhaseFiveClockPort {
  now(): Date;
}

export class PhaseFiveAuthorizationError extends Error {}
export class PhaseFiveNotFoundError extends Error {}
export class PhaseFiveConflictError extends Error {}

const clone = <T>(value: T): T => structuredClone(value);
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
};

export class InMemoryPhaseFiveCompetitionAdapter implements PhaseFiveCompetitionPort {
  private readonly states = new Map<string, PhaseFiveCompetitionState>();
  private readonly receipts = new Map<string, StoredPhaseFiveReceipt>();
  private readonly commandReceipts = new Map<string, StoredPhaseFiveReceipt>();
  private readonly tails = new Map<string, Promise<void>>();

  public constructor(initial: readonly PhaseFiveCompetitionState[] = []) {
    for (const state of initial) this.states.set(state.careerId, clone(state));
  }

  public load(
    careerId: string,
  ): Promise<PhaseFiveCompetitionState | undefined> {
    const state = this.states.get(careerId);
    return Promise.resolve(state === undefined ? undefined : clone(state));
  }

  public receiptByKey(
    careerId: string,
    key: string,
  ): Promise<StoredPhaseFiveReceipt | undefined> {
    const record = this.receipts.get(`${careerId}:${key}`);
    return Promise.resolve(record === undefined ? undefined : clone(record));
  }

  public receiptByCommandId(
    careerId: string,
    commandId: string,
  ): Promise<StoredPhaseFiveReceipt | undefined> {
    const record = this.commandReceipts.get(`${careerId}:${commandId}`);
    return Promise.resolve(record === undefined ? undefined : clone(record));
  }

  public commit(input: {
    state: PhaseFiveCompetitionState;
    expectedVersion: number;
    idempotencyKey: string;
    record: StoredPhaseFiveReceipt;
  }): Promise<void> {
    const current = this.states.get(input.state.careerId);
    if (
      current?.version !== input.expectedVersion ||
      input.state.version !== input.expectedVersion + 1
    )
      throw new PhaseFiveConflictError('competition version conflict');
    const receiptKey = `${input.state.careerId}:${input.idempotencyKey}`;
    const commandKey = `${input.state.careerId}:${input.record.receipt.commandId}`;
    const byKey = this.receipts.get(receiptKey);
    const byCommand = this.commandReceipts.get(commandKey);
    if (
      (byKey !== undefined && byKey.fingerprint !== input.record.fingerprint) ||
      (byCommand !== undefined &&
        byCommand.fingerprint !== input.record.fingerprint)
    )
      throw new PhaseFiveConflictError(
        'command identity was reused with different content',
      );
    this.states.set(input.state.careerId, clone(input.state));
    this.receipts.set(receiptKey, clone(input.record));
    this.commandReceipts.set(commandKey, clone(input.record));
    return Promise.resolve();
  }

  public async withCareerLock<T>(
    careerId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const prior = this.tails.get(careerId) ?? Promise.resolve();
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prior.then(() => turn);
    this.tails.set(careerId, tail);
    await prior;
    try {
      return await work();
    } finally {
      release();
      if (this.tails.get(careerId) === tail) this.tails.delete(careerId);
    }
  }
}

export class PhaseFiveCompetitionService {
  public constructor(
    private readonly port: PhaseFiveCompetitionPort,
    private readonly clock: PhaseFiveClockPort = { now: () => new Date() },
  ) {}

  public execute(
    ownerId: string,
    command: PhaseFiveCommand,
  ): Promise<PhaseFiveReceipt> {
    return this.port.withCareerLock(command.careerId, async () => {
      const current = await this.owned(ownerId, command.careerId);
      const fingerprint = JSON.stringify(canonicalize(command));
      const priorByKey = await this.port.receiptByKey(
        command.careerId,
        command.idempotencyKey,
      );
      const priorByCommand = await this.port.receiptByCommandId(
        command.careerId,
        command.commandId,
      );
      for (const prior of [priorByKey, priorByCommand]) {
        if (prior === undefined) continue;
        if (prior.fingerprint !== fingerprint)
          throw new PhaseFiveConflictError(
            'idempotency key or command id was reused with different content',
          );
        return prior.receipt;
      }
      if (current.version !== command.expectedVersion)
        throw new PhaseFiveConflictError(
          `expected version ${String(command.expectedVersion)}, found ${String(current.version)}`,
        );
      const occurredAt = this.clock.now().toISOString();
      const version = current.version + 1;
      const next = this.apply(current, command, occurredAt, version);
      const receipt: PhaseFiveReceipt = {
        version: 1,
        careerId: current.careerId,
        commandId: command.commandId,
        aggregateVersion: version,
        occurredAt,
        outcome: 'applied',
      };
      await this.port.commit({
        state: next,
        expectedVersion: current.version,
        idempotencyKey: command.idempotencyKey,
        record: { fingerprint, receipt },
      });
      return receipt;
    });
  }

  public async pyramid(
    ownerId: string,
    careerId: string,
  ): Promise<CompetitionPyramidReadModel> {
    return clone((await this.owned(ownerId, careerId)).pyramid);
  }

  public async calendar(
    ownerId: string,
    careerId: string,
  ): Promise<CompetitionCalendarReadModel> {
    return clone((await this.owned(ownerId, careerId)).calendar);
  }

  public async transition(
    ownerId: string,
    careerId: string,
  ): Promise<NextSeasonTransitionReadModel> {
    return clone((await this.owned(ownerId, careerId)).nextSeason);
  }

  private apply(
    current: PhaseFiveCompetitionState,
    command: PhaseFiveCommand,
    projectedAt: string,
    aggregateVersion: number,
  ): PhaseFiveCompetitionState {
    if (command.type === 'PublishSeasonCalendar') {
      if (command.payload.season !== current.calendar.season)
        throw new PhaseFiveConflictError(
          'calendar season does not match command',
        );
      if (!current.calendar.validation.valid)
        throw new PhaseFiveConflictError(
          'an invalid calendar cannot be published',
        );
      return {
        ...current,
        version: aggregateVersion,
        pyramid: { ...current.pyramid, aggregateVersion, projectedAt },
        calendar: {
          ...current.calendar,
          aggregateVersion,
          projectedAt,
          status: 'published',
        },
        nextSeason: { ...current.nextSeason, aggregateVersion, projectedAt },
      };
    }
    if (command.payload.completedSeason !== current.nextSeason.completedSeason)
      throw new PhaseFiveConflictError(
        'completed season does not match transition',
      );
    if (current.nextSeason.status !== 'ready')
      throw new PhaseFiveConflictError('next season transition is not ready');
    return {
      ...current,
      version: aggregateVersion,
      pyramid: {
        ...current.pyramid,
        season: current.nextSeason.nextSeason,
        aggregateVersion,
        projectedAt,
      },
      calendar: {
        ...current.calendar,
        season: current.nextSeason.nextSeason,
        status: 'draft',
        entries: [],
        aggregateVersion,
        projectedAt,
        validation: {
          valid: false,
          checkedAt: projectedAt,
          conflictCount: 0,
        },
      },
      nextSeason: {
        ...current.nextSeason,
        status: 'generated',
        aggregateVersion,
        projectedAt,
      },
    };
  }

  private async owned(
    ownerId: string,
    careerId: string,
  ): Promise<PhaseFiveCompetitionState> {
    const state = await this.port.load(careerId);
    if (state === undefined)
      throw new PhaseFiveNotFoundError(`career ${careerId} not found`);
    if (state.ownerId !== ownerId)
      throw new PhaseFiveAuthorizationError('career belongs to another owner');
    return state;
  }
}

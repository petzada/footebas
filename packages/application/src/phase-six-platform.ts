import {
  commandAcceptedSchema,
  commandDeliverySchema,
  connectivityStateSchema,
  outboxEntrySchema,
  type Command,
  type CommandAccepted,
  type CommandDelivery,
  type ConnectivityState,
  type OutboxEntry,
} from '@footebas/contracts';
import type { Clock } from './ports.js';

export interface ConnectivityPort {
  current(): ConnectivityState;
}

export interface CommandOutboxPort {
  put(entry: OutboxEntry): Promise<void>;
  list(): Promise<readonly OutboxEntry[]>;
  remove(idempotencyKey: string): Promise<void>;
}

export interface CommandTransportPort {
  send(bearer: string, command: Command): Promise<CommandAccepted>;
}

export interface MatchPresentationPort {
  play(): Promise<void>;
}

export class ConnectivityTransportError extends Error {
  public constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
  }
}

export class FakeConnectivity implements ConnectivityPort {
  private state: ConnectivityState;

  public constructor(
    status: ConnectivityState['status'],
    private readonly clock: Clock,
  ) {
    this.state = connectivityStateSchema.parse({
      version: 1,
      status,
      changedAt: clock.now().toISOString(),
      reconnectAttempt: 0,
    });
  }

  public current(): ConnectivityState {
    return structuredClone(this.state);
  }

  public set(status: ConnectivityState['status']): void {
    this.state = connectivityStateSchema.parse({
      version: 1,
      status,
      changedAt: this.clock.now().toISOString(),
      reconnectAttempt:
        status === 'reconnecting' ? this.state.reconnectAttempt + 1 : 0,
    });
  }
}

export class InMemoryCommandOutbox implements CommandOutboxPort {
  private readonly entries = new Map<string, OutboxEntry>();

  public put(input: OutboxEntry): Promise<void> {
    const entry = outboxEntrySchema.parse(input);
    const previous = this.entries.get(entry.idempotencyKey);
    if (
      previous !== undefined &&
      JSON.stringify(previous.command) !== JSON.stringify(entry.command)
    )
      return Promise.reject(
        new Error('idempotency key cannot identify different commands'),
      );
    this.entries.set(entry.idempotencyKey, structuredClone(entry));
    return Promise.resolve();
  }

  public list(): Promise<readonly OutboxEntry[]> {
    return Promise.resolve(
      [...this.entries.values()]
        .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
        .map((entry) => structuredClone(entry)),
    );
  }

  public remove(idempotencyKey: string): Promise<void> {
    this.entries.delete(idempotencyKey);
    return Promise.resolve();
  }
}

export class ReconnectCommandDispatcher {
  private flushTail: Promise<readonly CommandDelivery[]> = Promise.resolve([]);

  public constructor(
    private readonly connectivity: ConnectivityPort,
    private readonly outbox: CommandOutboxPort,
    private readonly transport: CommandTransportPort,
    private readonly clock: Clock,
  ) {}

  public async submit(
    bearer: string,
    command: Command,
  ): Promise<CommandDelivery> {
    await this.enqueue(command);
    if (this.connectivity.current().status !== 'online')
      return commandDeliverySchema.parse({
        version: 1,
        state: 'queued',
        idempotencyKey: command.idempotencyKey,
      });
    const deliveries = await this.reconnect(bearer);
    return (
      deliveries.find(
        (delivery) => delivery.idempotencyKey === command.idempotencyKey,
      ) ??
      commandDeliverySchema.parse({
        version: 1,
        state: 'queued',
        idempotencyKey: command.idempotencyKey,
      })
    );
  }

  public reconnect(bearer: string): Promise<readonly CommandDelivery[]> {
    const run = this.flushTail.then(() => this.flush(bearer));
    this.flushTail = run.catch(() => []);
    return run;
  }

  private async enqueue(command: Command): Promise<void> {
    await this.outbox.put({
      version: 1,
      idempotencyKey: command.idempotencyKey,
      command,
      state: 'pending',
      queuedAt: this.clock.now().toISOString(),
      attempts: 0,
    });
  }

  private async flush(bearer: string): Promise<readonly CommandDelivery[]> {
    if (this.connectivity.current().status !== 'online') return [];
    const deliveries: CommandDelivery[] = [];
    for (const entry of await this.outbox.list()) {
      const attempt = outboxEntrySchema.parse({
        ...entry,
        state: 'sending',
        attempts: entry.attempts + 1,
        lastAttemptAt: this.clock.now().toISOString(),
      });
      await this.outbox.put(attempt);
      try {
        const receipt = commandAcceptedSchema.parse(
          await this.transport.send(bearer, entry.command),
        );
        await this.outbox.remove(entry.idempotencyKey);
        deliveries.push(
          commandDeliverySchema.parse({
            version: 1,
            state: 'delivered',
            idempotencyKey: entry.idempotencyKey,
            receipt,
          }),
        );
      } catch (error) {
        await this.outbox.put({ ...attempt, state: 'pending' });
        if (error instanceof ConnectivityTransportError && error.retryable)
          break;
        throw error;
      }
    }
    return deliveries;
  }
}

export class AnimationIndependentCompletion<T> {
  private authoritativeResult?: Promise<T>;

  public constructor(
    private readonly completeAuthoritatively: () => Promise<T>,
    private readonly presentation: MatchPresentationPort,
  ) {}

  public completeNow(): Promise<T> {
    this.authoritativeResult ??= this.completeAuthoritatively();
    return this.authoritativeResult;
  }

  public async presentThenComplete(): Promise<T> {
    const result = await this.completeNow();
    await this.presentation.play();
    return result;
  }
}

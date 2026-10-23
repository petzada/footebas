// Structured JSON logs (Fase 9). One line per HTTP request and per queue job;
// Workers Logs indexes the JSON fields. No personal data: user identity is a
// short hash, there are no IPs, e-mails, tokens or request bodies, and stacks
// of 5xx errors only ever go to the log (the response stays generic).
import type { RequestIdentity } from './request-identity.js';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogEntry = Readonly<Record<string, unknown>> & {
  readonly level: LogLevel;
  readonly type: string;
};
export type LogSink = (entry: LogEntry) => void;

/** Writes one JSON line per entry (console.error for errors so it is flagged). */
export const consoleLogSink: LogSink = (entry) => {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') console.error(line);
  else if (entry.level === 'warn') console.warn(line);
  else console.log(line);
};

export interface RequestCompletion {
  readonly requestId: string;
  readonly method: string;
  /** Route template such as `/v1/careers/:id/home`, `unmatched` or `preflight`. */
  readonly route: string;
  readonly status: number;
  readonly durationMs: number;
  /**
   * Stages of the request, as sent in Server-Timing: milliseconds (`rl`,
   * `app`, `fwd`, the career object's `do-load`…) or a description (`pg`
   * query count, `edge` colo).
   */
  readonly timing?: Readonly<Record<string, number | string>>;
  /** Error behind a 5xx answer, if one was thrown. */
  readonly error?: unknown;
}

export function errorFields(error: unknown): Record<string, string> {
  if (error instanceof Error)
    return {
      errorName: error.name,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
    };
  return { errorName: typeof error };
}

export function requestLogEntry(
  completion: RequestCompletion,
  identity: RequestIdentity,
  version: string,
): LogEntry {
  const level: LogLevel =
    completion.status >= 500
      ? 'error'
      : completion.status === 429
        ? 'warn'
        : 'info';
  return {
    type: 'request',
    level,
    requestId: completion.requestId,
    method: completion.method,
    route: completion.route,
    status: completion.status,
    durationMs: completion.durationMs,
    ...(completion.timing === undefined ? {} : { timing: completion.timing }),
    ...(identity.userHash === undefined ? {} : { userHash: identity.userHash }),
    version,
    ...(completion.error === undefined ? {} : errorFields(completion.error)),
  };
}

export type JobOutcome =
  'succeeded' | 'retry' | 'dead_letter' | 'error' | (string & {});

export interface JobRun {
  readonly jobId: string;
  readonly careerId: string;
  /** Delivery count reported by Cloudflare Queues (1 on the first try). */
  readonly attempts: number;
  readonly durationMs: number;
  readonly result: JobOutcome;
  readonly error?: unknown;
}

export function jobLogEntry(run: JobRun, version: string): LogEntry {
  const failed =
    run.result === 'error' ||
    run.result === 'dead_letter' ||
    run.error !== undefined;
  return {
    type: 'job',
    level: failed ? 'error' : run.result === 'retry' ? 'warn' : 'info',
    jobId: run.jobId,
    careerId: run.careerId,
    attempts: run.attempts,
    durationMs: run.durationMs,
    result: run.result,
    version,
    ...(run.error === undefined ? {} : errorFields(run.error)),
  };
}

/** One line per real-user report (`POST /v1/telemetry/vitals`). */
export function rumLogEntry(
  report: Readonly<{
    page: string;
    connection?: string | undefined;
    metrics: readonly Readonly<Record<string, unknown>>[];
  }>,
  version: string,
): LogEntry {
  return {
    type: 'rum',
    level: 'info',
    page: report.page,
    ...(report.connection === undefined
      ? {}
      : { connection: report.connection }),
    metrics: report.metrics,
    version,
  };
}

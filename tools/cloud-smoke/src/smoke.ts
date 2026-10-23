// End-to-end smoke test over the public HTTP API (same routes and payloads as
// apps/web/lib/http-career-api.ts). Transport shapes are the subset of
// @footebas/contracts this flow reads; the tool has no runtime dependencies so
// it runs straight from a fresh checkout with `tsx`.

export type AuthMode =
  | Readonly<{ kind: 'smoke'; token: string }>
  | Readonly<{ kind: 'dev'; email: string }>;

export interface SmokeOptions {
  readonly apiUrl: string;
  readonly auth: AuthMode;
  /** Club the smoke manager takes over (stable id, e.g. club_flamengo). */
  readonly clubId?: string;
  readonly jobTimeoutMs?: number;
  readonly jobPollMs?: number;
  readonly requestTimeoutMs?: number;
  readonly fetch?: typeof fetch;
  readonly log?: (line: string) => void;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export interface SmokeResult {
  readonly ok: boolean;
  readonly careerId?: string;
  readonly failedStep?: string;
  readonly error?: string;
}

// --- transport shapes (subset of @footebas/contracts) -----------------------
interface Health {
  ok: boolean;
  version: string;
  time: string;
  database: string;
  databaseMs?: number;
}
interface Accepted {
  version: 1;
  commandId: string;
  careerId: string;
  aggregateVersion: number;
  jobId?: string;
}
interface Home {
  careerId: string;
  aggregateVersion: number;
  managerName: string;
  club?: { id: string; name: string };
  currentDate: string;
  season: number;
  nextFixtureId?: string;
  pendingActions: string[];
}
interface Squad {
  aggregateVersion: number;
  club: { id: string; name: string };
  lineup?: { formation: string; starters: string[] };
}
interface NextMatch {
  aggregateVersion: number;
  fixtureId: string;
  competition: string;
  round: number;
  date: string;
  homeClub: { id: string; name: string };
  awayClub: { id: string; name: string };
}
interface PostMatch {
  aggregateVersion: number;
  fixtureId: string;
  homeClub: { name: string };
  awayClub: { name: string };
  score: { home: number; away: number };
}
interface Standings {
  aggregateVersion: number;
  competition: string;
  rows: { position: number; club: { id: string }; played: number }[];
}
interface JobStatus {
  jobId: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempt: number;
  progress: { percent: number; stage: string };
  errorCode?: string;
}
interface CareerList {
  careers: {
    careerId: string;
    aggregateVersion: number;
    clubId?: string;
    currentDate: string;
  }[];
}

export class SmokeFailure extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SmokeFailure';
  }
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new SmokeFailure(message);
}

function runId(now: number): string {
  return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Runs the whole flow; never throws, reports through `log` and the result. */
export async function runSmoke(options: SmokeOptions): Promise<SmokeResult> {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const log = options.log ?? ((line: string) => console.log(line));
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const base = options.apiUrl.replace(/\/+$/, '');
  const clubId = options.clubId ?? 'club_flamengo';
  const jobTimeoutMs = options.jobTimeoutMs ?? 120_000;
  const jobPollMs = options.jobPollMs ?? 1_000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
  const run = runId(now());
  let bearer: string | undefined;
  let careerId: string | undefined;
  let version = 0;
  let sequence = 0;
  let step = 'início';

  async function request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    extra: Record<string, string> = {},
  ): Promise<{ status: number; body: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, requestTimeoutMs);
    try {
      const response = await doFetch(`${base}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let payload: unknown;
      try {
        payload = text === '' ? undefined : JSON.parse(text);
      } catch {
        throw new SmokeFailure(
          `${method} ${path} devolveu ${String(response.status)} sem JSON: ${text.slice(0, 200)}`,
        );
      }
      return { status: response.status, body: payload };
    } catch (error) {
      if (error instanceof SmokeFailure) throw error;
      const reason = controller.signal.aborted
        ? `sem resposta em ${String(requestTimeoutMs)} ms`
        : error instanceof Error
          ? error.message
          : String(error);
      throw new SmokeFailure(`${method} ${path} falhou: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async function ok<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    extra?: Record<string, string>,
  ): Promise<T> {
    const response = await request(method, path, body, extra);
    if (response.status < 200 || response.status >= 300) {
      const error = response.body as
        { code?: string; message?: string; requestId?: string } | undefined;
      throw new SmokeFailure(
        `${method} ${path} → HTTP ${String(response.status)} ${error?.code ?? ''} ${error?.message ?? ''}${error?.requestId ? ` (requestId ${error.requestId})` : ''}`.trim(),
      );
    }
    return response.body as T;
  }

  async function command(
    type: string,
    payload: Record<string, unknown>,
  ): Promise<Accepted> {
    sequence += 1;
    const idempotencyKey = `smoke:${run}:${String(sequence)}:${type}`;
    const accepted = await ok<Accepted>(
      'POST',
      '/v1/commands',
      {
        version: 1,
        commandId: `command_smoke_${run}_${String(sequence)}`,
        idempotencyKey,
        expectedVersion: version,
        type,
        payload,
      },
      { 'idempotency-key': idempotencyKey },
    );
    check(
      accepted.aggregateVersion === version + 1,
      `${type}: versão esperada ${String(version + 1)}, servidor devolveu ${String(accepted.aggregateVersion)}`,
    );
    version = accepted.aggregateVersion;
    return accepted;
  }

  /** Archives a career at its own version (frees the plan's career slot). */
  async function deleteCareer(id: string, at: number): Promise<void> {
    sequence += 1;
    const idempotencyKey = `smoke:${run}:${String(sequence)}:DeleteCareer`;
    await ok<Accepted>(
      'POST',
      '/v1/commands',
      {
        version: 1,
        commandId: `command_smoke_${run}_${String(sequence)}`,
        idempotencyKey,
        expectedVersion: at,
        type: 'DeleteCareer',
        payload: { careerId: id },
      },
      { 'idempotency-key': idempotencyKey },
    );
  }

  async function stage<T>(name: string, body: () => Promise<T>): Promise<T> {
    step = name;
    const started = now();
    const value = await body();
    log(`  [ok] ${name} (${String(now() - started)} ms)`);
    return value;
  }

  const career = () => {
    check(careerId !== undefined, 'nenhuma carreira criada');
    return careerId;
  };

  try {
    log(`Fumaça do Footebas em ${base} (execução ${run})`);

    await stage('health', async () => {
      const response = await request('GET', '/health');
      const deep = {
        status: response.status,
        body: (response.body ?? {}) as Partial<Health>,
      };
      check(
        deep.status === 200 && deep.body.ok === true,
        `GET /health → HTTP ${String(deep.status)}, banco: ${deep.body.database ?? '?'}`,
      );
      check(
        deep.body.database === 'ok' || deep.body.database === 'in_memory',
        `banco em estado inesperado: ${deep.body.database ?? '?'}`,
      );
      const shallow = await ok<Health>('GET', '/health?deep=0');
      check(shallow.database === 'skipped', 'deep=0 consultou o banco');
      log(
        `       versão ${deep.body.version ?? '?'}, banco ${deep.body.database}${deep.body.databaseMs === undefined ? '' : ` em ${String(deep.body.databaseMs)} ms`}`,
      );
    });

    await stage('autenticação', async () => {
      if (options.auth.kind === 'smoke') {
        bearer = `smoke:${options.auth.token}`;
      } else {
        const session = await ok<{ bearer: string }>(
          'POST',
          '/v1/dev/session',
          { email: options.auth.email, displayName: 'Fumaça' },
        );
        bearer = session.bearer;
      }
      // Proves the bearer before mutating anything.
      await ok<CareerList>('GET', '/v1/careers');
    });

    // The free plan allows one active career: archive leftovers first.
    const before = await stage('limpar carreiras anteriores', async () => {
      const listed = await ok<CareerList>('GET', '/v1/careers');
      for (const old of listed.careers)
        await deleteCareer(old.careerId, old.aggregateVersion);
      if (listed.careers.length > 0)
        log(`       ${String(listed.careers.length)} carreira(s) arquivada(s)`);
      return ok<CareerList>('GET', '/v1/careers');
    });

    await stage('criar carreira', async () => {
      const accepted = await command('CreateCareer', {
        managerName: 'Fumaça',
        startDate: '2026-01-01',
      });
      careerId = accepted.careerId;
      log(`       carreira ${accepted.careerId}`);
    });

    await stage(`escolher clube (${clubId})`, async () => {
      await command('SelectClub', { careerId: career(), clubId });
      const home = await ok<Home>('GET', `/v1/careers/${career()}/home`);
      check(home.club?.id === clubId, 'a carreira não ficou com o clube');
      check(
        home.aggregateVersion === version,
        `home na versão ${String(home.aggregateVersion)}, esperada ${String(version)}`,
      );
    });

    const fixture = await stage('escalar time', async () => {
      const squad = await ok<Squad>('GET', `/v1/careers/${career()}/squad`);
      await command('AutoPickLineup', {
        careerId: career(),
        clubId: squad.club.id,
        formation: squad.lineup?.formation ?? '4-4-2',
        mode: 'best',
      });
      const picked = await ok<Squad>('GET', `/v1/careers/${career()}/squad`);
      check(
        picked.lineup?.starters.length === 11,
        'escalação sem 11 titulares',
      );
      const next = await ok<NextMatch>(
        'GET',
        `/v1/careers/${career()}/next-match`,
      );
      log(
        `       ${next.competition}, rodada ${String(next.round)} em ${next.date}: ${next.homeClub.name} x ${next.awayClub.name}`,
      );
      return next;
    });

    const jobId = await stage('avançar rodada (enfileirar)', async () => {
      const accepted = await command('SimulateMatch', {
        careerId: career(),
        fixtureId: fixture.fixtureId,
      });
      check(accepted.jobId !== undefined, 'SimulateMatch não devolveu jobId');
      log(`       job ${accepted.jobId}`);
      return accepted.jobId;
    });

    await stage('aguardar job', async () => {
      const deadline = now() + jobTimeoutMs;
      let last = '';
      for (;;) {
        const status = await ok<JobStatus>('GET', `/v1/jobs/${jobId}`);
        const line = `${status.state} ${String(Math.round(status.progress.percent))}% ${status.progress.stage} (tentativa ${String(status.attempt)})`;
        if (line !== last) log(`       ${line}`);
        last = line;
        if (status.state === 'succeeded') return;
        check(
          status.state !== 'failed' && status.state !== 'cancelled',
          `job ${status.state}: ${status.errorCode ?? 'sem código'} na tentativa ${String(status.attempt)}`,
        );
        check(
          now() < deadline,
          `job não terminou em ${String(jobTimeoutMs / 1000)} s (último estado: ${status.state})`,
        );
        await sleep(jobPollMs);
      }
    });

    await stage('recarregar carreira', async () => {
      const id = career();
      const home = await ok<Home>('GET', `/v1/careers/${id}/home`);
      check(
        !home.pendingActions.includes('simulation_pending'),
        'a carreira ainda tem simulação pendente',
      );
      // The job persists the result as exactly one more save version.
      check(
        home.aggregateVersion === version + 1,
        `versão após o job: ${String(home.aggregateVersion)}, esperada ${String(version + 1)}`,
      );
      version = home.aggregateVersion;
      check(
        home.currentDate >= fixture.date,
        `data ${home.currentDate} não chegou ao jogo de ${fixture.date}`,
      );
      const [post, standings, squad] = await Promise.all([
        ok<PostMatch>('GET', `/v1/careers/${id}/post-match`),
        ok<Standings>('GET', `/v1/careers/${id}/standings`),
        ok<Squad>('GET', `/v1/careers/${id}/squad`),
      ]);
      check(
        post.fixtureId === fixture.fixtureId,
        `pós-jogo é de ${post.fixtureId}, esperado ${fixture.fixtureId}`,
      );
      const row = standings.rows.find(({ club }) => club.id === clubId);
      check(row !== undefined, 'clube ausente da classificação');
      // The first fixture may belong to a cup or state league; the league
      // table only has to count it when it was a league match.
      if (standings.competition === fixture.competition)
        check(row.played >= 1, 'a classificação não registrou o jogo');
      for (const [name, read] of [
        ['pós-jogo', post.aggregateVersion],
        ['classificação', standings.aggregateVersion],
        ['elenco', squad.aggregateVersion],
      ] as const)
        check(
          read === version,
          `${name} na versão ${String(read)}, home na ${String(version)}`,
        );
      const next = await request('GET', `/v1/careers/${id}/next-match`);
      if (next.status === 200) {
        const upcoming = next.body as NextMatch;
        check(
          upcoming.fixtureId !== fixture.fixtureId &&
            upcoming.date >= fixture.date,
          'o próximo jogo não avançou',
        );
      }
      log(
        `       ${post.homeClub.name} ${String(post.score.home)} x ${String(post.score.away)} ${post.awayClub.name}; ${standings.competition}: ${String(row.position)}º com ${String(row.played)} jogo(s); versão ${String(version)}`,
      );
    });

    await stage('listar carreiras', async () => {
      const after = await ok<CareerList>('GET', '/v1/careers');
      const listed = after.careers.find(({ careerId: id }) => id === careerId);
      check(listed !== undefined, 'a carreira nova não aparece na lista');
      check(
        listed.aggregateVersion === version && listed.clubId === clubId,
        `lista com versão ${String(listed.aggregateVersion)} / clube ${listed.clubId ?? '-'}`,
      );
      check(
        after.careers.length === before.careers.length + 1,
        `lista tinha ${String(before.careers.length)} carreira(s) e agora tem ${String(after.careers.length)}`,
      );
      log(`       ${String(after.careers.length)} carreira(s) do usuário`);
    });

    await stage('excluir carreira', async () => {
      await deleteCareer(career(), version);
      const after = await ok<CareerList>('GET', '/v1/careers');
      check(
        !after.careers.some(({ careerId: id }) => id === careerId),
        'a carreira excluída continua na lista',
      );
    });

    log(`Fumaça OK: carreira ${career()} na versão ${String(version)}.`);
    return { ok: true, careerId: career() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`  [falha] ${step}: ${message}`);
    log('Fumaça FALHOU.');
    return {
      ok: false,
      failedStep: step,
      error: message,
      ...(careerId === undefined ? {} : { careerId }),
    };
  }
}

import { describe, expect, it } from 'vitest';
import { runSmoke } from './smoke.js';

const token = 'x'.repeat(48);
const club = { id: 'club_flamengo', name: 'Flamengo', shortName: 'FLA' };
const rival = { id: 'club_vasco', name: 'Vasco', shortName: 'VAS' };

/** Minimal stateful stand-in for the API, enough for the smoke flow. */
function fakeApi(
  options: {
    health?: number;
    job?: 'succeeded' | 'failed' | 'stuck';
    authorized?: string;
  } = {},
) {
  let version = 0;
  let played = false;
  let polls = 0;
  const careers: { careerId: string; aggregateVersion: number }[] = [];
  const reply = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  const fake: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers);
    const path = url.pathname;
    if (path === '/health')
      return reply(options.health ?? 200, {
        ok: (options.health ?? 200) === 200,
        version: 'v1',
        time: '2026-10-22T12:00:00.000Z',
        database: url.searchParams.get('deep') === '0' ? 'skipped' : 'ok',
      });
    if (
      headers.get('authorization') !==
      `Bearer ${options.authorized ?? `smoke:${token}`}`
    )
      return reply(401, { code: 'UNAUTHORIZED', message: 'nope' });
    const versioned = { careerId: 'career_one', aggregateVersion: version };
    if (path === '/v1/careers')
      return reply(200, {
        version: 1,
        careers: careers.map((item) => ({
          ...item,
          aggregateVersion: version,
          clubId: club.id,
          currentDate: '2026-01-01',
        })),
      });
    if (path === '/v1/commands') {
      const body = JSON.parse(init?.body as string) as {
        type: string;
        expectedVersion: number;
      };
      if (body.expectedVersion !== version)
        return reply(409, { code: 'VERSION_CONFLICT', message: 'stale' });
      version += 1;
      if (body.type === 'CreateCareer')
        careers.push({ careerId: 'career_one', aggregateVersion: version });
      return reply(202, {
        version: 1,
        commandId: 'command_x',
        careerId: 'career_one',
        aggregateVersion: version,
        ...(body.type === 'SimulateMatch' ? { jobId: 'job_one' } : {}),
      });
    }
    if (path === '/v1/jobs/job_one') {
      polls += 1;
      const state =
        options.job === 'stuck'
          ? 'running'
          : polls < 2
            ? 'queued'
            : (options.job ?? 'succeeded');
      if (state === 'succeeded' && !played) {
        played = true;
        version += 1;
      }
      return reply(200, {
        jobId: 'job_one',
        state,
        attempt: 1,
        progress: { percent: state === 'succeeded' ? 100 : 0, stage: state },
        ...(state === 'failed' ? { errorCode: 'BOOM' } : {}),
      });
    }
    const view = path.split('/').at(-1);
    if (view === 'home')
      return reply(200, {
        ...versioned,
        managerName: 'Fumaça',
        club,
        currentDate: played ? '2026-01-20' : '2026-01-01',
        season: 2026,
        pendingActions: [],
      });
    if (view === 'squad')
      return reply(200, {
        ...versioned,
        club,
        lineup: { formation: '4-4-2', starters: Array(11).fill('player_a') },
      });
    if (view === 'next-match')
      return reply(200, {
        ...versioned,
        fixtureId: played ? 'fixture_two' : 'fixture_one',
        competition: 'Série A',
        round: played ? 2 : 1,
        date: played ? '2026-01-27' : '2026-01-20',
        homeClub: club,
        awayClub: rival,
      });
    if (view === 'post-match')
      return reply(200, {
        ...versioned,
        fixtureId: 'fixture_one',
        homeClub: club,
        awayClub: rival,
        score: { home: 2, away: 1 },
      });
    if (view === 'standings')
      return reply(200, {
        ...versioned,
        competition: 'Série A',
        rows: [{ position: 1, club, played: 1 }],
      });
    return reply(404, { code: 'NOT_FOUND', message: path });
  };
  return fake;
}

function run(api: typeof fetch, extra: { jobTimeoutMs?: number } = {}) {
  const lines: string[] = [];
  let clock = 0;
  return runSmoke({
    apiUrl: 'https://api.example.test/',
    auth: { kind: 'smoke', token },
    fetch: api,
    log: (line) => lines.push(line),
    sleep: (ms) => {
      clock += ms;
      return Promise.resolve();
    },
    now: () => clock,
    ...extra,
  }).then((result) => ({ result, lines }));
}

describe('fumaça na nuvem', () => {
  it('percorre o fluxo inteiro e confere versões', async () => {
    const { result, lines } = await run(fakeApi());
    expect(result).toEqual({ ok: true, careerId: 'career_one' });
    expect(lines.at(-1)).toContain('Fumaça OK');
    expect(lines.join('\n')).toContain('Flamengo 2 x 1 Vasco');
  });

  it('falha no health quando o banco não responde', async () => {
    const { result } = await run(fakeApi({ health: 503 }));
    expect(result).toMatchObject({ ok: false, failedStep: 'health' });
  });

  it('falha na autenticação com token recusado', async () => {
    const { result } = await run(fakeApi({ authorized: 'smoke:outro' }));
    expect(result).toMatchObject({ ok: false, failedStep: 'autenticação' });
    expect(result.error).toContain('401');
  });

  it('falha quando o job falha ou estoura o tempo', async () => {
    const failed = await run(fakeApi({ job: 'failed' }));
    expect(failed.result).toMatchObject({
      ok: false,
      failedStep: 'aguardar job',
      careerId: 'career_one',
    });
    expect(failed.result.error).toContain('BOOM');
    const stuck = await run(fakeApi({ job: 'stuck' }), { jobTimeoutMs: 5_000 });
    expect(stuck.result.error).toMatch(/não terminou em 5 s/);
  });
});

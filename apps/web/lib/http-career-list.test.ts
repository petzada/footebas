// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { isCareerLimitError } from '@/lib/career-api';
import { HttpCareerApi, PUBLIC_STATS_TTL_MS } from '@/lib/http-career-api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function client(fetchMock: typeof fetch, now = () => 0) {
  return new HttpCareerApi({
    baseUrl: 'http://api.test',
    fetch: fetchMock,
    getAccessToken: async () => 'token',
    now,
  });
}

describe('HttpCareerApi · contadores públicos', () => {
  it('lê GET /v1/public/stats e guarda por 5 minutos', async () => {
    let clock = 1_000;
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json({ coaches: 12, clubs: 98, athletes: 2400 }),
    );
    const api = client(fetchMock, () => clock);
    expect(await api.getPublicStats()).toEqual({
      coaches: 12,
      clubs: 98,
      athletes: 2400,
    });
    clock += PUBLIC_STATS_TTL_MS - 1;
    await api.getPublicStats();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'http://api.test/v1/public/stats',
    );
    clock += 2;
    await api.getPublicStats();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('devolve null sem erro quando a rota não existe, falha ou responde lixo', async () => {
    for (const response of [
      async () => json({ code: 'NOT_FOUND' }, 404),
      async () => {
        throw new TypeError('offline');
      },
      async () => json({ coaches: 'muitos' }),
    ]) {
      const api = client(vi.fn<typeof fetch>(response));
      await expect(api.getPublicStats()).resolves.toBeNull();
    }
  });
});

describe('HttpCareerApi · carreiras do usuário', () => {
  const list = {
    version: 1,
    limits: {
      plan: 'licensed',
      maxCareers: 5,
      anyClub: true,
      activeCareers: 2,
    },
    careers: [
      {
        careerId: 'career_a',
        aggregateVersion: 7,
        managerName: 'Ana',
        clubId: 'club_flamengo',
        clubName: 'Flamengo',
        season: 2026,
        currentDate: '2026-04-12',
        careerName: 'Rumo ao tri',
        coach: {
          nationality: 'PT',
          avatar: 'avatar-07',
          personality: 'diplomata',
        },
        updatedAt: '2026-10-20T15:00:00.000Z',
      },
      {
        careerId: 'career_b',
        aggregateVersion: 2,
        managerName: 'Ana',
        season: 2026,
        currentDate: '2026-01-01',
      },
    ],
  };

  it('lista, abre carreira sem clube e exclui com o envelope de comando', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/careers')) return json(list);
      if (url.endsWith('/v1/commands')) {
        bodies.push(JSON.parse(String(init?.body)));
        expect(new Headers(init?.headers).get('idempotency-key')).toBe(
          bodies.at(-1)!.idempotencyKey,
        );
        return json({ aggregateVersion: 8 }, 202);
      }
      return json({ code: 'NOT_FOUND' }, 404);
    });
    const api = client(fetchMock);
    const result = await api.listCareers();
    expect(result.limit).toBe(5);
    expect(result.careers).toEqual([
      {
        id: 'career_a',
        coach: 'Ana',
        name: 'Rumo ao tri',
        coachProfile: {
          nationality: 'PT',
          avatar: 'avatar-07',
          personality: 'diplomata',
        },
        clubName: 'Flamengo',
        season: 2026,
        currentDate: '2026-04-12',
        updatedAt: '2026-10-20T15:00:00.000Z',
      },
      { id: 'career_b', coach: 'Ana', season: 2026, currentDate: '2026-01-01' },
    ]);
    await expect(api.openCareer('career_b')).resolves.toBeNull();

    await api.deleteCareer('career_a');
    expect(bodies[0]).toEqual(
      expect.objectContaining({
        version: 1,
        type: 'DeleteCareer',
        expectedVersion: 7,
        payload: { careerId: 'career_a' },
      }),
    );
    expect(String(bodies[0]!.commandId)).toMatch(/^command_/);
  });

  it('envia CreateCareer com careerName e o perfil do treinador', async () => {
    const bodies: Record<string, unknown>[] = [];
    const api = client(
      vi.fn<typeof fetch>(async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return json({ careerId: 'career_new', aggregateVersion: 1 }, 202);
      }),
    );
    await api.createCareer({
      coach: '  Ana  ',
      careerName: ' Rumo ao tri ',
      coachProfile: {
        nationality: 'AR',
        avatar: 'avatar-12',
        personality: 'motivador',
      },
    });
    expect(bodies[0]).toEqual(
      expect.objectContaining({
        type: 'CreateCareer',
        expectedVersion: 0,
        payload: {
          managerName: 'Ana',
          startDate: '2026-01-01',
          careerName: 'Rumo ao tri',
          coach: {
            nationality: 'AR',
            avatar: 'avatar-12',
            personality: 'motivador',
          },
        },
      }),
    );
    await api.createCareer({ coach: 'Bia' });
    expect(bodies[1]!.payload).toEqual({
      managerName: 'Bia',
      startDate: '2026-01-01',
    });
  });

  it('propaga CAREER_LIMIT_REACHED com a mensagem do servidor', async () => {
    const api = client(
      vi.fn<typeof fetch>(async () =>
        json(
          {
            code: 'CAREER_LIMIT_REACHED',
            message: 'Seu plano permite 1 carreira.',
          },
          409,
        ),
      ),
    );
    const error = await api
      .createCareer({ coach: 'Ana' })
      .catch((caught: unknown) => caught);
    expect(isCareerLimitError(error)).toBe(true);
    expect((error as Error).message).toBe('Seu plano permite 1 carreira.');
  });
});

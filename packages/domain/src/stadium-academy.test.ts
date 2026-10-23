/* eslint-disable @typescript-eslint/no-non-null-assertion -- plans and intakes picked here always exist */
import { describe, expect, it } from 'vitest';
import {
  ACADEMY_MAX_AGE,
  STADIUM_MAX_CAPACITY,
  ageAcademyProspect,
  calculateAttendance,
  clubFanBase,
  createPlayer,
  createStadium,
  crowdDemand,
  generateAcademyIntake,
  jobMarketOffers,
  maintainStadium,
  money,
  stadiumExpansionPlans,
  stadiumMaintenancePlans,
  strength,
  trainAcademyProspect,
  wearStadium,
  type ClubId,
  type ManagerCareer,
  type RandomSource,
} from './index.js';

const clubId = (value: string) => value as ClubId;

class Lcg implements RandomSource {
  private state: number;
  public constructor(seed: number) {
    this.state = seed;
  }
  public next(): number {
    this.state = (this.state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return this.state / 4_294_967_296;
  }
}

const stadium = (
  overrides: Partial<Parameters<typeof createStadium>[0]> = {},
) =>
  createStadium({
    clubId: clubId('club_a'),
    capacity: 20_000,
    ticketPrice: money(5_000),
    maintenance: money(100),
    quality: 60,
    ...overrides,
  });

const crowd = {
  capacity: 20_000,
  ticketPrice: money(5_000),
  referencePrice: money(5_000),
  homeReputation: 55,
  awayReputation: 50,
  importance: 55,
  recentForm: 0,
};

describe('público do estádio', () => {
  it('cai com o preço, mas um clube grande enche mais com o mesmo preço relativo', () => {
    const cheap = crowdDemand({ ...crowd, ticketPrice: money(2_000) });
    const fair = crowdDemand(crowd);
    const expensive = crowdDemand({ ...crowd, ticketPrice: money(12_000) });
    expect(cheap).toBeGreaterThan(fair);
    expect(fair).toBeGreaterThan(expensive);
    const big = crowdDemand({
      ...crowd,
      homeReputation: 80,
      ticketPrice: money(6_800),
      referencePrice: money(6_800),
    });
    expect(clubFanBase(80)).toBeGreaterThan(clubFanBase(55));
    expect(big).toBeGreaterThan(fair * 2);
  });

  it('forma, torcida e estrutura somam apelo; a capacidade limita o público', () => {
    const neutral = crowdDemand(crowd);
    expect(crowdDemand({ ...crowd, recentForm: 15 })).toBeGreaterThan(neutral);
    expect(crowdDemand({ ...crowd, fanMood: 90 })).toBeGreaterThan(neutral);
    expect(crowdDemand({ ...crowd, stadiumQuality: 20 })).toBeLessThan(neutral);
    expect(
      calculateAttendance({ ...crowd, homeReputation: 85, capacity: 5_000 }),
    ).toBe(5_000);
  });
});

describe('obras e manutenção do estádio', () => {
  it('ampliação tem preço do servidor, respeita a capacidade máxima e não empilha obra', () => {
    const plans = stadiumExpansionPlans(stadium());
    expect(plans.map(({ id }) => id)).toEqual(['small', 'medium', 'large']);
    expect(plans[0]).toMatchObject({ addedCapacity: 2_000, days: 90 });
    expect(Number(plans[0]!.cost)).toBe(2_000 * 150_000);
    const nearlyFull = stadiumExpansionPlans(
      stadium({ capacity: STADIUM_MAX_CAPACITY - 3_000 }),
    );
    expect(nearlyFull.map(({ addedCapacity }) => addedCapacity)).toEqual([
      2_000, 3_000, 3_000,
    ]);
    expect(
      stadiumExpansionPlans(
        stadium({
          expansion: {
            projectId: 'p1',
            addedCapacity: 2_000,
            cost: money(1),
            completesOn: '2026-06-01',
          },
        }),
      ),
    ).toEqual([]);
  });

  it('manutenção recupera qualidade, cobra proporcional perto de 100 e o uso desgasta', () => {
    const plans = stadiumMaintenancePlans(stadium({ quality: 95 }));
    expect(plans.every(({ qualityGain }) => qualityGain === 5)).toBe(true);
    const repairs = plans.find(({ id }) => id === 'repairs')!;
    expect(Number(repairs.cost)).toBe(Math.round((20_000 * 1_500 * 5) / 10));
    expect(stadiumMaintenancePlans(stadium({ quality: 100 }))).toEqual([]);
    const restored = maintainStadium(
      stadium({ quality: 40 }),
      25,
      '2026-03-01',
    );
    expect(restored).toMatchObject({
      quality: 65,
      lastMaintenanceOn: '2026-03-01',
    });
    expect(wearStadium(stadium({ quality: 1 }), 3).quality).toBe(0);
  });
});

describe('peneira da base', () => {
  const intake = (seed: number) =>
    generateAcademyIntake({
      clubId: clubId('club_a'),
      reputation: 60,
      count: 5,
      joinedOn: '2026-02-01',
      seed: `seed-${String(seed)}`,
      generatorVersion: 'test',
      nextId: (() => {
        let id = 0;
        return (kind: string) => `${kind}_${String(++id)}`;
      })(),
      random: new Lcg(seed),
    });

  it('gera garotos de 16 a 18 anos com nome, características e um destaque', () => {
    const kids = intake(7);
    expect(kids).toHaveLength(5);
    expect(kids[0]?.highlight).toBe(true);
    for (const kid of kids) {
      expect(kid.player.age).toBeGreaterThanOrEqual(16);
      expect(kid.player.age).toBeLessThanOrEqual(18);
      expect(kid.player.name).not.toContain('gerado');
      expect(kid.player.traits.length).toBeGreaterThanOrEqual(1);
      expect(kid.initialStrength).toBe(Number(kid.player.strength));
      expect(kid.status).toBe('academy');
    }
    const star = kids[0]!;
    expect(Number(star.player.hidden.potential)).toBeGreaterThanOrEqual(
      Math.min(95, 78),
    );
    expect(star.estimate).not.toBe('limited');
    expect(JSON.stringify(intake(7))).toBe(JSON.stringify(kids));
  });

  it('treino mensal só sobe até o potencial e a idade passa na virada', () => {
    const kid = intake(3)[1]!;
    const trained = trainAcademyProspect(kid, 0, 60);
    expect(Number(trained.player.strength)).toBe(
      Number(kid.player.strength) + 1,
    );
    expect(trainAcademyProspect(kid, 0.99, 60)).toBe(kid);
    const capped = {
      ...kid,
      player: createPlayer({
        ...kid.player,
        strength: strength(Number(kid.player.hidden.potential)),
      }),
    };
    expect(trainAcademyProspect(capped, 0, 100)).toBe(capped);
    expect(ageAcademyProspect(kid).player.age).toBe(kid.player.age + 1);
    expect(ACADEMY_MAX_AGE).toBe(20);
  });
});

describe('mercado de treinadores', () => {
  const career: ManagerCareer = {
    managerId: 'manager_1',
    currentClubId: clubId('club_mid'),
    employmentStatus: 'employed',
    boardConfidence: 60,
    fanConfidence: 55,
    prestige: 5,
    seasons: 1,
    appointments: [{ clubId: clubId('club_mid'), joinedOn: '2026-01-01' }],
  };
  const clubs = [40, 48, 52, 56, 60, 64, 68, 72, 80].map((reputation) => ({
    clubId: clubId(`club_${String(reputation)}`),
    reputation,
    interested: true,
  }));
  const { currentClubId: _current, ...rest } = career;
  void _current;
  const unemployed: ManagerCareer = { ...rest, employmentStatus: 'available' };
  let sequence = 0;
  const offers = (performance: number, employed = true) =>
    jobMarketOffers({
      career: employed ? career : unemployed,
      ...(employed ? { currentReputation: 56 } : { lastReputation: 56 }),
      performance,
      clubs,
      onDate: '2026-06-01',
      maxOffers: 3,
      nextId: () => `proposal_${String(++sequence)}`,
    });

  it('bom trabalho atrai clubes maiores; fase ruim, só menores', () => {
    const good = offers(0.8);
    expect(good.length).toBeGreaterThan(0);
    expect(good.every(({ clubId: id }) => Number(id.split('_')[1]) > 56)).toBe(
      true,
    );
    expect(good[0]?.reason).toBe('step_up');
    const bad = offers(-0.8);
    expect(bad.every(({ clubId: id }) => Number(id.split('_')[1]) < 56)).toBe(
      true,
    );
    expect(bad[0]?.reason).toBe('step_down');
    expect(good[0]).toMatchObject({
      status: 'open',
      offeredOn: '2026-06-01',
      expiresOn: '2026-06-22',
      minimumPrestige: 5,
    });
  });

  it('treinador desempregado sempre recebe proposta, mesmo sem vaga anunciada', () => {
    const quiet = clubs.map((club) => ({ ...club, interested: false }));
    const result = jobMarketOffers({
      career: unemployed,
      lastReputation: 56,
      performance: -1,
      clubs: quiet,
      onDate: '2027-01-01',
      maxOffers: 3,
      nextId: () => `proposal_${String(++sequence)}`,
    });
    expect(result).toHaveLength(3);
    expect(result.every(({ reason }) => reason === 'reemployment')).toBe(true);
    expect(offers(0, false).length).toBeGreaterThan(0);
  });
});

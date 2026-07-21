import { describe, expect, it } from 'vitest';
import {
  createClub,
  createLedger,
  createPlayer,
  createStadium,
  createTransferOffer,
  entityId,
  money,
  percentage,
  strength,
  type ClubId,
  type Player,
  type PlayerId,
} from '@footebas/domain';
import {
  FakeClock,
  InMemoryArchiveStorage,
  InMemoryPhaseFourRepository,
  Mulberry32RandomFactory,
  PhaseFourApplicationService,
  PhaseFourAuthorizationError,
  SequentialIdGenerator,
  type PhaseFourState,
} from './index.js';

const clubId = (value: string): ClubId => entityId(`club_${value}`, 'club');
const playerId = (value: string): PlayerId =>
  entityId(`player_${value}`, 'player');

function player(
  id: PlayerId,
  clubIdValue: ClubId,
  position: Player['position'] = 'ST',
): Player {
  return createPlayer({
    id,
    name: `Atleta ${id}`,
    age: 24,
    position,
    secondaryPositions: [],
    strength: strength(70),
    traits: [],
    hidden: {
      potential: percentage(82),
      consistency: percentage(70),
      injuryProneness: percentage(10),
      adaptation: percentage(65),
      professionalism: percentage(85),
      bigGame: percentage(75),
    },
    morale: percentage(70),
    condition: percentage(100),
    matchSharpness: percentage(80),
    value: money(1_000_000),
    salary: money(20_000),
    clubId: clubIdValue,
    squadStatus: 'starter',
    injuryRounds: 0,
    suspensionRounds: 0,
    careerStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
  });
}

function state(overrides: Partial<PhaseFourState> = {}): PhaseFourState {
  const a = clubId('a');
  const b = clubId('b');
  const athlete = player(playerId('one'), a);
  return {
    careerId: 'career_1',
    userId: 'user_1',
    version: 0,
    schemaVersion: '3',
    currentDate: '2026-07-21',
    season: 2026,
    manager: {
      managerId: 'manager_1',
      currentClubId: a,
      employmentStatus: 'employed',
      boardConfidence: 55,
      fanConfidence: 60,
      prestige: 90,
      seasons: 5,
      appointments: [{ clubId: a, joinedOn: '2021-01-01' }],
    },
    clubs: [
      createClub({
        id: a,
        name: 'Clube A',
        shortName: 'A',
        squad: [athlete.id],
        balance: money(5_000_000),
        reputation: percentage(60),
      }),
      createClub({
        id: b,
        name: 'Clube B',
        shortName: 'B',
        squad: [],
        balance: money(5_000_000),
        reputation: percentage(60),
      }),
    ],
    players: [athlete],
    contracts: [
      {
        id: 'contract_1',
        playerId: athlete.id,
        clubId: a,
        startsOn: '2026-01-01',
        endsOn: '2026-12-31',
        wage: money(20_000),
        status: 'active',
        terminationCost: money(50_000),
        revision: 1,
      },
    ],
    offers: [],
    loans: [],
    ledger: createLedger(),
    stadiums: [
      createStadium({
        clubId: a,
        capacity: 10_000,
        ticketPrice: money(3_000),
        maintenance: money(50_000),
        quality: 60,
      }),
    ],
    youth: [],
    objectives: [],
    jobProposals: [],
    history: [
      {
        id: 'history_1',
        type: 'title',
        season: 2022,
        occurredOn: '2022-12-01',
        clubId: a,
        competitionId: 'league_1',
      },
      {
        id: 'history_2',
        type: 'title',
        season: 2026,
        occurredOn: '2026-12-01',
        clubId: a,
        competitionId: 'league_1',
      },
    ],
    achievements: [],
    events: [],
    archiveKeys: [],
    ...overrides,
  };
}

function setup(initial = state()) {
  const repository = new InMemoryPhaseFourRepository([initial]);
  const archives = new InMemoryArchiveStorage();
  const service = new PhaseFourApplicationService({
    repository,
    archives,
    clock: new FakeClock(new Date('2026-07-21T12:00:00.000Z')),
    ids: new SequentialIdGenerator(),
    random: new Mulberry32RandomFactory(),
  });
  return { service, repository, archives };
}

const envelope = {
  version: 1 as const,
  careerId: 'career_1',
  expectedVersion: 0,
};

describe('phase four authoritative application service', () => {
  it('migrates explicitly, returns the exact idempotent receipt and archives compacted history', async () => {
    const { service, repository, archives } = setup();
    const migration = {
      ...envelope,
      type: 'MigrateSave' as const,
      commandId: 'command_migrate',
      idempotencyKey: 'phase4:migrate:1',
      payload: { targetSchemaVersion: '4' },
    };
    const first = await service.execute('user_1', migration);
    const retry = await service.execute('user_1', migration);
    expect(retry).toEqual(first);
    expect(first.aggregateVersion).toBe(1);
    const compacted = await service.execute('user_1', {
      ...envelope,
      expectedVersion: 1,
      type: 'CompactHistory',
      commandId: 'command_compact',
      idempotencyKey: 'phase4:compact:1',
      payload: { retainFromSeason: 2025 },
    });
    expect(compacted.aggregateVersion).toBe(2);
    const saved = await repository.load('career_1');
    expect(saved?.schemaVersion).toBe('4');
    expect(saved?.history.map(({ season }) => season)).toEqual([2026]);
    const key = saved?.archiveKeys[0];
    expect(key).toBeDefined();
    if (key === undefined) throw new Error('expected archive key');
    const archive = await archives.get(key);
    if (archive === undefined) throw new Error('expected archived history');
    expect(JSON.parse(new TextDecoder().decode(archive))).toHaveLength(1);
  });

  it('terminates a contract atomically, balances the ledger and exposes the player as a free agent', async () => {
    const { service, repository } = setup();
    const receipt = await service.execute('user_1', {
      ...envelope,
      type: 'TerminatePlayerContract',
      commandId: 'command_terminate',
      idempotencyKey: 'phase4:terminate:1',
      payload: { contractId: 'contract_1' },
    });
    expect(receipt.outcome).toBe('applied');
    const saved = await repository.load('career_1');
    expect(saved?.contracts[0]?.status).toBe('terminated');
    expect(saved?.players[0]?.clubId).toBeUndefined();
    expect(
      saved?.ledger.entries[0]?.postings.reduce(
        (sum, posting) => sum + posting.amount,
        0,
      ),
    ).toBe(0);
    expect(
      (await service.readModel('user_1', 'career_1')).freeAgentIds,
    ).toEqual([playerId('one')]);
  });

  it('completes an incoming accepted transfer without duplicating ownership or money', async () => {
    const base = state();
    const offer = createTransferOffer({
      id: 'offer_1',
      kind: 'buy',
      playerId: playerId('one'),
      fromClubId: clubId('a'),
      toClubId: clubId('b'),
      fee: money(1_000_000),
      wage: money(25_000),
      createdOn: '2026-07-20',
      expiresOn: '2026-07-30',
      status: 'pending',
      revision: 1,
    });
    const { service, repository } = setup({ ...base, offers: [offer] });
    await service.execute('user_1', {
      ...envelope,
      type: 'DecideTransferOffer',
      commandId: 'command_accept',
      idempotencyKey: 'phase4:accept:1',
      payload: { offerId: 'offer_1', decision: 'accept' },
    });
    const saved = await repository.load('career_1');
    expect(saved?.players[0]?.clubId).toBe(clubId('b'));
    expect(
      saved?.clubs.find(({ id }) => id === clubId('a'))?.squad,
    ).not.toContain(playerId('one'));
    expect(saved?.clubs.find(({ id }) => id === clubId('b'))?.squad).toEqual([
      playerId('one'),
    ]);
    expect(
      saved?.ledger.entries[0]?.postings.reduce(
        (sum, posting) => sum + posting.amount,
        0,
      ),
    ).toBe(0);
  });

  it('preserves the manager career on club switch and rejects foreign career mutation', async () => {
    const initial = state({
      jobProposals: [
        {
          id: 'proposal_1',
          clubId: clubId('b'),
          offeredOn: '2026-07-01',
          expiresOn: '2026-08-01',
          minimumPrestige: 80,
          status: 'open',
        },
      ],
    });
    const { service, repository } = setup(initial);
    await expect(
      service.execute('intruder', {
        ...envelope,
        type: 'AcceptJobProposal',
        commandId: 'command_intruder',
        idempotencyKey: 'phase4:intruder:1',
        payload: { proposalId: 'proposal_1' },
      }),
    ).rejects.toBeInstanceOf(PhaseFourAuthorizationError);
    await service.execute('user_1', {
      ...envelope,
      type: 'AcceptJobProposal',
      commandId: 'command_job',
      idempotencyKey: 'phase4:job:0001',
      payload: { proposalId: 'proposal_1' },
    });
    const manager = (await repository.load('career_1'))?.manager;
    expect(manager).toMatchObject({
      managerId: 'manager_1',
      currentClubId: clubId('b'),
      prestige: 90,
      seasons: 5,
    });
    expect(manager?.appointments).toHaveLength(2);
  });

  it('keeps hidden values private in market and scouting read models', async () => {
    const initial = state();
    const second = player(playerId('two'), clubId('b'), 'CM');
    const { service } = setup({
      ...initial,
      players: [...initial.players, second],
    });
    const market = await service.market('user_1', 'career_1', {
      position: 'ST',
    });
    const scout = await service.scout('user_1', 'career_1', playerId('one'));
    expect(JSON.stringify(market)).not.toContain('potential');
    expect(scout.estimates.potential).toBe('excellent');
    expect(JSON.stringify(scout)).not.toContain('82');
    const compared = await service.compare('user_1', 'career_1', [
      playerId('one'),
      playerId('two'),
    ]);
    expect(compared).toHaveLength(2);
    expect(JSON.stringify(compared)).not.toContain('"potential":82');
  });
});

import {
  EngineCareerSeasonAdvanceAdapter,
  FakeBearerAuth,
  FakeClock,
  InMemoryArchiveStorage,
  InMemoryPhaseFourRepository,
  Mulberry32RandomFactory,
  PhaseFourApplicationService,
  SequentialIdGenerator,
} from '@footebas/application';
import {
  phaseFourHistoryReadModelSchema,
  phaseFourLeaderboardReadModelSchema,
  phaseFourReceiptSchema,
} from '@footebas/contracts';
import {
  createClub,
  createLedger,
  createPlayer,
  createStadium,
  entityId,
  money,
  percentage,
  strength,
} from '../../../packages/domain/src/index.js';
import {
  createCareerWorld,
  createCareerWorldSave,
} from '../../../packages/engine/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApi } from '../src/index.js';

const config = {
  clubsPerDivision: 2,
  movementPlaces: 1,
  minimumSquad: 18,
  maximumSquad: 22,
  recentHistorySeasons: 2,
  maximumNews: 30,
};
const positions = [
  'GK',
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'FWD',
  'FWD',
  'FWD',
  'FWD',
  'FWD',
  'FWD',
];

function content() {
  return {
    version: 'phase4_api_content_v1',
    sourceIds: ['dados/elencos/phase4-api.md'],
    clubs: ['serie-a', 'serie-b'].flatMap((division) =>
      [0, 1].map((clubIndex) => {
        const id = `${division}:club-${clubIndex}`;
        return {
          id,
          name: id,
          division,
          tier: division === 'serie-a' ? 'A' : 'C',
          players: positions.map((position, index) => ({
            id: `player:${id}:${index}`,
            name: `Atleta ${id} ${index}`,
            position,
            strength: (division === 'serie-a' ? 70 : 60) + (index % 3),
            age: 18 + (index % 16),
            potential: 82,
            identitySource: 'raw-markdown',
            identitySourceId: `dados/elencos/phase4-api.md#${index}`,
            attributesVersion: 'phase4_api_derived_v1',
            attributesSeed: `phase4:${id}:${index}`,
          })),
        };
      }),
    ),
  };
}

function fixtureState() {
  const initial = createCareerWorld(content(), {
    seed: 'phase4_api_seed_v1',
    managerName: 'Ada',
    managerClubId: 'serie-b:club-1',
    config,
  });
  const threatened = {
    ...initial,
    manager: { ...initial.manager, confidence: -100 },
  };
  const clubMap = Object.fromEntries(
    threatened.clubs.map((club, index) => [
      club.id,
      entityId(`club_${index + 1}`, 'club'),
    ]),
  );
  const playerMap = Object.fromEntries(
    threatened.players.map((player, index) => [
      player.id,
      entityId(`player_${index + 1}`, 'player'),
    ]),
  );
  const managed = clubMap[threatened.manager.clubId];
  const marketPlayer = threatened.players.find(
    (player) =>
      player.clubId !== threatened.manager.clubId && player.position === 'GK',
  );
  if (!managed || !marketPlayer) throw new Error('invalid test fixture');
  const seller = clubMap[marketPlayer.clubId];
  const domainMarketPlayer = createPlayer({
    id: playerMap[marketPlayer.id],
    name: marketPlayer.name,
    age: marketPlayer.age,
    position: 'GK',
    secondaryPositions: [],
    strength: strength(marketPlayer.strength),
    traits: [],
    hidden: {
      potential: percentage(82),
      consistency: percentage(70),
      injuryProneness: percentage(10),
      adaptation: percentage(70),
      professionalism: percentage(85),
      bigGame: percentage(75),
    },
    morale: percentage(70),
    condition: percentage(100),
    matchSharpness: percentage(80),
    value: money(1_000_000),
    salary: money(20_000),
    clubId: seller,
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
  const clubs = threatened.clubs.map((club) =>
    createClub({
      id: clubMap[club.id],
      name: club.name,
      shortName: club.name.slice(-6),
      squad:
        clubMap[club.id] === seller
          ? [
              domainMarketPlayer.id,
              ...Array.from({ length: 18 }, (_, index) =>
                entityId(`reserve_${index + 1}`, 'player'),
              ),
            ]
          : [],
      balance: money(50_000_000),
      reputation: percentage(club.reputation),
    }),
  );
  return {
    marketPlayer: domainMarketPlayer,
    managed,
    seller,
    state: {
      careerId: 'career_phase4',
      userId: 'user_phase4',
      version: 0,
      schemaVersion: '3',
      currentDate: '2026-07-21',
      season: 1,
      manager: {
        managerId: 'manager_phase4',
        currentClubId: managed,
        employmentStatus: 'employed',
        boardConfidence: 10,
        fanConfidence: 10,
        prestige: 0,
        seasons: 0,
        appointments: [{ clubId: managed, joinedOn: '2026-01-01' }],
      },
      clubs,
      players: [domainMarketPlayer],
      contracts: [],
      offers: [],
      loans: [],
      ledger: createLedger(),
      stadiums: clubs.map((club) =>
        createStadium({
          clubId: club.id,
          capacity: 10_000,
          ticketPrice: money(3_000),
          maintenance: money(50_000),
          quality: 60,
        }),
      ),
      youth: [],
      objectives: [],
      jobProposals: [],
      history: [
        {
          id: 'history_old',
          type: 'title',
          season: 1,
          occurredOn: '2025-12-01',
          clubId: managed,
          competitionId: 'serie_b',
        },
      ],
      achievements: [],
      events: [],
      archiveKeys: [],
      seasonWorld: createCareerWorldSave(threatened),
      seasonIdentityMap: {
        worldManagerId: threatened.manager.id,
        managerId: 'manager_phase4',
        clubs: clubMap,
        players: playerMap,
      },
    },
  };
}

const openApis = [];
afterEach(async () =>
  Promise.all(openApis.splice(0).map((api) => api.close())),
);

async function setup() {
  const fixture = fixtureState();
  const repository = new InMemoryPhaseFourRepository([fixture.state]);
  const archives = new InMemoryArchiveStorage();
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const token = auth.issue({
    userId: 'user_phase4',
    email: 'phase4@example.com',
    displayName: 'Phase 4',
  });
  const intruder = auth.issue({
    userId: 'user_intruder',
    email: 'intruder@example.com',
    displayName: 'Intruder',
  });
  const service = new PhaseFourApplicationService({
    repository,
    archives,
    clock,
    ids: new SequentialIdGenerator(),
    random: new Mulberry32RandomFactory(),
    seasonAdvancer: new EngineCareerSeasonAdvanceAdapter(config),
  });
  const application = {
    execute() {},
    home() {},
    squad() {},
    nextMatch() {},
    standings() {},
    postMatch() {},
    // Locked careers (after a refund) are covered in the application tests.
    async assertCareerUnlocked() {},
  };
  const jobs = { status: async () => undefined };
  const api = await buildApi({
    application,
    jobs,
    phaseFour: { application: service, auth },
  });
  openApis.push(api);
  return { ...fixture, api, token, intruder, repository, archives, service };
}

const post = (f, payload, token = f.token) =>
  f.api.inject({
    method: 'POST',
    url: '/v1/phase-four/commands',
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
const command = (type, commandId, expectedVersion, payload = {}) => ({
  version: 1,
  careerId: 'career_phase4',
  commandId,
  idempotencyKey: `phase4:${commandId}`,
  expectedVersion,
  type,
  payload,
});

describe('Phase 4 server-authoritative HTTP vertical', () => {
  it('owns commands, conserves transfer money, advances the engine world, and projects history/leaderboards', async () => {
    const f = await setup();
    const offer = command('SubmitTransferOffer', 'command_transfer', 0, {
      playerId: f.marketPlayer.id,
      fromClubId: f.seller,
      toClubId: f.managed,
      kind: 'buy',
      fee: 1_000_000,
      wage: 25_000,
      expiresOn: '2026-08-01',
    });
    const first = phaseFourReceiptSchema.parse((await post(f, offer)).json());
    expect(first.aggregateVersion).toBe(1);
    expect(await post(f, offer)).toMatchObject({ statusCode: 200 });
    expect(
      (
        await post(f, {
          ...offer,
          payload: { ...offer.payload, fee: 2_000_000 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await post(
          f,
          command('SetTicketPrice', 'command_foreign', 1, {
            clubId: f.managed,
            ticketPrice: 4_000,
          }),
          f.intruder,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await post(
          f,
          command('SetTicketPrice', 'command_version', 0, {
            clubId: f.managed,
            ticketPrice: 4_000,
          }),
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await post(
          f,
          command('GenerateYouth', 'command_youth', 1, {
            clubId: f.managed,
            seed: 'youth_seed_v1',
            maximumCandidates: 2,
          }),
        )
      ).statusCode,
    ).toBe(200);
    const youth = (await f.repository.load('career_phase4')).youth[0];
    expect(
      (
        await post(
          f,
          command('PromoteYouth', 'command_promote', 2, {
            playerId: youth.player.id,
          }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await post(
          f,
          command('ExpandStadium', 'command_stadium', 3, {
            clubId: f.managed,
            addedCapacity: 500,
            cost: 100_000,
            completesOn: '2027-01-01',
          }),
        )
      ).statusCode,
    ).toBe(200);
    const beforeSeasonChecksum = await f.service.checksum(
      'user_phase4',
      'career_phase4',
    );
    expect(
      (await post(f, command('AdvanceCareerSeason', 'command_season', 4)))
        .statusCode,
    ).toBe(200);
    const saved = await f.repository.load('career_phase4');
    expect(saved.manager).toMatchObject({
      managerId: 'manager_phase4',
      seasons: 1,
    });
    expect(saved.manager.appointments).toHaveLength(2);
    expect(saved.seasonWorld.snapshot.season).toBe(2);
    expect(
      saved.ledger.entries.every(
        (entry) =>
          entry.postings.reduce((sum, posting) => sum + posting.amount, 0) ===
          0,
      ),
    ).toBe(true);
    expect(await f.service.checksum('user_phase4', 'career_phase4')).not.toBe(
      beforeSeasonChecksum,
    );
    const history = phaseFourHistoryReadModelSchema.parse(
      (
        await f.api.inject({
          method: 'GET',
          url: '/v1/phase-four/careers/career_phase4/history',
          headers: { authorization: `Bearer ${f.token}` },
        })
      ).json(),
    );
    expect(history.history.some(({ type }) => type === 'top_scorer')).toBe(
      true,
    );
    const leaderboard = phaseFourLeaderboardReadModelSchema.parse(
      (
        await f.api.inject({
          method: 'GET',
          url: '/v1/phase-four/careers/career_phase4/leaderboard?month=2027-07',
          headers: { authorization: `Bearer ${f.token}` },
        })
      ).json(),
    );
    expect(leaderboard.global[0]).toMatchObject({
      managerId: 'manager_phase4',
      rank: 1,
    });
  });
});

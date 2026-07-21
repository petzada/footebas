import { describe, expect, it } from 'vitest';
import {
  advanceCareerSeason,
  createCareerWorld,
  createCareerWorldSave,
  ledgerConservationErrors,
  migrateCareerWorldSave,
  type CareerPosition,
  type CareerWorldConfig,
  type CareerWorldContent,
} from './index.js';

const TEST_CONFIG: CareerWorldConfig = {
  clubsPerDivision: 2,
  movementPlaces: 1,
  minimumSquad: 18,
  maximumSquad: 20,
  recentHistorySeasons: 2,
  maximumNews: 30,
};

function content(): CareerWorldContent {
  const positions: readonly CareerPosition[] = [
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
  ];
  return {
    version: 'test-content-v1',
    sourceIds: ['dados/elencos/test.md'],
    clubs: (['serie-a', 'serie-b'] as const).flatMap((division) =>
      [0, 1].map((clubIndex) => {
        const clubId = `${division}:club-${String(clubIndex)}`;
        return {
          id: clubId,
          name: clubId,
          division,
          tier: division === 'serie-a' ? 'A' : 'C',
          players: positions.map((position, playerIndex) => ({
            id: `player:${clubId}:${String(playerIndex)}`,
            name: `Real ${clubId} ${String(playerIndex)}`,
            position,
            strength: (division === 'serie-a' ? 70 : 60) + (playerIndex % 3),
            age: 18 + (playerIndex % 17),
            potential: 82,
            identitySource: 'raw-markdown' as const,
            identitySourceId: `dados/elencos/test.md#${String(playerIndex)}`,
            attributesVersion: 'test-derived-v1',
            attributesSeed: `test:${clubId}:${String(playerIndex)}`,
          })),
        };
      }),
    ),
  };
}

describe('career world', () => {
  it('advances immutable two-division seasons deterministically with a conserved ledger', () => {
    const initial = createCareerWorld(content(), {
      seed: 'career-engine-test',
      managerClubId: 'serie-b:club-1',
      config: TEST_CONFIG,
    });
    const first = advanceCareerSeason(initial, TEST_CONFIG);
    const replay = advanceCareerSeason(initial, TEST_CONFIG);
    expect(first).toEqual(replay);
    expect(initial.season).toBe(1);
    expect(first.season).toBe(2);
    expect(
      first.clubs.filter(({ division }) => division === 'serie-a'),
    ).toHaveLength(2);
    expect(first.history[0]).toMatchObject({
      promoted: [expect.any(String)],
      relegated: [expect.any(String)],
    });
    expect(ledgerConservationErrors(first.ledger)).toEqual([]);
    expect(
      first.ledger.every(
        ({ sourceId, postings }) =>
          sourceId.length > 0 && Object.isFrozen(postings),
      ),
    ).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('preserves manager identity through dismissal and appointment', () => {
    const initial = createCareerWorld(content(), {
      seed: 'career-manager-test',
      managerClubId: 'serie-b:club-1',
      config: TEST_CONFIG,
    });
    const threatened = {
      ...initial,
      manager: { ...initial.manager, confidence: -100 },
    };
    const advanced = advanceCareerSeason(threatened, TEST_CONFIG);
    expect(advanced.manager.id).toBe(initial.manager.id);
    expect(advanced.manager.dismissals).toBe(1);
    expect(advanced.manager.clubId).not.toBe(initial.manager.clubId);
    expect(advanced.manager.jobHistory).toHaveLength(2);
    expect(advanced.news.map(({ type }) => type)).toEqual(
      expect.arrayContaining(['manager-fired', 'manager-appointed']),
    );
  });

  it('compacts history and exposes an explicit legacy save migration', () => {
    let world = createCareerWorld(content(), {
      seed: 'career-save-test',
      config: TEST_CONFIG,
    });
    for (let season = 0; season < 4; season += 1)
      world = advanceCareerSeason(world, TEST_CONFIG);
    expect(world.history).toHaveLength(2);
    expect(world.archive).toMatchObject({ seasons: 2, throughSeason: 2 });
    const migrated = migrateCareerWorldSave({
      schemaVersion: 'career-save-v0',
      snapshot: world,
    });
    expect(migrated.migrationHistory).toEqual([
      'career-save-v0->career-save-v1',
    ]);
    expect(createCareerWorldSave(world).schemaVersion).toBe(
      migrated.schemaVersion,
    );
  });
});

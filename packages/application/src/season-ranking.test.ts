/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the selected club */
import { InMemoryRankingStore, InMemoryUnitOfWork } from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  RankingService,
  SequentialIdGenerator,
  type CareerSnapshot,
} from './index.js';

const command = (
  type: string,
  commandId: string,
  expectedVersion: number,
  payload: object,
) => ({
  version: 1,
  type,
  commandId,
  idempotencyKey: `idem-${commandId}`,
  expectedVersion,
  payload,
});

describe('temporada e ranking sobre a mesma carreira', () => {
  it(
    'estatísticas batem com a temporada jogada e a conquista entra no mesmo commit do save',
    { timeout: 900_000 },
    async () => {
      const clock = new FakeClock();
      const auth = new FakeBearerAuth();
      const unitOfWork = new InMemoryUnitOfWork(clock);
      let crashSeasonClose = true;
      const app = new FootebasApplication({
        auth,
        clock,
        ids: new SequentialIdGenerator(),
        jobs: new InMemoryJobQueue(),
        storage: new InMemoryStorage(),
        telemetry: new NoopTelemetry(),
        unitOfWork,
        // The job that closes the season fails once after the ledger write.
        failPoint: (_point, job) => {
          if (job.fixtureId === undefined && crashSeasonClose) {
            crashSeasonClose = false;
            throw new Error('crash before persisting the season close');
          }
        },
      });
      const token = auth.issue({
        userId: 'user_owner',
        email: 'owner@example.com',
        displayName: 'Owner',
      });
      const created = await app.execute(
        token,
        command('CreateCareer', 'command_create', 0, {
          managerName: 'Marcio',
          startDate: '2026-01-01',
        }),
      );
      const careerId = created.careerId;
      await app.execute(
        token,
        command('SelectClub', 'command_club', 1, {
          careerId,
          clubId: 'club_flamengo',
        }),
      );
      const leagueId = (await app.standings(token, careerId)).competitionId;
      const snapshotOf = async () =>
        (await unitOfWork.repositories().saves.peek(careerId))!
          .snapshot as unknown as CareerSnapshot;

      let checkedMidSeason = false;
      let sawRollback = false;
      for (let step = 0; step < 220; step++) {
        const home = await app.home(token, careerId);
        if (home.season === 2) break;
        if (!checkedMidSeason && home.currentDate >= '2026-07-01') {
          checkedMidSeason = true;
          const season = await app.careerSeason(token, careerId);
          const snapshot = await snapshotOf();
          expect(season.coverage).toBe('complete');
          // Season 1: every season line equals the engine's career totals.
          for (const player of snapshot.players) {
            const line = snapshot.stats!.players[player.id];
            expect([
              line?.goals ?? 0,
              line?.assists ?? 0,
              line?.appearances ?? 0,
            ]).toEqual([
              player.careerStats.goals,
              player.careerStats.assists,
              player.careerStats.appearances,
            ]);
          }
          const goals = snapshot.players.map(
            ({ careerStats }) => careerStats.goals,
          );
          expect(season.topScorers[0]!.value).toBe(Math.max(...goals));
          expect(season.topAssists[0]!.value).toBe(
            Math.max(...snapshot.players.map((p) => p.careerStats.assists)),
          );
          for (const leader of season.topRatings)
            expect(leader.appearances).toBeGreaterThanOrEqual(
              season.minimumRatedAppearances,
            );
          // Club record across every competition, recomputed here.
          const played = snapshot.competition.fixtures.filter(
            (fixture) =>
              snapshot.competition.results[fixture.id] !== undefined &&
              (fixture.homeClubId === 'club_flamengo' ||
                fixture.awayClubId === 'club_flamengo'),
          );
          expect(season.club!.played).toBe(played.length);
          expect(
            season.club!.won + season.club!.drawn + season.club!.lost,
          ).toBe(played.length);
          const goalsFor = played.reduce((sum, fixture) => {
            const result = snapshot.competition.results[fixture.id]!;
            return (
              sum +
              (fixture.homeClubId === 'club_flamengo'
                ? result.homeGoals
                : result.awayGoals)
            );
          }, 0);
          expect(season.club!.goalsFor).toBe(goalsFor);
          // One position per managed league round played, in order.
          const league = season.positions.find(
            ({ competitionId }) => competitionId === leagueId,
          )!;
          expect(league.rounds.length).toBe(
            played.filter(({ competitionId }) => competitionId === leagueId)
              .length,
          );
          const rounds = league.rounds.map(({ round }) => round);
          expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
          expect(
            league.rounds.every(
              ({ position }) => position >= 1 && position <= 20,
            ),
          ).toBe(true);
        }
        const { aggregateVersion } = home;
        await app.execute(
          token,
          command(
            'AutoPickLineup',
            `command_pick_${String(step)}`,
            aggregateVersion,
            {
              careerId,
              clubId: home.club?.id ?? 'club_flamengo',
              formation: '4-4-2',
              mode: 'best',
            },
          ),
        );
        await app.execute(
          token,
          command(
            'AdvanceDate',
            `command_advance_${String(step)}`,
            aggregateVersion + 1,
            { careerId },
          ),
        );
        const status = await app.runNextJob();
        if (status?.state === 'failed') {
          // Rolled back: no achievement without the save that produced it.
          sawRollback = true;
          expect(unitOfWork.achievements()).toEqual([]);
          expect((await app.home(token, careerId)).season).toBe(1);
          expect((await app.runNextJob())?.state).toBe('succeeded');
        } else expect(status?.state).toBe('succeeded');
      }
      expect(checkedMidSeason).toBe(true);
      expect(sawRollback).toBe(true);

      const snapshot = await snapshotOf();
      expect(snapshot.season).toBe(2);
      const ledger = unitOfWork.achievements();
      expect(ledger.length).toBe(snapshot.world.achievements.length);
      expect(ledger).toContainEqual(
        expect.objectContaining({
          careerId,
          userId: 'user_owner',
          displayName: 'Marcio',
          type: 'season_completed',
          season: 1,
          competitionId: leagueId,
          points: 5,
          rulesVersion: 'ranking-v1',
          recordedAt: '2026-07-21T12:00:00.000Z',
        }),
      );
      const count = (
        types: readonly string[],
        items: readonly { type: string }[],
      ) => items.filter(({ type }) => types.includes(type)).length;
      expect(count(['cup_title', 'state_title'], ledger)).toBe(
        count(['cup_title'], snapshot.world.achievements),
      );
      expect(
        count(['league_title', 'continental_title', 'promotion'], ledger),
      ).toBe(
        count(
          ['league_title', 'continental_title', 'promotion'],
          snapshot.world.achievements,
        ),
      );

      const season = await app.careerSeason(token, careerId);
      expect(season).toMatchObject({ season: 2, coverage: 'complete' });
      expect(season.topScorers).toEqual([]);
      const archived = season.history[0]!;
      expect(archived.season).toBe(1);
      expect(archived.champions).toHaveLength(12);
      expect(archived.awards.map(({ kind }) => kind)).toEqual([
        'top_scorer',
        'top_assists',
        'best_rating',
      ]);
      expect(archived.club?.club.id).toBe('club_flamengo');
      expect(
        archived.positions.find(
          ({ competitionId }) => competitionId === leagueId,
        )?.rounds,
      ).toHaveLength(38);
      const titles = season.history[0]!.champions;
      const flamengoTitles = titles.filter(
        ({ club }) => club.id === 'club_flamengo',
      ).length;
      expect(
        count(
          ['league_title', 'cup_title', 'state_title', 'continental_title'],
          ledger,
        ),
      ).toBe(flamengoTitles);

      const rankings = new RankingService({
        store: new InMemoryRankingStore(() => unitOfWork.achievements()),
        clock,
        auth,
      });
      await rankings.generateSnapshots();
      const board = await rankings.leaderboard({ scope: 'global' });
      expect(board.rows).toEqual([
        {
          position: 1,
          displayName: 'Marcio',
          points: ledger.reduce((sum, { points }) => sum + points, 0),
        },
      ]);
      const mine = await rankings.mine(token);
      expect(mine.entries[0]).toMatchObject({ scope: 'global', position: 1 });
    },
  );
});

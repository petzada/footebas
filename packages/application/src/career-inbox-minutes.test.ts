/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the selected club and its squad */
import { InMemoryUnitOfWork } from '@footebas/database';
import type { CompetitionCalendarFixture, MatchResult } from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
  careerSaveRepository,
  resolveInboxDecision,
  runInboxDay,
  type CareerSnapshot,
} from './index.js';

const CLUB = 'club_flamengo';

/** A fresh Flamengo career, read straight from storage. */
async function career(): Promise<CareerSnapshot> {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const app = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  const envelope = (type: string, version: number, payload: object) => ({
    version: 1,
    type,
    commandId: `command_minutes_${type.toLowerCase()}`,
    idempotencyKey: `idem-minutes-${type}`,
    expectedVersion: version,
    payload,
  });
  const created = await app.execute(
    token,
    envelope('CreateCareer', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  await app.execute(
    token,
    envelope('SelectClub', 1, { careerId: created.careerId, clubId: CLUB }),
  );
  const save = (await careerSaveRepository(
    unitOfWork.repositories().saves,
  ).peek(created.careerId))!;
  return structuredClone(save.snapshot) as unknown as CareerSnapshot;
}

/** The strongest player of the squad, who always ends on the bench here. */
function benchedStar(snapshot: CareerSnapshot) {
  return snapshot.players
    .filter(({ clubId }) => clubId === CLUB)
    .sort(
      (left, right) =>
        Number(right.strength) - Number(left.strength) ||
        left.id.localeCompare(right.id),
    )[0]!;
}

let match = 0;
/** A managed home win where every squad member but `benched` started. */
function playOn(snapshot: CareerSnapshot, date: string, benched: string[]) {
  match += 1;
  snapshot.currentDate = date;
  const fixture = {
    id: `fixture_minutes_${String(match)}`,
    competitionId: 'brasileirao_serie_a',
    stageId: 'league',
    phaseOrder: 1,
    round: match,
    date,
    homeClubId: CLUB,
    awayClubId: 'club_palmeiras',
  } as unknown as CompetitionCalendarFixture;
  const result = {
    homeGoals: 1,
    awayGoals: 0,
    playerPerformances: snapshot.players
      .filter(({ clubId }) => clubId === CLUB)
      .map(({ id }) => ({
        playerId: id,
        side: 'home',
        started: !benched.includes(id),
        injuryRounds: 0,
        suspensionRounds: 0,
      })),
  } as unknown as MatchResult;
  runInboxDay(snapshot, {
    date,
    played: { fixture, result, form: ['W'], opponentName: 'Palmeiras' },
  });
}

const requests = (snapshot: CareerSnapshot, playerId?: string) =>
  (snapshot.inbox?.messages ?? []).filter(
    (message) =>
      message.topic === 'player_minutes' &&
      (playerId === undefined || message.playerId === playerId),
  );

describe('pedidos de minutos dos atletas', () => {
  it('não repete o pedido do mesmo atleta a cada mês', async () => {
    const snapshot = await career();
    const star = benchedStar(snapshot);
    for (const date of ['2026-03-04', '2026-04-04', '2026-05-04', '2026-06-04'])
      playOn(snapshot, date, [star.id]);
    // Ignored (expired) requests still start a cooldown for that player.
    expect(requests(snapshot, star.id).length).toBeLessThanOrEqual(2);
    const dates = requests(snapshot, star.id).map(
      ({ occurredOn }) => occurredOn,
    );
    for (let index = 1; index < dates.length; index++)
      expect(
        Date.parse(dates[index]!) - Date.parse(dates[index - 1]!),
      ).toBeGreaterThanOrEqual(60 * 86_400_000);
  });

  it('não abre outro pedido enquanto um ainda espera resposta', async () => {
    const snapshot = await career();
    const star = benchedStar(snapshot);
    const second = snapshot.players
      .filter(({ clubId }) => clubId === CLUB)
      .sort(
        (left, right) => Number(right.strength) - Number(left.strength),
      )[1]!;
    playOn(snapshot, '2026-03-25', [star.id, second.id]);
    playOn(snapshot, '2026-04-01', [star.id, second.id]);
    expect(requests(snapshot)).toHaveLength(1);
  });

  it('respeita a decisão: quem ouviu "não" ou foi listado não pede de novo na temporada', async () => {
    for (const optionId of ['deny', 'list_player']) {
      const snapshot = await career();
      const star = benchedStar(snapshot);
      playOn(snapshot, '2026-03-04', [star.id]);
      const [request] = requests(snapshot, star.id);
      expect(request).toBeDefined();
      resolveInboxDecision(snapshot, request!.id, optionId);
      for (const date of [
        '2026-05-10',
        '2026-07-10',
        '2026-09-10',
        '2026-11-10',
      ])
        playOn(snapshot, date, [star.id]);
      expect([optionId, requests(snapshot, star.id)]).toEqual([
        optionId,
        [request],
      ]);
    }
  });

  it('depois de prometer minutos, o atleta só volta a pedir passado o prazo', async () => {
    const snapshot = await career();
    const star = benchedStar(snapshot);
    playOn(snapshot, '2026-03-04', [star.id]);
    resolveInboxDecision(
      snapshot,
      requests(snapshot, star.id)[0]!.id,
      'promise_minutes',
    );
    playOn(snapshot, '2026-04-04', [star.id]);
    expect(requests(snapshot, star.id)).toHaveLength(1);
    playOn(snapshot, '2026-05-10', [star.id]);
    expect(requests(snapshot, star.id)).toHaveLength(2);
  });
});

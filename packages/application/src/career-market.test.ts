import {
  MAX_SQUAD_SIZE,
  createClub,
  createLedger,
  createPlayer,
  entityId,
  money,
  percentage,
  strength,
  type Club,
  type ClubId,
  type Player,
  type Position,
} from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  catalogCareerContent,
  cashByClub,
  createCareerWorld,
  employManager,
  runMarketDay,
  type WorldContext,
} from './index.js';

const MANAGED = 'club_flamengo' as ClubId;

function catalogContext(): WorldContext {
  const content = catalogCareerContent.load();
  const context: WorldContext = {
    clubs: [...content.clubs],
    players: [...content.players],
    world: createCareerWorld(
      content.clubs,
      content.players,
      '2026-01-01',
      'manager_test',
    ),
  };
  employManager(context, MANAGED, '2026-01-01', 'serie-a', 1);
  return context;
}

/** Every third day of the pre-season window, like the state leagues. */
const PRE_SEASON_DAYS = Array.from({ length: 16 }, (_, index) => {
  const day = 2 + index * 3;
  return new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
});

function runWindow(seed: string, listed = false): WorldContext {
  const context = catalogContext();
  if (listed) {
    const squad = context.players
      .filter(({ clubId }) => clubId === MANAGED)
      .sort((left, right) => Number(left.strength) - Number(right.strength))
      .slice(0, 4);
    context.world.market = {
      listings: squad.map((player) => ({
        playerId: player.id,
        clubId: MANAGED,
        mode: 'sale' as const,
        askingPrice: player.value,
        listedOn: '2026-01-01',
      })),
    };
  }
  for (const date of PRE_SEASON_DAYS) runMarketDay(context, date, seed);
  return context;
}

const totalCash = (context: WorldContext): number =>
  [...cashByClub(context.clubs, context.world.ledger).values()].reduce(
    (sum, value) => sum + value,
    0,
  );

describe('IA de mercado (docs/adr/0008)', () => {
  it('é determinística: mesma seed e mesmas datas geram as mesmas propostas e negócios', () => {
    const first = runWindow('seed-a', true);
    const second = runWindow('seed-a', true);
    expect(second.world.offers).toEqual(first.world.offers);
    expect(second.world.ledger).toEqual(first.world.ledger);
    expect(second.players).toEqual(first.players);
    const other = runWindow('seed-b', true);
    expect(other.world.offers).not.toEqual(first.world.offers);
  });

  it('propõe pelos atletas do clube gerido, mais pelos listados, e negocia entre clubes da IA', () => {
    const context = runWindow('seed-a', true);
    const received = context.world.offers.filter(
      ({ fromClubId }) => fromClubId === MANAGED,
    );
    expect(received.length).toBeGreaterThan(0);
    const listed = new Set(
      (context.world.market?.listings ?? []).map(({ playerId }) => playerId),
    );
    expect(
      received.filter(({ playerId }) => listed.has(playerId)).length,
    ).toBeGreaterThanOrEqual(received.length / 2);
    for (const offer of received) {
      expect(offer.toClubId).not.toBe(MANAGED);
      expect(offer.expiresOn <= '2026-02-17').toBe(true);
    }
    // Managed players never leave without the manager's decision.
    expect(
      context.players.filter(({ clubId }) => clubId === MANAGED).length,
    ).toBe(
      catalogContext().players.filter(({ clubId }) => clubId === MANAGED)
        .length,
    );
    const deals = context.world.ledger.entries.filter(
      ({ source }) => source.type === 'transfer',
    );
    expect(deals.length).toBeGreaterThan(0);
  });

  it('conserva o dinheiro: toda transferência é um lançamento balanceado entre clubes', () => {
    const before = catalogContext();
    const after = runWindow('seed-a', true);
    expect(totalCash(after)).toBe(totalCash(before));
    for (const entry of after.world.ledger.entries)
      expect(
        entry.postings.reduce((sum, { amount }) => sum + Number(amount), 0),
      ).toBe(0);
    for (const [clubId, cash] of cashByClub(after.clubs, after.world.ledger))
      expect(cash, clubId).toBeGreaterThanOrEqual(0);
  });

  it('mantém elencos e contratos coerentes e respeita o limite de 35', () => {
    const before = catalogContext();
    const after = runWindow('seed-a', true);
    const sizes = (context: WorldContext) =>
      new Map(context.clubs.map(({ id, squad }) => [id, squad.length]));
    const initial = sizes(before);
    for (const club of after.clubs) {
      const members = after.players.filter(({ clubId }) => clubId === club.id);
      expect(new Set(club.squad)).toEqual(new Set(members.map(({ id }) => id)));
      expect(club.squad.length).toBeLessThanOrEqual(
        Math.max(MAX_SQUAD_SIZE, initial.get(club.id) ?? 0),
      );
      expect(club.squad.length).toBeGreaterThanOrEqual(
        Math.min(22, initial.get(club.id) ?? 0),
      );
    }
    const active = after.world.contracts.filter(
      ({ status }) => status === 'active' || status === 'expiring',
    );
    const owner = new Map(after.players.map(({ id, clubId }) => [id, clubId]));
    for (const contract of active)
      expect(owner.get(contract.playerId)).toBe(contract.clubId);
  });

  it('não faz nada fora da janela além de expirar propostas', () => {
    const context = runWindow('seed-a', true);
    const players = context.players;
    const ledger = context.world.ledger;
    runMarketDay(context, '2026-03-10', 'seed-a');
    expect(context.players).toEqual(players);
    expect(context.world.ledger).toEqual(ledger);
    expect(
      context.world.offers.filter(({ status }) => status === 'pending'),
    ).toHaveLength(0);
  });
});

describe('limite de elenco nas negociações entre clubes da IA', () => {
  const athlete = (id: string, clubId: ClubId, position: Position): Player =>
    createPlayer({
      id: entityId(`player_${id}`, 'player'),
      name: `Atleta ${id}`,
      age: 25,
      position,
      secondaryPositions: [],
      strength: strength(60),
      traits: [],
      hidden: {
        potential: percentage(60),
        consistency: percentage(60),
        injuryProneness: percentage(10),
        adaptation: percentage(60),
        professionalism: percentage(60),
        bigGame: percentage(60),
      },
      morale: percentage(70),
      condition: percentage(100),
      matchSharpness: percentage(80),
      value: money(1_000_000),
      salary: money(10_000),
      clubId,
      squadStatus: 'rotation',
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

  /** Buyer has no goalkeeper; seller has six. */
  function world(buyerSize: number): WorldContext {
    const buyerId = 'club_buyer' as ClubId;
    const sellerId = 'club_seller' as ClubId;
    const outfield: Position[] = [
      'CB',
      'CM',
      'ST',
      'RB',
      'LB',
      'DM',
      'AM',
      'RW',
      'LW',
    ];
    const at = (index: number): Position =>
      outfield[index % outfield.length] ?? 'CM';
    const players: Player[] = [];
    for (let index = 0; index < buyerSize; index++)
      players.push(athlete(`b${String(index)}`, buyerId, at(index)));
    for (let index = 0; index < 30; index++)
      players.push(
        athlete(`s${String(index)}`, sellerId, index < 6 ? 'GK' : at(index)),
      );
    const club = (id: ClubId): Club =>
      createClub({
        id,
        name: id,
        shortName: id.slice(5, 10),
        squad: players
          .filter(({ clubId }) => clubId === id)
          .map(({ id: playerId }) => playerId),
        balance: money(500_000_000),
        reputation: percentage(60),
      });
    const clubs = [club(buyerId), club(sellerId)];
    const context: WorldContext = {
      clubs,
      players,
      world: createCareerWorld(clubs, players, '2026-01-01', 'manager_none'),
    };
    context.world.ledger = createLedger();
    return context;
  }

  it('compra onde falta e não passa de 35 atletas', () => {
    const open = world(20);
    runMarketDay(open, '2026-01-05', 'seed');
    expect(
      open.players.filter(
        ({ clubId, position }) => clubId === 'club_buyer' && position === 'GK',
      ),
    ).toHaveLength(1);
    expect(totalCash(open)).toBe(1_000_000_000);

    const full = world(MAX_SQUAD_SIZE);
    runMarketDay(full, '2026-01-05', 'seed');
    expect(
      full.players.filter(({ clubId }) => clubId === 'club_buyer'),
    ).toHaveLength(MAX_SQUAD_SIZE);
    expect(full.world.ledger.entries).toHaveLength(0);
  });
});

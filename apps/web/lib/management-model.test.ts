import { describe, expect, it } from 'vitest';
import { InMemoryCareerApi } from '@/lib/career-api';
import {
  applySavedLineup,
  buildBoard,
  FORMATION_LAYOUT,
  lineupInput,
  locate,
  placePlayer,
  reformBoard,
  transferWindowOn,
  upsertSavedLineup,
  validateBoard,
  type SavedLineup,
} from '@/lib/management-model';

async function roster() {
  const api = new InMemoryCareerApi();
  await api.login('a@b.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  return (await api.getCareer())!.players;
}

describe('prancheta: tabuleiro da escalação', () => {
  it('monta os 11 nos slots da formação com o goleiro no gol', async () => {
    const players = await roster();
    const board = buildBoard(players, '4-3-3');
    expect(board.slots.filter(Boolean)).toHaveLength(11);
    expect(board.slots[0]).toBe('fla-1');
    expect(board.bench).toHaveLength(7);
    expect(validateBoard(board, players)).toEqual([]);
  });

  it('troca de lugar ao soltar sobre um titular e manda para o banco', async () => {
    const players = await roster();
    const board = buildBoard(players, '4-3-3');
    const benchFirst = board.bench[0]!;
    const slotOne = board.slots[1]!;
    const swapped = placePlayer(board, benchFirst, { kind: 'slot', index: 1 });
    expect(swapped.slots[1]).toBe(benchFirst);
    expect(swapped.bench).toContain(slotOne);
    expect(swapped.bench).not.toContain(benchFirst);
    const benched = placePlayer(swapped, benchFirst, { kind: 'bench' });
    expect(benched.slots[1]).toBeNull();
    expect(locate(benched, benchFirst)).toEqual({ kind: 'bench' });
    expect(validateBoard(benched, players)[0]).toMatch(/faltam 1 titular/i);
  });

  it('rejeita goleiro na linha, linha no gol e banco acima de 7', async () => {
    const players = await roster();
    const board = buildBoard(players, '4-4-2');
    const wrong = placePlayer(board, board.slots[3]!, {
      kind: 'slot',
      index: 0,
    });
    const problems = validateBoard(wrong, players);
    expect(
      problems.some((item) => /é goleiro e está na linha/.test(item)),
    ).toBe(true);
    expect(problems.some((item) => /não é goleiro/.test(item))).toBe(true);
    const crowded = [5, 6, 7].reduce(
      (current, index) =>
        placePlayer(current, board.slots[index]!, { kind: 'bench' }),
      board,
    );
    expect(validateBoard(crowded, players)).toContain(
      'O banco aceita no máximo 7 jogadores.',
    );
  });

  it('gera um SetLineup com 11 posições na ordem dos slots e capitão titular', async () => {
    const players = await roster();
    const board = buildBoard(players, '3-5-2');
    const input = lineupInput(board, players);
    expect(input.starters).toHaveLength(11);
    expect(input.starters.map((slot) => slot.position)).toEqual(
      FORMATION_LAYOUT['3-5-2'].map((slot) => slot.position),
    );
    expect(input.starters.map((s) => s.playerId)).toContain(input.captainId);
    expect(reformBoard(board, players, '4-4-2').formation).toBe('4-4-2');
  });

  it('guarda até três escalações nomeadas e reaplica só quem ainda está no elenco', async () => {
    const players = await roster();
    const board = buildBoard(players, '4-4-2');
    const lineup = (name: string): SavedLineup => ({
      name,
      board,
      tactics: {
        mentality: 'balanced',
        buildUp: 'mixed',
        focus: 'middle',
        press: 'medium',
        defensiveLine: 'standard',
        marking: 'strong',
      },
      savedAt: '2026-01-01T00:00:00.000Z',
    });
    let saved = upsertSavedLineup([], lineup('A'));
    saved = upsertSavedLineup(saved, lineup('B'));
    saved = upsertSavedLineup(saved, lineup('C'));
    expect(() => upsertSavedLineup(saved, lineup('D'))).toThrow(/3 escalações/);
    expect(upsertSavedLineup(saved, lineup('b'))).toHaveLength(3);
    const smaller = players.filter((player) => player.id !== board.slots[5]);
    const applied = applySavedLineup(lineup('A'), smaller);
    expect(applied.slots[5]).toBeNull();
    expect(applied.slots.filter(Boolean)).toHaveLength(10);
  });
});

describe('janelas de transferência (ADR 0008)', () => {
  it('abre na pré-temporada, fecha fora dela e conta até a próxima', () => {
    expect(transferWindowOn('2026-01-20')).toMatchObject({
      status: 'open',
      closesOn: '2026-02-17',
      daysRemaining: 28,
    });
    const closed = transferWindowOn('2026-03-10');
    expect(closed.status).toBe('closed');
    expect(closed.nextOpensOn).toBe('2026-04-17');
    expect(closed.daysUntilNext).toBe(38);
    expect(transferWindowOn('2026-05-08').status).toBe('open');
    expect(transferWindowOn('2026-05-09')).toMatchObject({
      status: 'closed',
      nextOpensOn: '2027-01-01',
    });
  });
});

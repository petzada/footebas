import { describe, expect, it } from 'vitest';
import {
  defaultStageId,
  demoCompetitionTables,
  initialCompetitionId,
  legendOf,
  orderedCompetitions,
  orderedGroups,
  shortClubName,
  tieSummary,
  withCareerLeague,
  zoneOf,
} from '@/lib/competition-tables';

const view = demoCompetitionTables();
const table = (id: string) =>
  view.competitions.find(({ competitionId }) => competitionId === id)!;

describe('tabelas por competição (D7)', () => {
  it('colore cada posição pela faixa da zona e lista a legenda uma vez', () => {
    const group = table('serie_a').stages[0]!.groups[0]!;
    expect(zoneOf(group, group.rows[0]!)).toBe('title');
    expect(zoneOf(group, group.rows[1]!)).toBe('continental');
    expect(zoneOf(group, group.rows[5]!)).toBe('continental_qualifying');
    expect(zoneOf(group, group.rows[9]!)).toBeUndefined();
    expect(zoneOf(group, group.rows[19]!)).toBe('relegation');
    expect(legendOf(group).map(({ label }) => label)).toEqual([
      'Campeão',
      'Libertadores',
      'Pré-Libertadores',
      'Rebaixamento',
    ]);
    // A row's own zone wins over the bands.
    expect(zoneOf(group, { ...group.rows[9]!, zone: 'promotion' })).toBe(
      'promotion',
    );
  });

  it('abre na competição que a Central acompanha e na fase em disputa', () => {
    expect(orderedCompetitions(view)[0]!.competitionId).toBe('serie_a');
    expect(initialCompetitionId(view)).toBe('serie_a');
    expect(initialCompetitionId(view, 'copa_do_brasil')).toBe('copa_do_brasil');
    expect(initialCompetitionId(view, 'inexistente')).toBe('serie_a');
    expect(defaultStageId(table('copa_do_brasil'))).toBe('cdb_quartas');
    expect(defaultStageId(table('copa_libertadores'))).toBe('lib_groups');
  });

  it('resume o confronto: ida, volta, agregado, vencedor e desempate', () => {
    const oitavas = table('copa_do_brasil').stages[0]!;
    const penalties = tieSummary(oitavas.ties[2]!);
    expect(penalties.legs.map(({ label, score }) => [label, score])).toEqual([
      ['Ida', '1–1'],
      ['Volta', '2–2'],
    ]);
    expect(penalties.aggregate).toBe('3–3');
    expect(penalties.winner?.name).toBe('Bahia');
    expect(penalties.decidedByTiebreak).toBe(true);
    expect(penalties.involves('Grêmio')).toBe(true);
    expect(penalties.involves('Flamengo')).toBe(false);

    const open = tieSummary(table('copa_do_brasil').stages[1]!.ties[2]!);
    expect(open.legs.every(({ score }) => score === undefined)).toBe(true);
    expect(open.aggregate).toBeUndefined();
    expect(open.winner).toBeUndefined();
  });

  it('põe o grupo do clube antes dos outros', () => {
    const groups = table('copa_libertadores').stages[1]!;
    expect(orderedGroups(groups, 'Flamengo').map(({ name }) => name)).toEqual([
      'Grupo B',
      'Grupo A',
      'Grupo C',
      'Grupo D',
    ]);
    expect(orderedGroups(groups, 'Santos')[0]!.name).toBe('Grupo A');
  });

  it('demo: a liga do save substitui a tabela de mesmo nome, com as zonas', () => {
    const merged = withCareerLeague(view, {
      club: 'Juventude FC',
      division: 'Série A',
      standings: [
        { position: 2, club: 'Juventude FC', played: 3, points: 7 },
        { position: 1, club: 'Palmeiras', played: 3, points: 9 },
      ],
    });
    expect(merged.focusCompetitionId).toBe('serie_a');
    expect(
      merged.competitions.filter(({ name }) => name === 'Série A'),
    ).toHaveLength(1);
    const group = merged.competitions[0]!.stages[0]!.groups[0]!;
    expect(group.rows.map(({ club }) => club.name)).toEqual([
      'Palmeiras',
      'Juventude FC',
    ]);
    expect(group.zones.length).toBeGreaterThan(0);
    // The club is already listed by the server: nothing changes.
    expect(
      withCareerLeague(view, {
        club: 'Flamengo',
        standings: [{ position: 1, club: 'Flamengo', played: 1, points: 3 }],
      }),
    ).toBe(view);
  });

  it('abrevia nomes longos para as colunas estreitas', () => {
    expect(shortClubName('Flamengo')).toBe('Flamengo');
    expect(shortClubName('Atlético Mineiro')).toBe('Atlético M.');
    expect(shortClubName('Independiente del Valle', 11)).toBe('ID Valle');
  });
});

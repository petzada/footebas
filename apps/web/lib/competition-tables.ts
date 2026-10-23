import type { StandingView } from '@/lib/career-api';
import type {
  CompetitionTableView,
  CompetitionTablesView,
  TableClubRef,
  TableGroupView,
  TableRowView,
  TableStageView,
  TableZoneKind,
  TieView,
} from '@/lib/competition-product';

/**
 * Pure helpers behind the Classificação screen (docs/design revisão mobile,
 * D7): which competition and stage open first, how the zones colour the
 * rows, how a tie reads. Everything comes from the server read model
 * (`GET /v1/careers/:id/tables`); nothing here estimates a result.
 */

export const ZONE_LABEL: Record<TableZoneKind, string> = {
  title: 'Título',
  continental: 'Libertadores',
  continental_qualifying: 'Pré-Libertadores',
  promotion: 'Acesso',
  relegation: 'Rebaixamento',
  advance: 'Classificação',
};

/** Colour of the zone band at the left of a row (scoreboard palette). */
export const ZONE_TONE: Record<TableZoneKind, string> = {
  title: 'bg-bulb',
  continental: 'bg-sky',
  continental_qualifying: 'bg-sky/60',
  promotion: 'bg-grass',
  relegation: 'bg-destructive',
  advance: 'bg-bulb',
};

export const CATEGORY_LABEL: Record<CompetitionTableView['category'], string> =
  {
    national_league: 'Pontos corridos',
    national_cup: 'Mata-mata',
    state: 'Estadual',
    continental: 'Continental',
  };

export const STAGE_STATUS_LABEL: Record<TableStageView['status'], string> = {
  scheduled: 'A definir',
  active: 'Em disputa',
  complete: 'Encerrada',
};

/**
 * Short club name for the narrow table: "Atlético Mineiro" → "Atlético M.",
 * "Red Bull Bragantino" → "RB Bragantino". Names that fit stay whole.
 */
export function shortClubName(name: string, max = 13): string {
  if (name.length <= max) return name;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return `${name.slice(0, max - 1)}.`;
  const [first, ...rest] = words as [string, ...string[]];
  const candidate =
    words.length >= 3
      ? `${words
          .slice(0, -1)
          .map((word) => word[0]!.toUpperCase())
          .join('')} ${words.at(-1)}`
      : `${first} ${rest.map((word) => `${word[0]!.toUpperCase()}.`).join(' ')}`;
  if (candidate.length <= max) return candidate;
  return `${candidate.slice(0, max - 1).trimEnd()}.`;
}

/** Zone of each position: the row's own `zone`, else the group's bands. */
export function zoneOf(
  group: TableGroupView,
  row: TableRowView,
): TableZoneKind | undefined {
  if (row.zone) return row.zone;
  return group.zones.find(
    (zone) => row.position >= zone.from && row.position <= zone.to,
  )?.kind;
}

/** Zones that actually apply to the group, in band order (legend). */
export function legendOf(
  group: TableGroupView,
): readonly { kind: TableZoneKind; label: string }[] {
  const seen = new Set<TableZoneKind>();
  const items: { kind: TableZoneKind; label: string }[] = [];
  for (const zone of [...group.zones].sort((a, b) => a.from - b.from)) {
    if (seen.has(zone.kind)) continue;
    seen.add(zone.kind);
    items.push({ kind: zone.kind, label: zone.label || ZONE_LABEL[zone.kind] });
  }
  for (const row of group.rows) {
    if (row.zone && !seen.has(row.zone)) {
      seen.add(row.zone);
      items.push({ kind: row.zone, label: ZONE_LABEL[row.zone] });
    }
  }
  return items;
}

/** Managed competitions first (the one the Central follows at the top). */
export function orderedCompetitions(
  view: CompetitionTablesView,
): readonly CompetitionTableView[] {
  return [...view.competitions].sort((a, b) => {
    const focusA = a.competitionId === view.focusCompetitionId ? 0 : 1;
    const focusB = b.competitionId === view.focusCompetitionId ? 0 : 1;
    if (focusA !== focusB) return focusA - focusB;
    return Number(b.managed) - Number(a.managed);
  });
}

/** Stage opened first: the one in play, else the last stage. */
export function defaultStageId(table: CompetitionTableView): string {
  const current = table.stages.find(({ id }) => id === table.currentStageId);
  return (current ?? table.stages.at(-1))?.id ?? '';
}

/** Groups with the managed club's group first. */
export function orderedGroups(
  stage: TableStageView,
  club: string,
): readonly TableGroupView[] {
  const mine = stage.groups.find((group) =>
    group.rows.some((row) => row.club.name === club),
  );
  if (!mine) return stage.groups;
  return [mine, ...stage.groups.filter((group) => group !== mine)];
}

export interface TieLegSummary {
  readonly label: string;
  readonly score: string | undefined;
  readonly date: string;
}

export interface TieSummary {
  readonly legs: readonly TieLegSummary[];
  /** "2–2" once at least one leg was played. */
  readonly aggregate: string | undefined;
  readonly winner: TableClubRef | undefined;
  readonly decidedByTiebreak: boolean;
  readonly involves: (club: string) => boolean;
}

/** Scores read home-first for each leg; aggregate from the tie's `home`. */
export function tieSummary(tie: TieView): TieSummary {
  const legs = tie.legs.map((leg) => ({
    label:
      tie.legs.length > 1
        ? leg.leg === 1
          ? 'Ida'
          : leg.leg === 2
            ? 'Volta'
            : `Jogo ${String(leg.leg)}`
        : 'Jogo único',
    score:
      leg.homeGoals === undefined || leg.awayGoals === undefined
        ? undefined
        : `${String(leg.homeGoals)}–${String(leg.awayGoals)}`,
    date: leg.date,
  }));
  const winner =
    tie.winnerClubId === tie.home.id
      ? tie.home
      : tie.winnerClubId === tie.away.id
        ? tie.away
        : undefined;
  return {
    legs,
    aggregate: tie.aggregate
      ? `${String(tie.aggregate.home)}–${String(tie.aggregate.away)}`
      : undefined,
    winner,
    decidedByTiebreak: tie.decidedBy === 'tiebreak',
    involves: (club) => tie.home.name === club || tie.away.name === club,
  };
}

/** Competition the Classificação opens on: the Central's focus, else the first. */
export function initialCompetitionId(
  view: CompetitionTablesView,
  requested?: string,
): string | undefined {
  const ordered = orderedCompetitions(view);
  if (requested && ordered.some((c) => c.competitionId === requested))
    return requested;
  return ordered[0]?.competitionId;
}

/** League rows from the career read model shaped like a table group. */
export function groupFromStandings(
  standings: readonly StandingView[],
  zones: TableGroupView['zones'] = [],
): TableGroupView {
  const rows: TableRowView[] = [...standings]
    .sort((a, b) => a.position - b.position || b.points - a.points)
    .map((row, index) => ({
      position: row.position || index + 1,
      club: { id: row.club, name: row.club },
      played: row.played,
      won: row.won ?? 0,
      drawn: row.drawn ?? 0,
      lost: row.lost ?? 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: row.goalDifference ?? 0,
      points: row.points,
    }));
  return { id: 'league', name: 'Classificação', rows, zones };
}

/**
 * Offline demo: the in-memory career only carries the league the club plays
 * (`career.standings`). When no table lists the club in a league stage, that
 * league takes the place of the table with the same name (zones kept) or is
 * added in front, so the Classificação never hides the live demo table.
 * Over HTTP the server tables already contain the club: nothing changes.
 */
export function withCareerLeague(
  view: CompetitionTablesView,
  career: {
    club: string;
    division?: string;
    standings: readonly StandingView[];
  },
): CompetitionTablesView {
  if (career.standings.length === 0) return view;
  const listed = view.competitions.some((table) =>
    table.stages.some(
      (stage) =>
        stage.kind === 'league' &&
        stage.groups.some((group) =>
          group.rows.some((row) => row.club.name === career.club),
        ),
    ),
  );
  if (listed) return view;
  const name = career.division ?? 'Liga';
  const existing = view.competitions.find((table) => table.name === name);
  const zones =
    existing?.stages.find(({ kind }) => kind === 'league')?.groups[0]?.zones ??
    [];
  const league: CompetitionTableView = {
    competitionId: existing?.competitionId ?? 'career_league',
    name,
    category: existing?.category ?? 'national_league',
    status: 'active',
    managed: true,
    currentStageId: 'league',
    stages: [
      {
        id: 'league',
        name: 'Pontos corridos',
        kind: 'league',
        status: 'active',
        groups: [groupFromStandings(career.standings, zones)],
        ties: [],
        byes: [],
      },
    ],
  };
  return {
    ...view,
    focusCompetitionId: league.competitionId,
    competitions: [
      league,
      ...view.competitions.filter((table) => table !== existing),
    ],
  };
}

const club = (name: string): TableClubRef => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  name,
});

const leagueRow = (
  position: number,
  name: string,
  played: number,
  won: number,
  drawn: number,
  lost: number,
  goalsFor: number,
  goalsAgainst: number,
  zone?: TableZoneKind,
): TableRowView => ({
  position,
  club: club(name),
  played,
  won,
  drawn,
  lost,
  goalsFor,
  goalsAgainst,
  goalDifference: goalsFor - goalsAgainst,
  points: won * 3 + drawn,
  ...(zone ? { zone } : {}),
});

const tie = (
  id: string,
  home: string,
  away: string,
  legs: readonly [number, number][],
  options: { winner?: string; tiebreak?: boolean; dates?: string[] } = {},
): TieView => {
  const h = club(home);
  const a = club(away);
  const played = legs.filter(([x, y]) => x >= 0 && y >= 0);
  const aggregate =
    played.length > 0
      ? played.reduce(
          (sum, [x, y], index) =>
            index % 2 === 0
              ? { home: sum.home + x, away: sum.away + y }
              : { home: sum.home + y, away: sum.away + x },
          { home: 0, away: 0 },
        )
      : undefined;
  return {
    id,
    home: h,
    away: a,
    legs: legs.map(([x, y], index) => ({
      fixtureId: `${id}_l${String(index + 1)}`,
      leg: index + 1,
      date:
        options.dates?.[index] ??
        `2026-0${String(5 + index)}-1${String(index)}`,
      homeClubId: index % 2 === 0 ? h.id : a.id,
      awayClubId: index % 2 === 0 ? a.id : h.id,
      ...(x >= 0 && y >= 0 ? { homeGoals: x, awayGoals: y } : {}),
    })),
    ...(aggregate ? { aggregate } : {}),
    ...(options.winner ? { winnerClubId: club(options.winner).id } : {}),
    ...(options.winner
      ? { decidedBy: options.tiebreak ? 'tiebreak' : 'goals' }
      : {}),
    status: options.winner
      ? 'complete'
      : played.length > 0
        ? 'active'
        : 'scheduled',
  } as TieView;
};

/**
 * Tables of the offline demo and of the component tests: an estadual that
 * is over, the Série A in play (zones), the Copa do Brasil at the quarter
 * finals (one tie on penalties) and the Libertadores with the preliminary
 * decided, groups running and the knockout not drawn yet.
 */
export function demoCompetitionTables(): CompetitionTablesView {
  const serieA: TableGroupView = {
    id: 'serie_a_league',
    name: 'Série A',
    zones: [
      { kind: 'title', label: 'Campeão', from: 1, to: 1 },
      { kind: 'continental', label: 'Libertadores', from: 2, to: 4 },
      {
        kind: 'continental_qualifying',
        label: 'Pré-Libertadores',
        from: 5,
        to: 6,
      },
      { kind: 'relegation', label: 'Rebaixamento', from: 17, to: 20 },
    ],
    rows: [
      leagueRow(1, 'Palmeiras', 12, 9, 2, 1, 24, 8),
      leagueRow(2, 'Flamengo', 12, 8, 3, 1, 22, 9),
      leagueRow(3, 'Atlético Mineiro', 12, 7, 3, 2, 18, 11),
      leagueRow(4, 'Botafogo', 12, 7, 2, 3, 17, 12),
      leagueRow(5, 'Internacional', 12, 6, 3, 3, 15, 12),
      leagueRow(6, 'São Paulo', 12, 5, 5, 2, 14, 10),
      leagueRow(7, 'Fluminense', 12, 5, 4, 3, 13, 11),
      leagueRow(8, 'Grêmio', 12, 5, 3, 4, 12, 12),
      leagueRow(9, 'Bahia', 12, 4, 5, 3, 12, 12),
      leagueRow(10, 'Corinthians', 12, 4, 4, 4, 11, 12),
      leagueRow(11, 'Cruzeiro', 12, 4, 3, 5, 12, 14),
      leagueRow(12, 'Fortaleza', 12, 3, 5, 4, 10, 12),
      leagueRow(13, 'Red Bull Bragantino', 12, 3, 4, 5, 11, 15),
      leagueRow(14, 'Vasco da Gama', 12, 3, 4, 5, 9, 14),
      leagueRow(15, 'Athletico Paranaense', 12, 3, 3, 6, 10, 16),
      leagueRow(16, 'Juventude', 12, 2, 5, 5, 8, 14),
      leagueRow(17, 'Vitória', 12, 2, 4, 6, 9, 17),
      leagueRow(18, 'Criciúma', 12, 2, 3, 7, 8, 18),
      leagueRow(19, 'Cuiabá', 12, 1, 4, 7, 6, 17),
      leagueRow(20, 'Atlético Goianiense', 12, 1, 2, 9, 5, 21),
    ],
  };
  const paulistao: TableGroupView = {
    id: 'paulistao_league',
    name: 'Paulistão',
    zones: [
      { kind: 'title', label: 'Campeão', from: 1, to: 1 },
      { kind: 'relegation', label: 'Rebaixamento', from: 11, to: 12 },
    ],
    rows: [
      leagueRow(1, 'Palmeiras', 11, 8, 2, 1, 21, 7),
      leagueRow(2, 'São Paulo', 11, 7, 2, 2, 17, 9),
      leagueRow(3, 'Corinthians', 11, 6, 3, 2, 15, 10),
      leagueRow(4, 'Red Bull Bragantino', 11, 6, 2, 3, 14, 11),
      leagueRow(5, 'Santos', 11, 5, 3, 3, 13, 11),
      leagueRow(6, 'Ponte Preta', 11, 4, 4, 3, 11, 10),
      leagueRow(7, 'Guarani', 11, 4, 3, 4, 10, 12),
      leagueRow(8, 'Mirassol', 11, 3, 4, 4, 9, 12),
      leagueRow(9, 'Novorizontino', 11, 3, 3, 5, 9, 14),
      leagueRow(10, 'Ituano', 11, 2, 5, 4, 8, 13),
      leagueRow(11, 'Botafogo-SP', 11, 2, 3, 6, 7, 15),
      leagueRow(12, 'Portuguesa', 11, 1, 2, 8, 5, 19),
    ],
  };
  const group = (
    id: string,
    name: string,
    clubs: readonly [string, number, number, number, number, number][],
  ): TableGroupView => ({
    id,
    name,
    zones: [{ kind: 'advance', label: 'Oitavas de final', from: 1, to: 2 }],
    rows: clubs.map(([clubName, won, drawn, lost, gf, ga], index) =>
      leagueRow(
        index + 1,
        clubName,
        won + drawn + lost,
        won,
        drawn,
        lost,
        gf,
        ga,
      ),
    ),
  });
  return {
    aggregateVersion: 12,
    season: 2026,
    focusCompetitionId: 'serie_a',
    competitions: [
      {
        competitionId: 'serie_a',
        name: 'Série A',
        category: 'national_league',
        status: 'active',
        managed: true,
        currentStageId: 'serie_a_league',
        stages: [
          {
            id: 'serie_a_league',
            name: 'Pontos corridos',
            kind: 'league',
            status: 'active',
            groups: [serieA],
            ties: [],
            byes: [],
          },
        ],
      },
      {
        competitionId: 'paulistao',
        name: 'Paulistão',
        category: 'state',
        status: 'complete',
        managed: false,
        currentStageId: 'paulistao_league',
        champion: { club: club('Palmeiras'), decidedOn: '2026-02-14' },
        stages: [
          {
            id: 'paulistao_league',
            name: 'Turno único',
            kind: 'league',
            status: 'complete',
            groups: [paulistao],
            ties: [],
            byes: [],
          },
        ],
      },
      {
        competitionId: 'copa_do_brasil',
        name: 'Copa do Brasil',
        category: 'national_cup',
        status: 'active',
        managed: true,
        currentStageId: 'cdb_quartas',
        stages: [
          {
            id: 'cdb_oitavas',
            name: 'Oitavas de final',
            kind: 'knockout',
            status: 'complete',
            groups: [],
            byes: [],
            ties: [
              tie(
                'cdb_o1',
                'Flamengo',
                'Ceará',
                [
                  [2, 0],
                  [1, 1],
                ],
                { winner: 'Flamengo' },
              ),
              tie(
                'cdb_o2',
                'Palmeiras',
                'Goiás',
                [
                  [1, 0],
                  [0, 0],
                ],
                { winner: 'Palmeiras' },
              ),
              tie(
                'cdb_o3',
                'Grêmio',
                'Bahia',
                [
                  [1, 1],
                  [2, 2],
                ],
                { winner: 'Bahia', tiebreak: true },
              ),
              tie(
                'cdb_o4',
                'Corinthians',
                'Sport',
                [
                  [3, 1],
                  [1, 2],
                ],
                { winner: 'Corinthians' },
              ),
              tie(
                'cdb_o5',
                'Atlético Mineiro',
                'Vasco da Gama',
                [
                  [0, 0],
                  [1, 2],
                ],
                { winner: 'Atlético Mineiro' },
              ),
              tie(
                'cdb_o6',
                'São Paulo',
                'CRB',
                [
                  [2, 1],
                  [0, 0],
                ],
                { winner: 'São Paulo' },
              ),
              tie(
                'cdb_o7',
                'Botafogo',
                'Fortaleza',
                [
                  [1, 0],
                  [1, 1],
                ],
                { winner: 'Botafogo' },
              ),
              tie(
                'cdb_o8',
                'Internacional',
                'Cruzeiro',
                [
                  [0, 1],
                  [1, 2],
                ],
                { winner: 'Cruzeiro' },
              ),
            ],
          },
          {
            id: 'cdb_quartas',
            name: 'Quartas de final',
            kind: 'knockout',
            status: 'active',
            groups: [],
            byes: [],
            ties: [
              tie('cdb_q1', 'Flamengo', 'Palmeiras', [
                [1, 1],
                [-1, -1],
              ]),
              tie('cdb_q2', 'Bahia', 'Corinthians', [
                [0, 2],
                [-1, -1],
              ]),
              tie('cdb_q3', 'Atlético Mineiro', 'São Paulo', [
                [-1, -1],
                [-1, -1],
              ]),
              tie('cdb_q4', 'Botafogo', 'Cruzeiro', [
                [-1, -1],
                [-1, -1],
              ]),
            ],
          },
          {
            id: 'cdb_semis',
            name: 'Semifinal',
            kind: 'knockout',
            status: 'scheduled',
            groups: [],
            byes: [],
            ties: [],
          },
          {
            id: 'cdb_final',
            name: 'Final',
            kind: 'knockout',
            status: 'scheduled',
            groups: [],
            byes: [],
            ties: [],
          },
        ],
      },
      {
        competitionId: 'copa_libertadores',
        name: 'Libertadores',
        category: 'continental',
        status: 'active',
        managed: true,
        currentStageId: 'lib_groups',
        stages: [
          {
            id: 'lib_pre',
            name: 'Pré-Libertadores',
            kind: 'knockout',
            status: 'complete',
            groups: [],
            byes: [
              club('Palmeiras'),
              club('Flamengo'),
              club('Atlético Mineiro'),
            ],
            ties: [
              tie(
                'lib_p1',
                'Botafogo',
                'Bolívar',
                [
                  [2, 0],
                  [1, 1],
                ],
                { winner: 'Botafogo' },
              ),
              tie(
                'lib_p2',
                'Internacional',
                'Nacional',
                [
                  [1, 0],
                  [0, 1],
                ],
                { winner: 'Internacional', tiebreak: true },
              ),
            ],
          },
          {
            id: 'lib_groups',
            name: 'Fase de grupos',
            kind: 'groups',
            status: 'active',
            ties: [],
            byes: [],
            groups: [
              group('lib_a', 'Grupo A', [
                ['Palmeiras', 3, 0, 1, 8, 3],
                ['River Plate', 2, 1, 1, 6, 4],
                ['Bolívar', 1, 1, 2, 4, 6],
                ['Barcelona SC', 0, 2, 2, 2, 7],
              ]),
              group('lib_b', 'Grupo B', [
                ['Flamengo', 3, 1, 0, 9, 2],
                ['Peñarol', 2, 1, 1, 5, 4],
                ['Colo-Colo', 1, 1, 2, 3, 5],
                ['Deportivo Táchira', 0, 1, 3, 1, 7],
              ]),
              group('lib_c', 'Grupo C', [
                ['Boca Juniors', 2, 2, 0, 6, 2],
                ['Atlético Mineiro', 2, 1, 1, 7, 4],
                ['Botafogo', 1, 1, 2, 4, 5],
                ['Universitario', 0, 2, 2, 1, 7],
              ]),
              group('lib_d', 'Grupo D', [
                ['Internacional', 3, 0, 1, 7, 3],
                ['Nacional', 2, 1, 1, 5, 4],
                ['Independiente del Valle', 1, 1, 2, 4, 6],
                ['Cerro Porteño', 0, 2, 2, 2, 5],
              ]),
            ],
          },
          {
            id: 'lib_oitavas',
            name: 'Oitavas de final',
            kind: 'knockout',
            status: 'scheduled',
            groups: [],
            ties: [],
            byes: [],
          },
          {
            id: 'lib_final',
            name: 'Final',
            kind: 'knockout',
            status: 'scheduled',
            groups: [],
            ties: [],
            byes: [],
          },
        ],
      },
    ],
  };
}

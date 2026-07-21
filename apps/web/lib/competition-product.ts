export interface CompetitionView {
  id: string;
  name: string;
  category: 'national_league' | 'national_cup' | 'state' | 'continental';
  tier?: number;
  formatLabel: string;
  currentPhase: string;
  participantCount: number;
  phases: readonly {
    name: string;
    status: 'scheduled' | 'active' | 'complete';
  }[];
  qualifications: readonly { label: string; places: number }[];
  prize: number;
  prestige: number;
}

export interface CompetitionProductView {
  version: 1;
  aggregateVersion: number;
  season: number;
  divisions: readonly CompetitionView[];
  cups: readonly CompetitionView[];
  calendar: {
    status: 'draft' | 'validated' | 'published';
    valid: boolean;
    conflictCount: number;
    entries: readonly {
      id: string;
      date: string;
      competitionName: string;
      phaseName: string;
      label: string;
      status: 'reserved' | 'scheduled' | 'played';
    }[];
  };
  nextSeason: {
    season: number;
    status: 'pending' | 'ready' | 'generated';
    movements: readonly {
      clubName: string;
      fromDivision: string;
      toDivision: string;
      kind: 'promoted' | 'relegated';
    }[];
    qualifiers: readonly {
      clubName: string;
      competitionName: string;
      route: string;
    }[];
    awards: readonly {
      label: string;
      prize: number;
      prestige: number;
    }[];
  };
}

export interface CompetitionProductPort {
  load(): Promise<CompetitionProductView>;
}

const league = (
  id: string,
  name: string,
  tier: number,
  prize: number,
  prestige: number,
): CompetitionView => ({
  id,
  name,
  category: 'national_league',
  tier,
  formatLabel: 'Pontos corridos · turno e returno',
  currentPhase: 'Temporada encerrada',
  participantCount: 20,
  phases: [{ name: 'Liga nacional', status: 'complete' }],
  qualifications:
    tier === 1
      ? [
          { label: 'Libertadores', places: 6 },
          { label: 'Rebaixamento', places: 4 },
        ]
      : [
          { label: 'Acesso', places: 4 },
          ...(tier === 2 ? [{ label: 'Rebaixamento', places: 4 }] : []),
        ],
  prize,
  prestige,
});

export function createFakeCompetitionProductPort(): CompetitionProductPort {
  const value: CompetitionProductView = {
    version: 1,
    aggregateVersion: 12,
    season: 2026,
    divisions: [
      league('serie_a', 'Série A', 1, 48_000_000, 1200),
      league('serie_b', 'Série B', 2, 18_000_000, 700),
      league('serie_c', 'Série C', 3, 8_000_000, 420),
    ],
    cups: [
      {
        id: 'copa_brasil',
        name: 'Copa do Brasil',
        category: 'national_cup',
        formatLabel: 'Mata-mata · ida e volta',
        currentPhase: 'Final',
        participantCount: 64,
        phases: [{ name: 'Mata-mata', status: 'complete' }],
        qualifications: [{ label: 'Libertadores', places: 1 }],
        prize: 32_000_000,
        prestige: 900,
      },
      {
        id: 'paulistao',
        name: 'Paulistão',
        category: 'state',
        formatLabel: 'Turno único · São Paulo',
        currentPhase: 'Classificação final',
        participantCount: 16,
        phases: [{ name: 'Turno único', status: 'complete' }],
        qualifications: [],
        prize: 5_000_000,
        prestige: 240,
      },
      {
        id: 'libertadores',
        name: 'Libertadores',
        category: 'continental',
        formatLabel: 'Pré · grupos · mata-mata',
        currentPhase: 'Final',
        participantCount: 47,
        phases: [
          { name: 'Pré-Libertadores', status: 'complete' },
          { name: 'Fase de grupos', status: 'complete' },
          { name: 'Mata-mata', status: 'complete' },
        ],
        qualifications: [],
        prize: 128_000_000,
        prestige: 1800,
      },
    ],
    calendar: {
      status: 'validated',
      valid: true,
      conflictCount: 0,
      entries: [
        {
          id: 'cal_state',
          date: '2026-03-22',
          competitionName: 'Paulistão',
          phaseName: 'Turno único',
          label: 'Rodada final estadual',
          status: 'played',
        },
        {
          id: 'cal_cup',
          date: '2026-11-15',
          competitionName: 'Copa do Brasil',
          phaseName: 'Final',
          label: 'Final · volta',
          status: 'played',
        },
        {
          id: 'cal_continental',
          date: '2026-11-28',
          competitionName: 'Libertadores',
          phaseName: 'Final',
          label: 'Final continental',
          status: 'played',
        },
        {
          id: 'cal_league',
          date: '2026-12-06',
          competitionName: 'Série A',
          phaseName: 'Liga nacional',
          label: '38ª rodada',
          status: 'played',
        },
      ],
    },
    nextSeason: {
      season: 2027,
      status: 'ready',
      movements: [
        {
          clubName: 'Sport',
          fromDivision: 'Série B',
          toDivision: 'Série A',
          kind: 'promoted',
        },
        {
          clubName: 'Vitória',
          fromDivision: 'Série A',
          toDivision: 'Série B',
          kind: 'relegated',
        },
      ],
      qualifiers: [
        {
          clubName: 'Flamengo',
          competitionName: 'Libertadores',
          route: 'Campeão da Copa do Brasil',
        },
      ],
      awards: [
        { label: 'Campeão da Série A', prize: 48_000_000, prestige: 1200 },
        {
          label: 'Campeão da Copa do Brasil',
          prize: 32_000_000,
          prestige: 900,
        },
      ],
    },
  };
  return { load: async () => structuredClone(value) };
}

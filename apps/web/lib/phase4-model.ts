export type ContractDecision = 'active' | 'expiring' | 'renewed' | 'refused';
export type TransferKind = 'buy' | 'loan';
export type OfferStatus = 'none' | 'countered' | 'accepted';

export interface ContractView {
  playerId: string;
  playerName: string;
  monthsRemaining: number;
  salary: number;
  renewalDemand: number;
  status: ContractDecision;
}

export interface MarketPlayerView {
  id: string;
  name: string;
  club: string;
  position: string;
  age: number;
  strength: number;
  value: number;
  salary: number;
  availability: 'transfer' | 'loan' | 'free-agent';
  scouted: boolean;
  potentialEstimate: string;
  adaptationEstimate: string;
  offerStatus: OfferStatus;
  counterAmount?: number | undefined;
  pendingKind?: TransferKind | undefined;
}

export interface LedgerEntryView {
  id: string;
  date: string;
  sourceLabel: string;
  category:
    | 'wages'
    | 'transfer'
    | 'tickets'
    | 'sponsor'
    | 'prize'
    | 'stadium'
    | 'contract';
  amount: number;
  balance: number;
}

export type YouthReadiness = 'ready' | 'close' | 'developing';

export interface YouthPlayerView {
  id: string;
  name: string;
  /** Short position label (GOL, ZAG, ATA...). */
  position: string;
  age: number;
  generated: true;
  /** Visible strength (potential stays an estimate). */
  strength: number;
  /** Strength when the kid joined the academy. */
  initialStrength?: number;
  potentialEstimate: string;
  /** Characteristics in Portuguese (one or two). */
  traits: readonly string[];
  /** "Jovem destaque" of an intake. */
  highlight: boolean;
  readiness: YouthReadiness;
  /** Old enough and there is room in the squad. */
  promotable: boolean;
  status: 'academy' | 'promoted' | 'released';
  joinedOn?: string;
}

export interface AcademyView {
  prospects: number;
  capacity: number;
  nextIntakeOn: string;
  squadSize: number;
  maxSquadSize: number;
  minPromotionAge: number;
  maxAge: number;
  /** Short position labels the first team is short of. */
  needs: readonly string[];
}

/** How the calling club compares with the current one. */
export type JobComparison = 'bigger' | 'similar' | 'smaller';

export interface JobProposalView {
  id: string;
  club: string;
  division: string;
  /** Why the club called, in Portuguese. */
  objective: string;
  reputation?: number;
  comparison?: JobComparison;
  expiresOn?: string;
}

export type ExpansionPlanId = 'small' | 'medium' | 'large';
export type MaintenancePlanId = 'repairs' | 'renovation' | 'modernization';

export interface StadiumView {
  name: string;
  capacity: number;
  maxCapacity: number;
  /** Average home crowd of the season (0 before the first home match). */
  averageCrowd: number;
  lastCrowd?: number;
  homeMatches: number;
  /** Fans who want a ticket for an ordinary league match now. */
  demand: number;
  /** Crowd that fits (demand capped by the seats). */
  expectedCrowd: number;
  ticketPrice: number;
  /** Price the crowd judges by; it grows with the size of the club. */
  referencePrice: number;
  /** Pitch, stands and facilities (0-100). */
  quality: number;
  lastMaintenanceOn?: string;
  /** Works in progress. */
  works?: { addedCapacity: number; completesOn: string; cost: number };
  expansionPlans: readonly {
    id: ExpansionPlanId;
    addedCapacity: number;
    cost: number;
    days: number;
    completesOn: string;
  }[];
  maintenancePlans: readonly {
    id: MaintenancePlanId;
    qualityGain: number;
    cost: number;
  }[];
}

export interface RankingRowView {
  position: number;
  coach: string;
  club: string;
  points: number;
  highlight?: boolean;
}

export interface Phase4View {
  contracts: readonly ContractView[];
  contractAlerts: readonly string[];
  market: readonly MarketPlayerView[];
  finances: {
    cash: number;
    wageBill: number;
    wageBudget: number;
    transferGate: number;
    sponsor: string;
    ledger: readonly LedgerEntryView[];
  };
  stadium: StadiumView;
  youth: readonly YouthPlayerView[];
  academy?: AcademyView;
  board: {
    confidence: number;
    fanConfidence: number;
    objective: string;
    status: string;
    firingRisk: string;
    proposals: readonly JobProposalView[];
  };
  news: readonly {
    id: string;
    tag: string;
    headline: string;
    detail: string;
    /** Game date (`YYYY-MM-DD`) when the server records it. */
    date?: string;
    /** Inbox message still waiting for a decision (answered in the Central). */
    pending?: boolean;
    /** Inbox message the coach has not seen yet (badge of the inbox). */
    unread?: boolean;
    /** Inbox message the coach may remove (`DeleteInboxMessage`). */
    deletable?: boolean;
  }[];
  history: {
    seasons: readonly {
      season: string;
      club: string;
      finish: string;
      topScorer: string;
    }[];
    champions: readonly { season: string; competition: string; club: string }[];
    records: readonly { label: string; value: string; holder: string }[];
    idols: readonly { name: string; reason: string }[];
  };
  prestige: {
    points: number;
    level: string;
    titles: number;
    promotions: number;
    seasons: number;
  };
  leaderboards: {
    global: readonly RankingRowView[];
    underdog: readonly RankingRowView[];
    monthly: readonly RankingRowView[];
  };
  archive: {
    saveVersion: string;
    migrationStatus: string;
    archiveStatus: string;
    lastCompaction: string;
    checksum: string;
  };
}

const ledger: LedgerEntryView[] = [
  {
    id: 'l-5',
    date: '08/07',
    sourceLabel: 'Premiação · Copa do Brasil',
    category: 'prize',
    amount: 1200000,
    balance: 38600000,
  },
  {
    id: 'l-4',
    date: '07/07',
    sourceLabel: 'Folha salarial · Rodada 7',
    category: 'wages',
    amount: -920000,
    balance: 37400000,
  },
  {
    id: 'l-3',
    date: '06/07',
    sourceLabel: 'Bilheteria · Flamengo × Bahia',
    category: 'tickets',
    amount: 1840000,
    balance: 38320000,
  },
  {
    id: 'l-2',
    date: '01/07',
    sourceLabel: 'Patrocínio · Cota mensal',
    category: 'sponsor',
    amount: 2400000,
    balance: 36480000,
  },
  {
    id: 'l-1',
    date: '30/06',
    sourceLabel: 'Transferência · venda de Matheus Gonçalves',
    category: 'transfer',
    amount: 5800000,
    balance: 34080000,
  },
];

export function createPhase4View(coach: string, club: string): Phase4View {
  return {
    contracts: [
      {
        playerId: 'fla-27',
        playerName: 'Bruno Henrique',
        monthsRemaining: 2,
        salary: 420000,
        renewalDemand: 470000,
        status: 'expiring',
      },
      {
        playerId: 'fla-21',
        playerName: 'Jorginho',
        monthsRemaining: 5,
        salary: 520000,
        renewalDemand: 540000,
        status: 'expiring',
      },
      {
        playerId: 'fla-64',
        playerName: 'Wallace Yan',
        monthsRemaining: 18,
        salary: 95000,
        renewalDemand: 130000,
        status: 'active',
      },
    ],
    contractAlerts: [
      'Bruno Henrique pode assinar pré-contrato em 2 meses.',
      'Jorginho aguarda uma decisão até a rodada 10.',
    ],
    market: [
      {
        id: 'm-scarpa',
        name: 'Gustavo Scarpa',
        club: 'Atlético Mineiro',
        position: 'MEI',
        age: 32,
        strength: 80,
        value: 13500000,
        salary: 360000,
        availability: 'transfer',
        scouted: true,
        potentialEstimate: 'no auge',
        adaptationEstimate: 'adaptação rápida',
        offerStatus: 'none',
      },
      {
        id: 'm-esquivel',
        name: 'Lucas Esquivel',
        club: 'Athletico Paranaense',
        position: 'LE',
        age: 22,
        strength: 74,
        value: 9200000,
        salary: 170000,
        availability: 'loan',
        scouted: false,
        potentialEstimate: 'bom espaço para evoluir',
        adaptationEstimate: 'a observar',
        offerStatus: 'none',
      },
      {
        id: 'm-vitao',
        name: 'Vitão',
        club: 'Atlético Mineiro',
        position: 'ZAG',
        age: 26,
        strength: 78,
        value: 11800000,
        salary: 260000,
        availability: 'transfer',
        scouted: false,
        potentialEstimate: 'próximo do auge',
        adaptationEstimate: 'perfil compatível',
        offerStatus: 'none',
      },
      {
        id: 'm-gilberto',
        name: 'Gilberto',
        club: 'Sem clube',
        position: 'LD',
        age: 31,
        strength: 69,
        value: 0,
        salary: 110000,
        availability: 'free-agent',
        scouted: true,
        potentialEstimate: 'experiente',
        adaptationEstimate: 'adaptação imediata',
        offerStatus: 'none',
      },
    ],
    finances: {
      cash: 38600000,
      wageBill: 920000,
      wageBudget: 1150000,
      transferGate: 8000000,
      sponsor: 'Cota nacional · R$ 2,4 mi/mês',
      ledger,
    },
    stadium: {
      name: 'Maracanã',
      capacity: 78838,
      maxCapacity: 90000,
      averageCrowd: 61240,
      lastCrowd: 64410,
      homeMatches: 6,
      demand: 70200,
      expectedCrowd: 70200,
      ticketPrice: 65,
      referencePrice: 68,
      quality: 58,
      expansionPlans: [
        {
          id: 'small',
          addedCapacity: 2000,
          cost: 3000000,
          days: 90,
          completesOn: '2026-10-06',
        },
        {
          id: 'medium',
          addedCapacity: 5000,
          cost: 9000000,
          days: 150,
          completesOn: '2026-12-05',
        },
        {
          id: 'large',
          addedCapacity: 10000,
          cost: 22000000,
          days: 240,
          completesOn: '2027-03-05',
        },
      ],
      maintenancePlans: [
        { id: 'repairs', qualityGain: 10, cost: 1182570 },
        { id: 'renovation', qualityGain: 25, cost: 2759330 },
        { id: 'modernization', qualityGain: 42, cost: 5150855 },
      ],
    },
    youth: [
      {
        id: 'y-1',
        name: 'Caio Nascimento',
        position: 'ATA',
        age: 18,
        generated: true,
        strength: 57,
        initialStrength: 53,
        potentialEstimate: 'alto',
        traits: ['Finalização', 'Velocidade'],
        highlight: true,
        readiness: 'close',
        promotable: true,
        status: 'academy',
      },
      {
        id: 'y-2',
        name: 'Ruan Teles',
        position: 'VOL',
        age: 16,
        generated: true,
        strength: 49,
        initialStrength: 48,
        potentialEstimate: 'bom',
        traits: ['Marcação'],
        highlight: false,
        readiness: 'developing',
        promotable: false,
        status: 'academy',
      },
      {
        id: 'y-3',
        name: 'Davi Lessa',
        position: 'GOL',
        age: 19,
        generated: true,
        strength: 60,
        initialStrength: 55,
        potentialEstimate: 'bom',
        traits: ['Reflexos', 'Colocação'],
        highlight: false,
        readiness: 'ready',
        promotable: true,
        status: 'academy',
      },
    ],
    academy: {
      prospects: 3,
      capacity: 14,
      nextIntakeOn: '2026-08-01',
      squadSize: 30,
      maxSquadSize: 35,
      minPromotionAge: 17,
      maxAge: 20,
      needs: ['GOL', 'LE'],
    },
    board: {
      confidence: 72,
      fanConfidence: 81,
      objective:
        'Classificar para a Libertadores e chegar à semifinal da Copa do Brasil.',
      status: 'Trabalho respaldado',
      firingRisk: 'baixo; duas derrotas seguidas aumentam a pressão',
      proposals: [
        {
          id: 'job-bahia',
          club: 'Bahia',
          division: 'Série A',
          objective: 'Disputar vaga continental',
          reputation: 74,
          comparison: 'similar',
          expiresOn: '2026-07-29',
        },
        {
          id: 'job-athletico',
          club: 'Athletico Paranaense',
          division: 'Série A',
          objective: 'Reconstruir elenco jovem',
          reputation: 72,
          comparison: 'smaller',
          expiresOn: '2026-07-29',
        },
      ],
    },
    news: [
      {
        id: 'n-1',
        unread: true,
        tag: 'Mercado',
        headline: 'Gustavo Scarpa entra no radar do Flamengo',
        detail: 'O relatório destaca criação por dentro e bola parada.',
      },
      {
        id: 'n-2',
        unread: true,
        tag: 'Diretoria',
        headline: 'Confiança cresce após sequência invicta',
        detail: `${coach} recebe respaldo antes da rodada decisiva.`,
      },
      {
        id: 'n-3',
        unread: true,
        tag: 'Base',
        headline: 'Davi Lessa chama atenção nos treinos',
        detail:
          'O jovem gerado pelo universo já pode compor o elenco principal.',
      },
    ],
    history: {
      seasons: [
        {
          season: '2025',
          club,
          finish: 'Campeão brasileiro',
          topScorer: 'Pedro · 23 gols',
        },
        {
          season: '2024',
          club,
          finish: '3º na Série A',
          topScorer: 'Bruno Henrique · 17 gols',
        },
      ],
      champions: [
        { season: '2025', competition: 'Série A', club },
        { season: '2025', competition: 'Copa do Brasil', club: 'Palmeiras' },
      ],
      records: [
        { label: 'Mais vitórias numa temporada', value: '31', holder: club },
        { label: 'Maior sequência invicta', value: '18 jogos', holder: club },
      ],
      idols: [
        {
          name: 'Giorgian de Arrascaeta',
          reason: '112 jogos · 38 gols · 3 títulos',
        },
        { name: 'Pedro', reason: 'Artilheiro em duas temporadas' },
      ],
    },
    prestige: {
      points: 1840,
      level: 'Referência nacional',
      titles: 2,
      promotions: 0,
      seasons: 3,
    },
    leaderboards: {
      global: [
        { position: 1, coach: 'Ana Ribeiro', club: 'Fortaleza', points: 2340 },
        { position: 2, coach, club, points: 1840, highlight: true },
        { position: 3, coach: 'João Lima', club: 'Santos', points: 1760 },
      ],
      underdog: [
        { position: 1, coach: 'Bia Nunes', club: 'Ferroviária', points: 980 },
        { position: 8, coach, club, points: 310, highlight: true },
      ],
      monthly: [
        { position: 1, coach, club, points: 280, highlight: true },
        { position: 2, coach: 'Caio Souza', club: 'Ceará', points: 240 },
      ],
    },
    archive: {
      saveVersion: '4.0.0',
      migrationStatus: 'Atualizado · schema 4',
      archiveStatus: 'Temporadas 2023–2024 compactadas',
      lastCompaction: '08/07/2026 · 02:15',
      checksum: 'save:9f2a…c814',
    },
  };
}

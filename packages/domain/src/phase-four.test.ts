import { describe, expect, it } from 'vitest';
import {
  acceptJobProposal,
  accountBalance,
  appendLedgerEntry,
  calculateAttendance,
  completeAcceptedOffer,
  createContract,
  createClubIncomeTransaction,
  createLedger,
  createPlayer,
  createStadium,
  createTransferOffer,
  createWageTransaction,
  developPlayer,
  entityId,
  evaluateRenewal,
  freeAgentIds,
  generateYouthCandidates,
  money,
  percentage,
  projectLeaderboards,
  projectSeasonHistory,
  promoteYouth,
  releaseYouth,
  returnLoan,
  rollDivisions,
  scoutPlayer,
  searchTransferMarket,
  strength,
  transitionOffer,
  type ClubId,
  type ManagerCareer,
  type Player,
  type PlayerId,
  type RandomSource,
} from './index.js';

const clubId = (value: string): ClubId => entityId(`club_${value}`, 'club');
const playerId = (value: string): PlayerId =>
  entityId(`player_${value}`, 'player');

function player(
  id = playerId('one'),
  owner: ClubId | null = clubId('a'),
): Player {
  return createPlayer({
    id,
    name: 'Atleta de teste',
    age: 22,
    position: 'ST',
    secondaryPositions: ['RW'],
    strength: strength(70),
    traits: ['finishing'],
    hidden: {
      potential: percentage(85),
      consistency: percentage(72),
      injuryProneness: percentage(15),
      adaptation: percentage(66),
      professionalism: percentage(90),
      bigGame: percentage(75),
    },
    morale: percentage(70),
    condition: percentage(100),
    matchSharpness: percentage(80),
    value: money(1_000_000),
    salary: money(20_000),
    ...(owner === null ? {} : { clubId: owner }),
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
}

class SequenceRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index++;
    return value;
  }
}

describe('phase four financial invariants', () => {
  it('accepts only balanced immutable entries and conserves every cent', () => {
    const a = clubId('a');
    const transaction = {
      id: 'ledger_transfer_1',
      occurredAt: '2026-07-21T12:00:00.000Z',
      source: {
        type: 'transfer' as const,
        offerId: 'offer_1',
        playerId: 'player_one',
      },
      postings: [
        { account: `club:${a}:cash` as const, amount: money(-500), clubId: a },
        {
          account: `club:${a}:expense:transfer` as const,
          amount: money(500),
          clubId: a,
        },
      ],
    };
    const ledger = appendLedgerEntry(createLedger(), transaction);
    expect(
      ledger.entries[0]?.postings.reduce(
        (sum, posting) => sum + posting.amount,
        0,
      ),
    ).toBe(0);
    expect(accountBalance(ledger, `club:${a}:cash`)).toBe(-500);
    expect(Object.isFrozen(ledger.entries[0]?.postings)).toBe(true);
    expect(() =>
      appendLedgerEntry(createLedger(), {
        ...transaction,
        postings: transaction.postings.slice(0, 1),
      }),
    ).toThrow('at least two');
    const wages = createWageTransaction({
      id: 'ledger_wages_1',
      occurredAt: '2026-07-21T12:00:00.000Z',
      clubId: a,
      period: '2026-r1',
      amount: money(1_000),
    });
    const gate = createClubIncomeTransaction({
      id: 'ledger_gate_1',
      occurredAt: '2026-07-21T12:00:00.000Z',
      clubId: a,
      amount: money(2_000),
      source: { type: 'gate', matchId: 'match_1', attendance: 100 },
    });
    const sponsor = createClubIncomeTransaction({
      id: 'ledger_sponsor_1',
      occurredAt: '2026-07-21T12:00:00.000Z',
      clubId: a,
      amount: money(3_000),
      source: { type: 'sponsor', agreementId: 'sponsor_1', period: '2026-r1' },
    });
    const prize = createClubIncomeTransaction({
      id: 'ledger_prize_1',
      occurredAt: '2026-07-21T12:00:00.000Z',
      clubId: a,
      amount: money(4_000),
      source: { type: 'prize', competitionId: 'league_1', season: 2026 },
    });
    const complete = createLedger([transaction, wages, gate, sponsor, prize]);
    expect(complete.entries.map(({ source }) => source.type)).toEqual([
      'transfer',
      'wages',
      'gate',
      'sponsor',
      'prize',
    ]);
    expect(
      complete.entries
        .flatMap(({ postings }) => postings)
        .reduce((sum, posting) => sum + posting.amount, 0),
    ).toBe(0);
  });

  it('models the monotonic price versus crowd trade-off within capacity', () => {
    const common = {
      capacity: 10_000,
      referencePrice: money(3_000),
      homeReputation: 60,
      awayReputation: 55,
      importance: 70,
      recentForm: 5,
    };
    const cheap = calculateAttendance({ ...common, ticketPrice: money(2_000) });
    const expensive = calculateAttendance({
      ...common,
      ticketPrice: money(8_000),
    });
    expect(cheap).toBeGreaterThan(expensive);
    expect(cheap).toBeLessThanOrEqual(common.capacity);
    expect(
      createStadium({
        clubId: clubId('a'),
        capacity: 1_000,
        ticketPrice: money(1),
        maintenance: money(1),
        quality: 50,
      }).capacity,
    ).toBe(1_000);
  });
});

describe('contracts and transfer invariants', () => {
  it('supports refusal, renewal and free agents without contradictory active ownership', () => {
    const athlete = player();
    const contract = createContract({
      id: 'contract_1',
      playerId: athlete.id,
      clubId: clubId('a'),
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      wage: money(20_000),
      status: 'active',
      terminationCost: money(50_000),
      revision: 1,
    });
    expect(
      evaluateRenewal(
        contract,
        { wage: money(1), endsOn: '2027-12-31' },
        athlete,
        60,
      ),
    ).toBe('refuse');
    expect(freeAgentIds([player(playerId('free'), null)], [contract])).toEqual([
      playerId('free'),
    ]);
  });

  it('moves ownership for purchases and preserves owning club across a loan return', () => {
    const athlete = player();
    const buy = transitionOffer(
      createTransferOffer({
        id: 'offer_buy',
        kind: 'buy',
        playerId: athlete.id,
        fromClubId: clubId('a'),
        toClubId: clubId('b'),
        fee: money(1_000_000),
        wage: money(25_000),
        createdOn: '2026-07-01',
        expiresOn: '2026-07-10',
        status: 'pending',
        revision: 1,
      }),
      'accepted',
    );
    expect(completeAcceptedOffer(buy, athlete).player.clubId).toBe(clubId('b'));
    const loanOffer = transitionOffer(
      createTransferOffer({
        ...buy,
        id: 'offer_loan',
        kind: 'loan',
        status: 'pending',
        revision: 1,
        loan: { endsOn: '2027-01-01', wageSharePercentage: 50 },
      }),
      'accepted',
    );
    const loaned = completeAcceptedOffer(loanOffer, athlete);
    const loan = loaned.loan;
    expect(loan?.owningClubId).toBe(clubId('a'));
    if (loan === undefined) throw new Error('expected loan record');
    expect(returnLoan(loan, loaned.player, '2027-01-01').player.clubId).toBe(
      clubId('a'),
    );
    expect(() => returnLoan(loan, loaned.player, '2026-12-31')).toThrow();
  });

  it('never leaks exact hidden attributes through search or scouting projections', () => {
    const athlete = player();
    const search = searchTransferMarket([athlete], {
      text: 'teste',
      position: 'ST',
    });
    const report = scoutPlayer(athlete, '2026-07-21');
    expect(search).toHaveLength(1);
    expect(JSON.stringify(search)).not.toContain('potential');
    expect(report.estimates.potential).toBe('excellent');
    expect(JSON.stringify(report)).not.toContain('85');
  });
});

describe('renewal of the player universe', () => {
  it('generates a limited deterministic, explicitly derived youth cohort', () => {
    let id = 0;
    const generated = generateYouthCandidates({
      clubId: clubId('a'),
      seed: 'season-1',
      generatorVersion: 'youth-v1',
      maximumCandidates: 2,
      existingCandidates: 0,
      currentSeason: 2026,
      nextId: () => `generated_youth_${String(++id)}`,
      random: new SequenceRandom([0.1, 0.2, 0.3, 0.4]),
    });
    expect(generated).toHaveLength(2);
    expect(generated[0]?.provenance).toMatchObject({
      kind: 'generated_youth',
      seed: 'season-1',
    });
    expect(generated[0]?.player.name).toContain('gerado');
    const first = generated[0];
    const second = generated[1];
    if (first === undefined || second === undefined)
      throw new Error('expected generated youth');
    const promoted = promoteYouth(first, 20, 35);
    expect(promoted.status).toBe('promoted');
    expect(releaseYouth(second).player.clubId).toBeUndefined();
  });

  it('bounds evolution, allows stagnation and emits replacement hooks on retirement', () => {
    const evolved = developPlayer(player(), {
      usefulMinutes: 3_000,
      developmentQuality: 100,
      random: new SequenceRandom([0.99]),
    });
    expect(evolved.strengthDelta).toBeGreaterThanOrEqual(-3);
    expect(evolved.strengthDelta).toBeLessThanOrEqual(3);
    const veteran = createPlayer({ ...player(), age: 40 });
    const retired = developPlayer(veteran, {
      usefulMinutes: 0,
      developmentQuality: 20,
      random: new SequenceRandom([0]),
    });
    expect(retired).toMatchObject({
      outcome: 'retired',
      replacementRequired: true,
    });
  });
});

describe('manager continuity, history and rankings', () => {
  it('switches clubs while preserving manager identity, prestige, seasons and appointments', () => {
    const career: ManagerCareer = {
      managerId: 'manager_1',
      currentClubId: clubId('a'),
      employmentStatus: 'employed',
      boardConfidence: 40,
      fanConfidence: 50,
      prestige: 90,
      seasons: 4,
      appointments: [{ clubId: clubId('a'), joinedOn: '2022-01-01' }],
    };
    const result = acceptJobProposal(
      career,
      {
        id: 'proposal_1',
        clubId: clubId('b'),
        offeredOn: '2026-01-01',
        expiresOn: '2026-01-30',
        minimumPrestige: 80,
        status: 'open',
      },
      '2026-01-10',
    );
    expect(result.career).toMatchObject({
      managerId: 'manager_1',
      currentClubId: clubId('b'),
      prestige: 90,
      seasons: 4,
    });
    expect(result.career.appointments).toHaveLength(2);
  });

  it('projects seasons, all-time/underdog/monthly rankings and two-division movement', () => {
    const history = projectSeasonHistory(
      [
        {
          id: 'history_1',
          type: 'title',
          season: 2026,
          occurredOn: '2026-12-01',
          clubId: clubId('a'),
          competitionId: 'league_1',
        },
        {
          id: 'history_2',
          type: 'top_scorer',
          season: 2026,
          occurredOn: '2026-12-01',
          playerId: playerId('one'),
          competitionId: 'league_1',
          value: 20,
        },
      ],
      2026,
    );
    expect(history.champions[0]?.clubId).toBe(clubId('a'));
    const boards = projectLeaderboards(
      [
        {
          id: 'achievement_1',
          managerId: 'manager_1',
          occurredOn: '2026-07-01',
          type: 'promotion',
          clubReputation: 20,
        },
        {
          id: 'achievement_2',
          managerId: 'manager_2',
          occurredOn: '2026-06-01',
          type: 'league_title',
          clubReputation: 90,
        },
      ],
      '2026-07',
    );
    expect(boards.monthly).toHaveLength(1);
    expect(boards.underdog[0]?.managerId).toBe('manager_1');
    const moved = rollDivisions(
      {
        divisionId: 'a',
        orderedClubIds: [clubId('a'), clubId('b')],
        promotionPlaces: 0,
        relegationPlaces: 1,
      },
      {
        divisionId: 'b',
        orderedClubIds: [clubId('c'), clubId('d')],
        promotionPlaces: 1,
        relegationPlaces: 0,
      },
    );
    expect(moved.promoted).toEqual([clubId('c')]);
    expect(moved.relegated).toEqual([clubId('b')]);
  });
});

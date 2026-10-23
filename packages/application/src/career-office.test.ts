/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the clubs picked here */
import {
  accountBalance,
  money,
  type ClubId,
  type CompetitionCalendarFixture,
} from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  CHEMISTRY_GAIN,
  CHEMISTRY_MAX_BONUS,
  MEMBERSHIP_PRICE_MAX,
  MEMBERSHIP_PRICE_MIN,
  MEMBERSHIP_TIER_TABLE,
  NEUTRAL_SPONSOR_SHARE,
  OfficeRuleError,
  SPONSOR_FALLBACK_SHARE,
  SPONSOR_NAMES,
  catalogCareerContent,
  chemistryBonusPercent,
  chemistryFactor,
  clubWageBill,
  configureMembership,
  counterRange,
  counterSponsorOffer,
  createCareerWorld,
  decideSponsorOffer,
  defaultMembershipPlan,
  employManager,
  financesByCategory,
  managedMembership,
  membershipAttendanceBonus,
  membershipFanEffect,
  membershipMembers,
  membershipReferencePrice,
  nextChemistry,
  paySponsorBonuses,
  readOffice,
  recordGate,
  runOfficeDay,
  settleMonths,
  sponsorTolerance,
  withStrengthFactor,
  type MembershipTier,
  type WorldContext,
} from './index.js';

const SEED = 'career-seed:office-test';
const MANAGED = 'club_flamengo' as ClubId;
const content = catalogCareerContent.load();

function world(clubId: ClubId = MANAGED): WorldContext {
  const context: WorldContext = {
    clubs: [...content.clubs],
    players: [...content.players],
    world: createCareerWorld(
      content.clubs,
      content.players,
      '2026-01-01',
      'manager_office',
    ),
    divisions: content.divisions,
    managedForm: [],
  };
  employManager(context, clubId, '2026-01-01', 'serie-a', 1);
  runOfficeDay(context, '2026-01-01', SEED, 1);
  return context;
}

const pending = (context: WorldContext) =>
  readOffice(context.world).sponsorOffers.filter(
    ({ status }) => status === 'pending',
  );

const sponsorIncome = (context: WorldContext, clubId: string) =>
  context.world.ledger.entries.filter(
    ({ source, postings }) =>
      source.type === 'sponsor' &&
      postings.some(({ account }) => account === `club:${clubId}:cash`),
  );

describe('patrocínio negociável (ADR 0011)', () => {
  it('gera três propostas determinísticas por temporada, com nomes fictícios', () => {
    const context = world();
    const offers = pending(context);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map(({ sponsorName }) => sponsorName)).size).toBe(3);
    for (const offer of offers) {
      expect(SPONSOR_NAMES).toContain(offer.sponsorName);
      expect(offer.monthlyValue).toBeGreaterThan(0);
      expect(offer.terminationFee).toBeGreaterThan(0);
      expect(offer.bonuses.title).toBeGreaterThan(0);
      expect(offer.bonuses.continental).toBeGreaterThan(0);
      // Série A clubs cannot be promoted.
      expect(offer.bonuses.promotion).toBe(0);
    }
    expect(world().world.office).toEqual(context.world.office);
    runOfficeDay(context, '2026-01-20', SEED, 1);
    expect(readOffice(context.world).sponsorOffers).toHaveLength(3);
    runOfficeDay(context, '2027-01-01', SEED, 2);
    const next = readOffice(context.world).sponsorOffers;
    expect(next.filter(({ status }) => status === 'expired')).toHaveLength(3);
    expect(next.filter(({ status }) => status === 'pending')).toHaveLength(3);
  });

  it('dá valores maiores a clubes de mais reputação e divisão mais alta', () => {
    const big = Math.max(...pending(world()).map((o) => o.monthlyValue));
    const small = Math.max(
      ...pending(world('club_maranhao' as ClubId)).map((o) => o.monthlyValue),
    );
    expect(big).toBeGreaterThan(small * 5);
    const serieC = pending(world('club_maranhao' as ClubId));
    expect(serieC.some(({ bonuses }) => bonuses.promotion > 0)).toBe(true);
  });

  it('aceitar assina contrato, substitui o patrocínio fixo e lança a receita mensal', () => {
    const context = world();
    const [offer, ...others] = pending(context);
    decideSponsorOffer(context.world, offer!.id, 'accept', '2026-01-05');
    const contract = readOffice(context.world).sponsorContracts[0]!;
    expect(contract).toMatchObject({
      status: 'active',
      monthlyValue: offer!.monthlyValue,
      startMonth: '2026-01',
    });
    for (const other of others)
      expect(
        readOffice(context.world).sponsorOffers.find(
          ({ id }) => id === other.id,
        )?.status,
      ).toBe('superseded');
    settleMonths(context, '2026-03-01');
    const income = sponsorIncome(context, MANAGED);
    expect(income).toHaveLength(2);
    for (const entry of income) {
      expect(entry.source).toMatchObject({ agreementId: contract.id });
      expect(entry.postings[0]!.amount).toBe(contract.monthlyValue);
    }
    // AI clubs keep the neutral share of wages.
    const ai = 'club_palmeiras';
    expect(sponsorIncome(context, ai)[0]!.postings[0]!.amount).toBe(
      Math.round(
        clubWageBill(context.world, ai as ClubId) * NEUTRAL_SPONSOR_SHARE,
      ),
    );
  });

  it('recusar deixa o clube gerido com o patrocínio avulso reduzido', () => {
    const context = world();
    for (const offer of pending(context))
      decideSponsorOffer(context.world, offer.id, 'reject', '2026-01-05');
    expect(pending(context)).toHaveLength(0);
    settleMonths(context, '2026-02-01');
    const neutral = Math.round(
      clubWageBill(context.world, MANAGED) * NEUTRAL_SPONSOR_SHARE,
    );
    expect(sponsorIncome(context, MANAGED)[0]!.postings[0]!.amount).toBe(
      Math.round(neutral * SPONSOR_FALLBACK_SHARE),
    );
    expect(() =>
      decideSponsorOffer(
        context.world,
        readOffice(context.world).sponsorOffers[0]!.id,
        'accept',
        '2026-01-06',
      ),
    ).toThrow(OfficeRuleError);
  });

  it('contraproposta: uma vez, aceita dentro da tolerância e recusada acima dela', () => {
    const context = world();
    const [first, second] = pending(context);
    const tolerated = Math.floor(
      first!.monthlyValue * (1 + sponsorTolerance(SEED, first!.id)),
    );
    expect(
      counterSponsorOffer(
        context.world,
        first!.id,
        tolerated,
        '2026-01-03',
        SEED,
      ),
    ).toBe('accepted');
    expect(readOffice(context.world).sponsorContracts[0]!.monthlyValue).toBe(
      tolerated,
    );
    expect(() =>
      counterSponsorOffer(
        context.world,
        first!.id,
        tolerated,
        '2026-01-03',
        SEED,
      ),
    ).toThrow(OfficeRuleError);

    const other = world();
    const offer = pending(other)[1]!;
    expect(offer.id).toBe(second!.id);
    expect(() =>
      counterSponsorOffer(
        other.world,
        offer.id,
        offer.monthlyValue,
        '2026-01-03',
        SEED,
      ),
    ).toThrow(/between/);
    expect(
      counterSponsorOffer(
        other.world,
        offer.id,
        counterRange(offer).max,
        '2026-01-03',
        SEED,
      ),
    ).toBe('rejected');
    expect(
      readOffice(other.world).sponsorOffers.find(({ id }) => id === offer.id)
        ?.status,
    ).toBe('withdrawn');
    expect(readOffice(other.world).sponsorContracts).toHaveLength(0);
  });

  it('rescindir para assinar um novo contrato paga a multa no livro-caixa', () => {
    const context = world();
    const first = pending(context)[0]!;
    decideSponsorOffer(context.world, first.id, 'accept', '2026-01-05');
    settleMonths(context, '2027-01-02');
    runOfficeDay(context, '2027-01-02', SEED, 2);
    const fresh = pending(context)[0]!;
    decideSponsorOffer(context.world, fresh.id, 'accept', '2027-01-02');
    const [old, current] = readOffice(context.world).sponsorContracts;
    expect(old!.status).toBe('terminated');
    expect(current!.status).toBe('active');
    const fee = context.world.ledger.entries.find(
      ({ source }) => source.type === 'sponsor_termination',
    )!;
    expect(fee.postings).toEqual([
      expect.objectContaining({
        account: `club:${MANAGED}:cash`,
        amount: -old!.terminationFee,
      }),
      expect.objectContaining({
        account: `club:${MANAGED}:expense:sponsor`,
        amount: old!.terminationFee,
      }),
    ]);
  });

  it('paga bônus por meta uma única vez e nunca a contrato rescindido', () => {
    const context = world();
    const offer = pending(context)[2]!;
    decideSponsorOffer(context.world, offer.id, 'accept', '2026-01-05');
    const goals = {
      season: 1,
      year: 2026,
      titleClubIds: [MANAGED],
      promotedClubIds: [],
      continentalClubIds: [MANAGED],
    };
    paySponsorBonuses(context.world, goals);
    paySponsorBonuses(context.world, goals);
    const bonuses = sponsorIncome(context, MANAGED);
    expect(bonuses.map(({ source }) => source)).toEqual([
      expect.objectContaining({ period: '2026-bonus-title' }),
      expect.objectContaining({ period: '2026-bonus-continental' }),
    ]);
    expect(bonuses[0]!.postings[0]!.amount).toBe(offer.bonuses.title);
    expect(bonuses[1]!.postings[0]!.amount).toBe(offer.bonuses.continental);

    const terminated = world();
    const signed = pending(terminated)[0]!;
    decideSponsorOffer(terminated.world, signed.id, 'accept', '2026-01-05');
    readOffice(terminated.world).sponsorContracts[0]!.status = 'terminated';
    paySponsorBonuses(terminated.world, goals);
    expect(sponsorIncome(terminated, MANAGED)).toHaveLength(0);
  });
});

describe('sócio-torcedor (ADR 0011)', () => {
  const flamengo = {
    reputation: 83,
    division: 'serie-a' as const,
    fanConfidence: 55,
    form: [] as const,
  };

  it('preço maior nunca traz mais sócios', () => {
    for (const tier of ['basic', 'intermediate', 'premium'] as const) {
      let previous = Number.POSITIVE_INFINITY;
      for (
        let price = MEMBERSHIP_PRICE_MIN;
        price <= MEMBERSHIP_PRICE_MAX;
        price += 250
      ) {
        const members = membershipMembers(
          { monthlyPrice: price, tier },
          flamengo,
        );
        expect(members).toBeLessThanOrEqual(previous);
        previous = members;
      }
    }
    const reference = membershipReferencePrice(83);
    expect(
      membershipMembers(
        { monthlyPrice: reference * 1.5, tier: 'basic' },
        flamengo,
      ),
    ).toBeLessThan(
      membershipMembers({ monthlyPrice: reference, tier: 'basic' }, flamengo),
    );
  });

  it('mais torcida e melhor fase trazem mais sócios', () => {
    const plan = defaultMembershipPlan(83, 'serie-a');
    expect(
      membershipMembers(plan, { ...flamengo, fanConfidence: 90 }),
    ).toBeGreaterThan(membershipMembers(plan, flamengo));
    expect(
      membershipMembers(plan, { ...flamengo, form: ['W', 'W', 'W', 'W', 'W'] }),
    ).toBeGreaterThan(
      membershipMembers(plan, { ...flamengo, form: ['L', 'L', 'L', 'L', 'L'] }),
    );
  });

  it('valores iniciais vêm do porte e da divisão do clube', () => {
    expect(defaultMembershipPlan(83, 'serie-a').tier).toBe('intermediate');
    expect(defaultMembershipPlan(55, 'serie-c').tier).toBe('basic');
    for (const club of content.clubs) {
      const plan = defaultMembershipPlan(Number(club.reputation), 'serie-b');
      expect(plan.monthlyPrice).toBeGreaterThanOrEqual(MEMBERSHIP_PRICE_MIN);
      expect(plan.monthlyPrice).toBeLessThanOrEqual(MEMBERSHIP_PRICE_MAX);
    }
  });

  it('lança receita e custo dos benefícios no fechamento do mês', () => {
    const context = world();
    configureMembership(context, { monthlyPrice: 3_000, tier: 'premium' });
    const projection = managedMembership(context)!;
    expect(projection.members).toBeGreaterThan(0);
    settleMonths(context, '2026-02-01');
    const finances = financesByCategory(
      context.world.ledger,
      MANAGED,
      '2026-01',
    );
    expect(finances.income.membership).toBe(projection.members * 3_000);
    expect(finances.expenses.membership).toBe(
      projection.members * MEMBERSHIP_TIER_TABLE.premium.costPerMember,
    );
    expect(() =>
      configureMembership(context, { monthlyPrice: 100, tier: 'basic' }),
    ).toThrow(OfficeRuleError);
  });

  it('o efeito no público e na torcida é pequeno e limitado', () => {
    expect(membershipAttendanceBonus(10_000_000, 50_000)).toBe(2_500);
    expect(membershipAttendanceBonus(100, 50_000)).toBe(10);
    for (const tier of ['basic', 'intermediate', 'premium'] as MembershipTier[])
      for (const price of [MEMBERSHIP_PRICE_MIN, 4_000, MEMBERSHIP_PRICE_MAX]) {
        const effect = membershipFanEffect({ monthlyPrice: price, tier }, 83);
        expect(Math.abs(effect)).toBeLessThanOrEqual(3);
      }
    expect(
      membershipFanEffect(
        { monthlyPrice: MEMBERSHIP_PRICE_MIN, tier: 'premium' },
        83,
      ),
    ).toBe(3);
    expect(
      membershipFanEffect(
        { monthlyPrice: MEMBERSHIP_PRICE_MAX, tier: 'basic' },
        83,
      ),
    ).toBe(-3);

    const fixture = {
      id: 'fixture_office',
      competitionId: 'competition_x',
      homeClubId: MANAGED,
      awayClubId: 'club_palmeiras',
      date: '2026-02-10',
    } as unknown as CompetitionCalendarFixture;
    const without = world();
    configureMembership(without, {
      monthlyPrice: MEMBERSHIP_PRICE_MAX,
      tier: 'basic',
    });
    const withMembers = world();
    configureMembership(withMembers, {
      monthlyPrice: MEMBERSHIP_PRICE_MIN,
      tier: 'premium',
    });
    // Members only add seats while the stadium has room: a full house (the
    // demand of a big club at its usual price) stays full either way.
    for (const context of [without, withMembers])
      context.world.stadiums = context.world.stadiums.map((item) =>
        item.clubId === MANAGED
          ? { ...item, ticketPrice: money(20_000) }
          : item,
      );
    recordGate(without, fixture, 'national_league');
    recordGate(withMembers, fixture, 'national_league');
    const stadium = withMembers.world.stadiums.find(
      ({ clubId }) => clubId === MANAGED,
    )!;
    const extra =
      (withMembers.world.gate[MANAGED]! - without.world.gate[MANAGED]!) /
      Number(stadium.ticketPrice);
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeLessThanOrEqual(Math.floor(stadium.capacity * 0.05));
  });
});

describe('livro-caixa do escritório', () => {
  it('conserva o dinheiro: cada lançamento soma zero e o caixa fecha com as categorias', () => {
    const context = world();
    const offer = pending(context)[1]!;
    decideSponsorOffer(context.world, offer.id, 'accept', '2026-01-05');
    configureMembership(context, { monthlyPrice: 4_000, tier: 'intermediate' });
    settleMonths(context, '2026-04-01');
    paySponsorBonuses(context.world, {
      season: 1,
      year: 2026,
      titleClubIds: [MANAGED],
      promotedClubIds: [],
      continentalClubIds: [],
    });
    for (const entry of context.world.ledger.entries)
      expect(
        entry.postings.reduce((sum, { amount }) => sum + Number(amount), 0),
      ).toBe(0);
    const finances = financesByCategory(context.world.ledger, MANAGED);
    expect(finances.income.sponsor).toBeGreaterThan(0);
    expect(finances.income.membership).toBeGreaterThan(0);
    expect(
      Number(accountBalance(context.world.ledger, `club:${MANAGED}:cash`)),
    ).toBe(finances.net);
  });

  it('saves antigos sem escritório carregam e ganham o estado na primeira escrita', () => {
    const context = world();
    delete context.world.office;
    expect(readOffice(context.world).sponsorOffers).toEqual([]);
    expect(managedMembership(context)?.plan.tier).toBe('intermediate');
    settleMonths(context, '2026-02-01');
    expect(context.world.office).toBeUndefined();
    runOfficeDay(context, '2026-02-02', SEED, 1);
    expect(pending(context)).toHaveLength(3);
  });
});

describe('entrosamento (ADR 0011)', () => {
  const eleven = Array.from(
    { length: 11 },
    (_, index) => `player_${String(index)}`,
  );

  it('sobe com os mesmos titulares e cai quando muitos mudam', () => {
    let state = nextChemistry(undefined, eleven);
    expect(state.value).toBe(50);
    for (let match = 0; match < 3; match++)
      state = nextChemistry(state, eleven);
    expect(state.value).toBe(50 + 3 * CHEMISTRY_GAIN);
    const oneChange = nextChemistry(state, [
      ...eleven.slice(0, 10),
      'player_x',
    ]);
    expect(oneChange.value).toBe(state.value + CHEMISTRY_GAIN);
    const sixChanges = nextChemistry(state, [
      ...eleven.slice(0, 5),
      ...Array.from({ length: 6 }, (_, index) => `new_${String(index)}`),
    ]);
    expect(sixChanges.value).toBeLessThan(state.value);
    let full = state;
    for (let match = 0; match < 30; match++) full = nextChemistry(full, eleven);
    expect(full.value).toBe(100);
    let empty = state;
    for (let match = 0; match < 10; match++)
      empty = nextChemistry(
        empty,
        eleven.map((id) => `${id}_${String(match)}`),
      );
    expect(empty.value).toBe(0);
  });

  it('vira um bônus de força pequeno, limitado e determinístico', () => {
    expect(chemistryFactor(0)).toBe(1);
    expect(chemistryFactor(100)).toBeCloseTo(1 + CHEMISTRY_MAX_BONUS, 10);
    expect(chemistryFactor(250)).toBe(chemistryFactor(100));
    expect(chemistryBonusPercent(50)).toBe(1.5);
    const squad = content.players.filter(({ clubId }) => clubId === MANAGED);
    const boosted = withStrengthFactor(squad, chemistryFactor(100));
    expect(withStrengthFactor(squad, chemistryFactor(100))).toEqual(boosted);
    boosted.forEach((player, index) => {
      const before = Number(squad[index]!.strength);
      expect(Number(player.strength)).toBeGreaterThanOrEqual(before);
      expect(Number(player.strength)).toBeLessThanOrEqual(
        Math.min(100, Math.round(before * 1.03)),
      );
    });
  });
});

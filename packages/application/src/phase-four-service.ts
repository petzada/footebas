import {
  phaseFourCommandSchema,
  type MarketSearchQuery,
  type PhaseFourCareerReadModel,
  type PhaseFourCommand,
  type PhaseFourEvent,
  type PhaseFourReceipt,
} from '@footebas/contracts';
import {
  acceptJobProposal,
  appendLedgerEntry,
  clubCashBalance,
  completeAcceptedOffer,
  contractAlerts,
  counterOffer,
  createTransferOffer,
  decideClubOffer,
  evaluateRenewal,
  freeAgentIds,
  generateYouthCandidates,
  leaveClub,
  promoteYouth,
  releaseYouth,
  renewContract,
  scoutPlayer,
  searchTransferMarket,
  startStadiumExpansion,
  terminateContract,
  transitionOffer,
  type Club,
  type ClubId,
  type LedgerTransaction,
  type LedgerPosting,
  type MarketPlayerView,
  type Money,
  type Player,
  type PlayerContract,
  type PlayerId,
  type ScoutingReport,
  type TransferOffer,
} from '@footebas/domain';
import type { Clock, IdGenerator } from './ports.js';
import type {
  ArchiveStoragePort,
  PhaseFourState,
  PhaseFourStateRepository,
  RandomFactoryPort,
} from './phase-four-ports.js';

export class PhaseFourAuthorizationError extends Error {}
export class PhaseFourConflictError extends Error {}
export class PhaseFourNotFoundError extends Error {}

interface Dependencies {
  readonly repository: PhaseFourStateRepository;
  readonly archives: ArchiveStoragePort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly random: RandomFactoryPort;
}

type MutableState = {
  -readonly [Key in keyof PhaseFourState]: PhaseFourState[Key];
};

const payload = (
  value: Readonly<Record<string, string | number | boolean | null>>,
): PhaseFourEvent['payload'] => value;

export class PhaseFourApplicationService {
  public constructor(private readonly dependencies: Dependencies) {}

  public execute(
    actorUserId: string,
    input: unknown,
  ): Promise<PhaseFourReceipt> {
    const command = phaseFourCommandSchema.parse(input);
    return this.dependencies.repository.withLock(command.careerId, async () => {
      const previous = await this.dependencies.repository.receipt(
        command.careerId,
        command.idempotencyKey,
      );
      if (previous !== undefined) {
        if (previous.commandId !== command.commandId)
          throw new PhaseFourConflictError(
            'idempotency key was reused by another command',
          );
        return previous;
      }
      const current = await this.loadOwned(command.careerId, actorUserId);
      if (current.version !== command.expectedVersion)
        throw new PhaseFourConflictError(
          `expected version ${String(command.expectedVersion)}, found ${String(current.version)}`,
        );
      const draft = structuredClone(current) as MutableState;
      const before = draft.events.length;
      const outcome = await this.apply(draft, command);
      draft.version = current.version + 1;
      const eventIds = draft.events.slice(before).map(({ id }) => id);
      const receipt: PhaseFourReceipt = {
        version: 1,
        careerId: command.careerId,
        commandId: command.commandId,
        aggregateVersion: draft.version,
        eventIds,
        outcome,
      };
      await this.dependencies.repository.save(draft, current.version);
      await this.dependencies.repository.saveReceipt(
        command.careerId,
        command.idempotencyKey,
        receipt,
      );
      return receipt;
    });
  }

  public async market(
    actorUserId: string,
    careerId: string,
    query: MarketSearchQuery,
  ): Promise<readonly MarketPlayerView[]> {
    const state = await this.loadOwned(careerId, actorUserId);
    const { maxValue, ...otherFilters } = query;
    return searchTransferMarket(state.players, {
      ...otherFilters,
      ...(maxValue === undefined ? {} : { maxValue: maxValue as Money }),
    });
  }

  public async scout(
    actorUserId: string,
    careerId: string,
    playerId: string,
  ): Promise<ScoutingReport> {
    const state = await this.loadOwned(careerId, actorUserId);
    return scoutPlayer(this.player(state, playerId), state.currentDate);
  }

  public async compare(
    actorUserId: string,
    careerId: string,
    playerIds: readonly string[],
  ): Promise<
    readonly Readonly<{
      player: MarketPlayerView;
      scouting: ScoutingReport;
    }>[]
  > {
    if (
      playerIds.length < 2 ||
      playerIds.length > 4 ||
      new Set(playerIds).size !== playerIds.length
    )
      throw new PhaseFourConflictError(
        'comparison requires two to four unique players',
      );
    const state = await this.loadOwned(careerId, actorUserId);
    const visible = new Map(
      searchTransferMarket(state.players, {}).map((item) => [item.id, item]),
    );
    return Object.freeze(
      playerIds.map((id) => {
        const selected = visible.get(id as PlayerId);
        if (selected === undefined)
          throw new PhaseFourNotFoundError(`player ${id} not found`);
        return Object.freeze({
          player: selected,
          scouting: scoutPlayer(this.player(state, id), state.currentDate),
        });
      }),
    );
  }

  public async readModel(
    actorUserId: string,
    careerId: string,
  ): Promise<PhaseFourCareerReadModel> {
    const state = await this.loadOwned(careerId, actorUserId);
    return {
      version: 1,
      careerId,
      aggregateVersion: state.version,
      projectedAt: this.dependencies.clock.now().toISOString(),
      contractAlerts: [...contractAlerts(state.contracts, state.currentDate)],
      freeAgentIds: [...freeAgentIds(state.players, state.contracts)],
      pendingOfferIds: state.offers
        .filter(({ status }) => status === 'pending')
        .map(({ id }) => id),
      boardConfidence: state.manager.boardConfidence,
      fanConfidence: state.manager.fanConfidence,
      managerPrestige: state.manager.prestige,
      schemaVersion: state.schemaVersion,
      archiveKeys: [...state.archiveKeys],
    };
  }

  private async loadOwned(
    careerId: string,
    actorUserId: string,
  ): Promise<PhaseFourState> {
    const state = await this.dependencies.repository.load(careerId);
    if (state === undefined)
      throw new PhaseFourNotFoundError(`career ${careerId} not found`);
    if (state.userId !== actorUserId)
      throw new PhaseFourAuthorizationError('career does not belong to actor');
    return state;
  }

  private addEvent(
    state: MutableState,
    command: PhaseFourCommand,
    type: PhaseFourEvent['type'],
    eventPayload: PhaseFourEvent['payload'],
  ): void {
    const event: PhaseFourEvent = {
      id: this.dependencies.ids.next('event'),
      careerId: state.careerId,
      sequence: state.events.length + 1,
      type,
      occurredAt: this.dependencies.clock.now().toISOString(),
      gameDate: state.currentDate,
      commandId: command.commandId,
      payload: eventPayload,
    };
    state.events = [...state.events, event];
  }

  private async apply(
    state: MutableState,
    command: PhaseFourCommand,
  ): Promise<'applied' | 'refused'> {
    switch (command.type) {
      case 'RenewPlayerContract':
        return this.renew(state, command);
      case 'TerminatePlayerContract':
        return this.terminate(state, command);
      case 'SubmitTransferOffer':
        return this.submitOffer(state, command);
      case 'CounterTransferOffer':
        return this.counter(state, command);
      case 'DecideTransferOffer':
        return this.decide(state, command);
      case 'SetTicketPrice':
        return this.setTicketPrice(state, command);
      case 'ExpandStadium':
        return this.expandStadium(state, command);
      case 'GenerateYouth':
        return this.generateYouth(state, command);
      case 'PromoteYouth':
        return this.promote(state, command);
      case 'ReleaseYouth':
        return this.release(state, command);
      case 'LeaveClub':
        return this.leave(state, command);
      case 'AcceptJobProposal':
        return this.acceptJob(state, command);
      case 'MigrateSave':
        return this.migrate(state, command);
      case 'CompactHistory':
        return this.compact(state, command);
    }
  }

  private renew(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'RenewPlayerContract' }>,
  ): 'applied' | 'refused' {
    const contract = this.contract(state, command.payload.contractId);
    this.assertManagedClub(state, contract.clubId);
    const player = this.player(state, contract.playerId);
    const club = this.club(state, contract.clubId);
    const proposal = {
      wage: command.payload.wage as Money,
      endsOn: command.payload.endsOn,
    };
    if (
      evaluateRenewal(contract, proposal, player, Number(club.reputation)) ===
      'refuse'
    ) {
      this.addEvent(
        state,
        command,
        'CONTRACT_REFUSED',
        payload({ contractId: contract.id, playerId: player.id }),
      );
      return 'refused';
    }
    const next = renewContract(contract, proposal);
    state.contracts = state.contracts.map((item) =>
      item.id === next.id ? next : item,
    );
    this.addEvent(
      state,
      command,
      'CONTRACT_RENEWED',
      payload({ contractId: contract.id, playerId: player.id }),
    );
    return 'applied';
  }

  private terminate(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'TerminatePlayerContract' }>,
  ): 'applied' {
    const contract = this.contract(state, command.payload.contractId);
    this.assertManagedClub(state, contract.clubId);
    const club = this.club(state, contract.clubId);
    if (
      clubCashBalance(state.ledger, club.id, club.balance) <
      contract.terminationCost
    )
      throw new PhaseFourConflictError(
        'insufficient cash for contract termination',
      );
    state.contracts = state.contracts.map((item) =>
      item.id === contract.id ? terminateContract(item) : item,
    );
    const player = this.player(state, contract.playerId);
    state.players = state.players.map((item) =>
      item.id === player.id ? this.withoutClub(item) : item,
    );
    state.clubs = state.clubs.map((item) =>
      item.id === club.id
        ? Object.freeze({
            ...item,
            squad: item.squad.filter((id) => id !== player.id),
          })
        : item,
    );
    if (contract.terminationCost > 0) {
      const transaction: LedgerTransaction = {
        id: this.dependencies.ids.next('ledger'),
        occurredAt: this.dependencies.clock.now().toISOString(),
        source: {
          type: 'wages',
          clubId: club.id,
          period: `termination:${contract.id}`,
        },
        postings: [
          {
            account: `club:${club.id}:cash`,
            amount: -Number(contract.terminationCost) as Money,
            clubId: club.id,
          },
          {
            account: `club:${club.id}:expense:wages`,
            amount: contract.terminationCost,
            clubId: club.id,
          },
        ],
      };
      state.ledger = appendLedgerEntry(state.ledger, transaction);
    }
    this.addEvent(
      state,
      command,
      'CONTRACT_TERMINATED',
      payload({ contractId: contract.id, playerId: player.id }),
    );
    return 'applied';
  }

  private submitOffer(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'SubmitTransferOffer' }>,
  ): 'applied' | 'refused' {
    this.assertManagedClub(state, command.payload.toClubId as ClubId);
    const player = this.player(state, command.payload.playerId);
    if (player.clubId !== command.payload.fromClubId)
      throw new PhaseFourConflictError('offer seller does not own player');
    const offer = createTransferOffer({
      id: this.dependencies.ids.next('offer'),
      kind: command.payload.kind,
      playerId: player.id,
      ...(command.payload.fromClubId === undefined
        ? {}
        : { fromClubId: command.payload.fromClubId as ClubId }),
      toClubId: command.payload.toClubId as ClubId,
      fee: command.payload.fee as Money,
      wage: command.payload.wage as Money,
      createdOn: state.currentDate,
      expiresOn: command.payload.expiresOn,
      status: 'pending',
      revision: 1,
      ...(command.payload.loan === undefined
        ? {}
        : {
            loan: {
              endsOn: command.payload.loan.endsOn,
              wageSharePercentage: command.payload.loan.wageSharePercentage,
              ...(command.payload.loan.optionToBuy === undefined
                ? {}
                : { optionToBuy: command.payload.loan.optionToBuy as Money }),
            },
          }),
    });
    const buyer = this.profile(state, offer.toClubId);
    const seller =
      offer.fromClubId === undefined
        ? undefined
        : this.profile(state, offer.fromClubId);
    const decision = decideClubOffer(
      offer,
      player,
      buyer,
      seller,
      state.players.filter(({ clubId }) => clubId === buyer.clubId),
      seller === undefined
        ? []
        : state.players.filter(({ clubId }) => clubId === seller.clubId),
    );
    state.offers = [...state.offers, offer];
    this.addEvent(
      state,
      command,
      'TRANSFER_OFFERED',
      payload({ offerId: offer.id, playerId: player.id }),
    );
    if (decision === 'reject') {
      state.offers = state.offers.map((item) =>
        item.id === offer.id ? transitionOffer(item, 'rejected') : item,
      );
      this.addEvent(
        state,
        command,
        'TRANSFER_REJECTED',
        payload({ offerId: offer.id }),
      );
      return 'refused';
    }
    if (decision === 'accept') {
      const accepted = transitionOffer(offer, 'accepted');
      state.offers = state.offers.map((item) =>
        item.id === accepted.id ? accepted : item,
      );
      this.addEvent(
        state,
        command,
        'TRANSFER_ACCEPTED',
        payload({ offerId: offer.id, decisionSource: 'club_ai' }),
      );
      this.completeTransfer(state, command, accepted);
      return 'applied';
    }
    const [countered, counter] = counterOffer(
      offer,
      this.dependencies.ids.next('offer'),
      {
        fee: Math.max(
          offer.fee + 1,
          Math.floor(Number(player.value) * 0.92),
        ) as Money,
        wage: offer.wage,
        expiresOn: offer.expiresOn,
      },
    );
    state.offers = [
      ...state.offers.map((item) =>
        item.id === countered.id ? countered : item,
      ),
      counter,
    ];
    this.addEvent(
      state,
      command,
      'TRANSFER_COUNTERED',
      payload({
        offerId: offer.id,
        counterOfferId: counter.id,
        decisionSource: 'club_ai',
      }),
    );
    return 'applied';
  }

  private counter(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'CounterTransferOffer' }>,
  ): 'applied' {
    const offer = this.offer(state, command.payload.offerId);
    if (offer.fromClubId === undefined)
      throw new PhaseFourAuthorizationError(
        'free-agent offer cannot be countered by a club',
      );
    this.assertManagedClub(state, offer.fromClubId);
    const [previous, next] = counterOffer(
      offer,
      this.dependencies.ids.next('offer'),
      {
        fee: command.payload.fee as Money,
        wage: command.payload.wage as Money,
        expiresOn: command.payload.expiresOn,
      },
    );
    state.offers = [
      ...state.offers.map((item) =>
        item.id === previous.id ? previous : item,
      ),
      next,
    ];
    this.addEvent(
      state,
      command,
      'TRANSFER_COUNTERED',
      payload({ offerId: offer.id, counterOfferId: next.id }),
    );
    return 'applied';
  }

  private decide(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'DecideTransferOffer' }>,
  ): 'applied' {
    const offer = this.offer(state, command.payload.offerId);
    const controlledClubId = state.manager.currentClubId;
    const controlsDecision =
      controlledClubId !== undefined &&
      (offer.counterOf === undefined
        ? controlledClubId === offer.fromClubId
        : controlledClubId === offer.toClubId);
    if (!controlsDecision)
      throw new PhaseFourAuthorizationError('manager cannot decide this offer');
    const status =
      command.payload.decision === 'accept' ? 'accepted' : 'rejected';
    const decided = transitionOffer(offer, status);
    state.offers = state.offers.map((item) =>
      item.id === decided.id ? decided : item,
    );
    this.addEvent(
      state,
      command,
      status === 'accepted' ? 'TRANSFER_ACCEPTED' : 'TRANSFER_REJECTED',
      payload({ offerId: offer.id }),
    );
    if (status === 'accepted') this.completeTransfer(state, command, decided);
    return 'applied';
  }

  private completeTransfer(
    state: MutableState,
    command: PhaseFourCommand,
    offer: TransferOffer,
  ): void {
    const player = this.player(state, offer.playerId);
    const buyer = this.club(state, offer.toClubId);
    if (clubCashBalance(state.ledger, buyer.id, buyer.balance) < offer.fee)
      throw new PhaseFourConflictError('insufficient cash for transfer');
    const completed = completeAcceptedOffer(offer, player);
    state.players = state.players.map((item) =>
      item.id === player.id ? completed.player : item,
    );
    state.clubs = state.clubs.map((club) => {
      const without = club.squad.filter((id) => id !== player.id);
      return club.id === offer.toClubId
        ? Object.freeze({
            ...club,
            squad: Object.freeze([...without, player.id]),
          })
        : offer.fromClubId !== undefined && club.id === offer.fromClubId
          ? Object.freeze({ ...club, squad: Object.freeze(without) })
          : club;
    });
    if (completed.loan !== undefined)
      state.loans = [...state.loans, completed.loan];
    if (offer.kind === 'buy') {
      state.contracts = state.contracts.map((contract) =>
        contract.playerId === player.id && contract.status === 'active'
          ? terminateContract(contract)
          : contract,
      );
      const contract: PlayerContract = {
        id: this.dependencies.ids.next('contract'),
        playerId: player.id,
        clubId: offer.toClubId,
        startsOn: state.currentDate,
        endsOn: this.addYears(state.currentDate, 2),
        wage: offer.wage,
        status: 'active',
        terminationCost: (offer.wage * 12) as Money,
        revision: 1,
      };
      state.contracts = [...state.contracts, contract];
      if (offer.fee > 0) this.postTransfer(state, offer);
    }
    this.addEvent(
      state,
      command,
      offer.kind === 'loan' ? 'LOAN_STARTED' : 'TRANSFER_COMPLETED',
      payload({ offerId: offer.id, playerId: player.id }),
    );
  }

  private postTransfer(state: MutableState, offer: TransferOffer): void {
    const postings: LedgerPosting[] = [
      {
        account: `club:${offer.toClubId}:cash`,
        amount: -Number(offer.fee) as Money,
        clubId: offer.toClubId,
      },
      {
        account: `club:${offer.toClubId}:expense:transfer`,
        amount: offer.fee,
        clubId: offer.toClubId,
      },
    ];
    if (offer.fromClubId !== undefined)
      postings.push(
        {
          account: `club:${offer.fromClubId}:cash`,
          amount: offer.fee,
          clubId: offer.fromClubId,
        },
        {
          account: `club:${offer.fromClubId}:income:transfer`,
          amount: -Number(offer.fee) as Money,
          clubId: offer.fromClubId,
        },
      );
    else
      postings.push(
        { account: 'world:transfer_clearing', amount: offer.fee },
        {
          account: 'world:transfer_clearing',
          amount: -Number(offer.fee) as Money,
        },
      );
    state.ledger = appendLedgerEntry(state.ledger, {
      id: this.dependencies.ids.next('ledger'),
      occurredAt: this.dependencies.clock.now().toISOString(),
      source: { type: 'transfer', offerId: offer.id, playerId: offer.playerId },
      postings,
    });
  }

  private setTicketPrice(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'SetTicketPrice' }>,
  ): 'applied' {
    this.assertManagedClub(state, command.payload.clubId as ClubId);
    state.stadiums = state.stadiums.map((stadium) =>
      stadium.clubId === command.payload.clubId
        ? Object.freeze({
            ...stadium,
            ticketPrice: command.payload.ticketPrice as Money,
          })
        : stadium,
    );
    this.addEvent(
      state,
      command,
      'TICKET_PRICE_CHANGED',
      payload({
        clubId: command.payload.clubId,
        ticketPrice: command.payload.ticketPrice,
      }),
    );
    return 'applied';
  }

  private expandStadium(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'ExpandStadium' }>,
  ): 'applied' {
    const clubId = command.payload.clubId as ClubId;
    this.assertManagedClub(state, clubId);
    const club = this.club(state, clubId);
    if (
      clubCashBalance(state.ledger, club.id, club.balance) <
      command.payload.cost
    )
      throw new PhaseFourConflictError(
        'insufficient cash for stadium expansion',
      );
    const projectId = this.dependencies.ids.next('stadium_project');
    state.stadiums = state.stadiums.map((stadium) =>
      stadium.clubId === clubId
        ? startStadiumExpansion(stadium, {
            projectId,
            addedCapacity: command.payload.addedCapacity,
            cost: command.payload.cost as Money,
            completesOn: command.payload.completesOn,
          })
        : stadium,
    );
    state.ledger = appendLedgerEntry(state.ledger, {
      id: this.dependencies.ids.next('ledger'),
      occurredAt: this.dependencies.clock.now().toISOString(),
      source: { type: 'stadium', projectId },
      postings: [
        {
          account: `club:${clubId}:cash`,
          amount: -command.payload.cost as Money,
          clubId,
        },
        {
          account: `club:${clubId}:expense:stadium`,
          amount: command.payload.cost as Money,
          clubId,
        },
      ],
    });
    this.addEvent(
      state,
      command,
      'STADIUM_EXPANSION_STARTED',
      payload({ clubId, projectId }),
    );
    return 'applied';
  }

  private generateYouth(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'GenerateYouth' }>,
  ): 'applied' {
    const clubId = command.payload.clubId as ClubId;
    this.assertManagedClub(state, clubId);
    const existing = state.youth.filter(
      ({ player, status }) => player.clubId === clubId && status === 'academy',
    ).length;
    const generated = generateYouthCandidates({
      clubId,
      seed: command.payload.seed,
      generatorVersion: 'youth-v1',
      maximumCandidates: command.payload.maximumCandidates,
      existingCandidates: existing,
      currentSeason: state.season,
      nextId: (kind) => this.dependencies.ids.next(kind),
      random: this.dependencies.random.fromSeed(command.payload.seed),
    });
    state.youth = [...state.youth, ...generated];
    state.players = [
      ...state.players,
      ...generated.map(({ player }) => player),
    ];
    this.addEvent(
      state,
      command,
      'YOUTH_GENERATED',
      payload({ clubId, count: generated.length, seed: command.payload.seed }),
    );
    return 'applied';
  }

  private promote(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'PromoteYouth' }>,
  ): 'applied' {
    const candidate = state.youth.find(
      ({ player }) => player.id === command.payload.playerId,
    );
    if (candidate === undefined)
      throw new PhaseFourNotFoundError('youth candidate not found');
    if (candidate.player.clubId === undefined)
      throw new PhaseFourConflictError('released youth cannot be promoted');
    this.assertManagedClub(state, candidate.player.clubId);
    const squad = state.players.filter(
      ({ clubId, squadStatus }) =>
        clubId === candidate.player.clubId && squadStatus !== 'youth',
    );
    const promoted = promoteYouth(candidate, squad.length, 35);
    state.youth = state.youth.map((item) =>
      item.player.id === promoted.player.id ? promoted : item,
    );
    state.players = state.players.map((item) =>
      item.id === promoted.player.id ? promoted.player : item,
    );
    state.clubs = state.clubs.map((club) =>
      club.id === promoted.player.clubId &&
      !club.squad.includes(promoted.player.id)
        ? Object.freeze({
            ...club,
            squad: Object.freeze([...club.squad, promoted.player.id]),
          })
        : club,
    );
    this.addEvent(
      state,
      command,
      'YOUTH_PROMOTED',
      payload({ playerId: promoted.player.id }),
    );
    return 'applied';
  }

  private release(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'ReleaseYouth' }>,
  ): 'applied' {
    const candidate = state.youth.find(
      ({ player }) => player.id === command.payload.playerId,
    );
    if (candidate === undefined)
      throw new PhaseFourNotFoundError('youth candidate not found');
    if (candidate.player.clubId !== undefined)
      this.assertManagedClub(state, candidate.player.clubId);
    const released = releaseYouth(candidate);
    state.youth = state.youth.map((item) =>
      item.player.id === released.player.id ? released : item,
    );
    state.players = state.players.map((item) =>
      item.id === released.player.id ? released.player : item,
    );
    this.addEvent(
      state,
      command,
      'YOUTH_RELEASED',
      payload({ playerId: released.player.id }),
    );
    return 'applied';
  }

  private leave(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'LeaveClub' }>,
  ): 'applied' {
    state.manager = leaveClub(
      state.manager,
      state.currentDate,
      command.payload.reason,
    );
    this.addEvent(
      state,
      command,
      command.payload.reason === 'fired' ? 'MANAGER_FIRED' : 'MANAGER_RESIGNED',
      payload({ managerId: state.manager.managerId }),
    );
    return 'applied';
  }

  private acceptJob(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'AcceptJobProposal' }>,
  ): 'applied' {
    const proposal = state.jobProposals.find(
      ({ id }) => id === command.payload.proposalId,
    );
    if (proposal === undefined)
      throw new PhaseFourNotFoundError('job proposal not found');
    const result = acceptJobProposal(
      state.manager,
      proposal,
      state.currentDate,
    );
    state.manager = result.career;
    state.jobProposals = state.jobProposals.map((item) =>
      item.id === result.proposal.id ? result.proposal : item,
    );
    this.addEvent(
      state,
      command,
      'MANAGER_CHANGED_CLUB',
      payload({
        managerId: state.manager.managerId,
        clubId: result.proposal.clubId,
      }),
    );
    return 'applied';
  }

  private migrate(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'MigrateSave' }>,
  ): 'applied' | 'refused' {
    if (state.schemaVersion === command.payload.targetSchemaVersion)
      return 'refused';
    if (
      state.schemaVersion !== '3' ||
      command.payload.targetSchemaVersion !== '4'
    )
      throw new PhaseFourConflictError(
        `unsupported save migration ${state.schemaVersion} -> ${command.payload.targetSchemaVersion}`,
      );
    const previous = state.schemaVersion;
    state.schemaVersion = '4';
    this.addEvent(
      state,
      command,
      'SAVE_MIGRATED',
      payload({ from: previous, to: state.schemaVersion }),
    );
    return 'applied';
  }

  private async compact(
    state: MutableState,
    command: Extract<PhaseFourCommand, { type: 'CompactHistory' }>,
  ): Promise<'applied' | 'refused'> {
    const archived = state.history.filter(
      ({ season }) => season < command.payload.retainFromSeason,
    );
    if (archived.length === 0) return 'refused';
    const key = `careers/${state.careerId}/history/before-${String(command.payload.retainFromSeason)}-v${String(state.version + 1)}.json`;
    await this.dependencies.archives.put(
      key,
      new TextEncoder().encode(JSON.stringify(archived)),
    );
    state.history = state.history.filter(
      ({ season }) => season >= command.payload.retainFromSeason,
    );
    state.archiveKeys = [...state.archiveKeys, key];
    this.addEvent(
      state,
      command,
      'HISTORY_ARCHIVED',
      payload({ archiveKey: key, eventCount: archived.length }),
    );
    return 'applied';
  }

  private player(state: PhaseFourState, id: string): Player {
    const player = state.players.find((item) => item.id === id);
    if (player === undefined)
      throw new PhaseFourNotFoundError(`player ${id} not found`);
    return player;
  }
  private club(state: PhaseFourState, id: ClubId): Club {
    const club = state.clubs.find((item) => item.id === id);
    if (club === undefined)
      throw new PhaseFourNotFoundError(`club ${id} not found`);
    return club;
  }
  private contract(state: PhaseFourState, id: string): PlayerContract {
    const contract = state.contracts.find((item) => item.id === id);
    if (contract === undefined)
      throw new PhaseFourNotFoundError(`contract ${id} not found`);
    return contract;
  }
  private offer(state: PhaseFourState, id: string): TransferOffer {
    const offer = state.offers.find((item) => item.id === id);
    if (offer === undefined)
      throw new PhaseFourNotFoundError(`offer ${id} not found`);
    return offer;
  }
  private assertManagedClub(state: PhaseFourState, clubId: ClubId): void {
    if (
      state.manager.currentClubId !== clubId ||
      state.manager.employmentStatus !== 'employed'
    )
      throw new PhaseFourAuthorizationError('manager does not control club');
  }
  private withoutClub(player: Player): Player {
    const { clubId: _clubId, ...free } = player;
    void _clubId;
    return Object.freeze({ ...free, squadStatus: 'listed' });
  }
  private profile(state: PhaseFourState, clubId: ClubId) {
    const club = this.club(state, clubId);
    const squad = state.players.filter((player) => player.clubId === clubId);
    const positionCounts = new Map<string, number>();
    for (const player of squad)
      positionCounts.set(
        player.position,
        (positionCounts.get(player.position) ?? 0) + 1,
      );
    const needs = (
      ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'] as const
    ).filter(
      (position) =>
        (positionCounts.get(position) ?? 0) < (position === 'GK' ? 2 : 1),
    );
    const maximumWage = Math.max(
      0,
      ...squad.map(({ salary }) => Number(salary)),
    );
    return {
      clubId,
      balance: clubCashBalance(state.ledger, clubId, club.balance),
      wageCeiling: Math.max(
        maximumWage * 2,
        Math.floor(Number(club.reputation) * 5_000),
      ) as Money,
      reputation: Number(club.reputation),
      minimumSquadSize: 18,
      maximumSquadSize: 35,
      needs,
    };
  }
  private addYears(date: string, years: number): string {
    const instant = new Date(`${date}T00:00:00.000Z`);
    instant.setUTCFullYear(instant.getUTCFullYear() + years);
    return instant.toISOString().slice(0, 10);
  }
}

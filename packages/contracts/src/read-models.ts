import { z } from 'zod';
import {
  attackDirectionSchema,
  attackFocusSchema,
  buildUpStyleSchema,
  defensiveLineSchema,
  entityIdSchema,
  formationSchema,
  markingIntensitySchema,
  markingStyleSchema,
  mentalitySchema,
  pressingStyleSchema,
  gameDateSchema,
  moneySchema,
  nonEmptyTextSchema,
  percentageSchema,
  positionSchema,
  playerTraitSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';
import { careerNameSchema, coachProfileSchema } from './coach.js';
import { chemistryReadModelSchema } from './office.js';

const readBase = {
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: z.iso.datetime({ offset: true }),
} as const;
const clubSummarySchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  shortName: z.string().trim().min(1).max(24),
});
const scoreSchema = z.strictObject({
  home: z.int().min(0).max(99),
  away: z.int().min(0).max(99),
});
/**
 * A decision the inbox item asks for. On `transfer_offer`, `accept`/`reject`
 * resolve to `DecideTransferOffer { offerId, decision }` and `counter` to
 * `CounterTransferOffer { offerId, fee, wage, expiresOn }` (docs/adr/0008).
 * On `sponsor_offer`, to `DecideSponsorshipOffer { offerId, decision }` and
 * `CounterSponsorshipOffer { offerId, monthlyValue }` (docs/adr/0011).
 */
export const inboxDecisionSchema = z.strictObject({
  id: entityIdSchema,
  offerId: entityIdSchema,
  options: z
    .array(z.enum(['accept', 'reject', 'counter']))
    .min(1)
    .max(3),
  expiresOn: gameDateSchema,
});
/**
 * Topics of generated inbox messages (board, athletes, press and notices,
 * docs/09 Central). Messages with `choice` resolve through
 * `ResolveInboxDecision { messageId, optionId }`.
 */
export const INBOX_TOPICS = [
  'board_objective',
  'board_reinforcement',
  'board_sale',
  'board_ultimatum',
  'player_minutes',
  'player_renewal',
  'press_conference',
  'notice_injury',
  'notice_suspension',
  'notice_window_open',
  'notice_window_closing',
  'notice_contract_end',
  'notice_job_offer',
  'notice_youth_intake',
  'notice_stadium',
] as const;
export const inboxTopicSchema = z.enum(INBOX_TOPICS);
export const inboxChoiceSchema = z.strictObject({
  messageId: entityIdSchema,
  options: z
    .array(
      z.strictObject({
        id: entityIdSchema,
        label: z.string().min(1).max(160),
        /** Short, readable consequences (e.g. "Diretoria +3"). */
        effects: z.array(z.string().min(1).max(80)).max(5),
      }),
    )
    .min(2)
    .max(3),
  expiresOn: gameDateSchema,
  status: z.enum(['pending', 'resolved', 'expired']),
  chosenOptionId: entityIdSchema.optional(),
});
export const coachMessageSchema = z.strictObject({
  id: entityIdSchema,
  kind: z.enum([
    'match_report',
    'transfer_offer',
    'sponsor_offer',
    'board_message',
    'player_request',
    'press_conference',
    'notice',
  ]),
  /** Present on generated board, athlete, press and notice messages. */
  topic: inboxTopicSchema.optional(),
  /** Present on match reports. */
  situation: z.enum(['win', 'draw', 'loss']).optional(),
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(600),
  occurredOn: gameDateSchema,
  decision: inboxDecisionSchema.optional(),
  /** Decision of a generated message (see `ResolveInboxDecision`). */
  choice: inboxChoiceSchema.optional(),
  /** Seen by the coach (`MarkInboxRead`); absent from older servers. */
  read: z.boolean().optional(),
});
export const homeReadModelSchema = z.strictObject({
  ...readBase,
  managerName: nonEmptyTextSchema,
  careerName: careerNameSchema,
  coach: coachProfileSchema,
  club: clubSummarySchema.optional(),
  currentDate: gameDateSchema,
  season: z.int().positive(),
  balance: moneySchema.optional(),
  nextFixtureId: entityIdSchema.optional(),
  pendingActions: z.array(z.string().min(1).max(120)).max(20),
  /** Recent e-mails written in the coach personality's tone, newest first. */
  inbox: z.array(coachMessageSchema).max(20),
  /** Chemistry of the managed eleven (ADR 0011); absent without a club. */
  chemistry: chemistryReadModelSchema.optional(),
});
const squadPlayerSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  age: z.int().min(15).max(60),
  position: positionSchema,
  secondaryPositions: z.array(positionSchema),
  preferredSide: z.enum(['left', 'right', 'center']).optional(),
  shirtNumber: z.int().min(0).max(99).optional(),
  strength: z.number().min(1).max(100),
  traits: z.array(playerTraitSchema).max(2),
  condition: percentageSchema,
  morale: percentageSchema,
  matchSharpness: percentageSchema,
  squadStatus: z.enum(['starter', 'rotation', 'backup', 'listed', 'youth']),
  injuryRounds: z.int().min(0),
  suspensionRounds: z.int().min(0),
  availability: z.enum(['available', 'injured', 'suspended']),
  lastMatchRating: z.number().min(1).max(10).optional(),
  careerStats: z.strictObject({
    appearances: z.int().min(0),
    goals: z.int().min(0),
    assists: z.int().min(0),
    yellowCards: z.int().min(0),
    redCards: z.int().min(0),
    averageRating: z.number().min(0).max(10).optional(),
  }),
  hiddenEstimates: z.strictObject({
    potential: z.enum(['low', 'average', 'good', 'excellent']),
    consistency: z.enum(['low', 'average', 'good', 'excellent']),
    injuryRisk: z.enum(['low', 'average', 'high']),
    adaptation: z.enum(['low', 'average', 'good', 'excellent']),
    professionalism: z.enum(['low', 'average', 'good', 'excellent']),
    bigGames: z.enum(['low', 'average', 'good', 'excellent']),
  }),
});
export const squadReadModelSchema = z.strictObject({
  ...readBase,
  club: clubSummarySchema,
  players: z.array(squadPlayerSchema).max(100),
  lineupPlayerIds: z.array(entityIdSchema).max(100),
  tactic: z
    .strictObject({
      formation: formationSchema,
      mentality: mentalitySchema,
      attackDirection: attackDirectionSchema,
      marking: markingIntensitySchema,
      buildUp: buildUpStyleSchema.optional(),
      focus: attackFocusSchema.optional(),
      press: pressingStyleSchema.optional(),
      defensiveLine: defensiveLineSchema.optional(),
      markingStyle: markingStyleSchema.optional(),
    })
    .optional(),
  lineup: z
    .strictObject({
      formation: z.enum(['4-4-2', '4-3-3', '3-5-2']),
      starters: z.array(entityIdSchema).length(11),
      bench: z.array(entityIdSchema).max(12),
      reserves: z.array(entityIdSchema).max(100),
    })
    .optional(),
  /** Chemistry of the managed eleven (ADR 0011). */
  chemistry: chemistryReadModelSchema.optional(),
});
export const nextMatchReadModelSchema = z.strictObject({
  ...readBase,
  fixtureId: entityIdSchema,
  competition: nonEmptyTextSchema,
  round: z.int().positive(),
  date: gameDateSchema,
  homeClub: clubSummarySchema,
  awayClub: clubSummarySchema,
  status: z.enum(['scheduled', 'ready', 'running']),
  preparation: z.strictObject({
    opponent: clubSummarySchema,
    venue: z.enum(['home', 'away']),
    recentForm: z.array(z.enum(['W', 'D', 'L'])).max(5),
    approximateStrength: z.enum([
      'much_weaker',
      'weaker',
      'similar',
      'stronger',
      'much_stronger',
    ]),
    absences: z
      .array(
        z.strictObject({
          playerId: entityIdSchema,
          playerName: nonEmptyTextSchema,
          reason: z.enum(['injury', 'suspension']),
          rounds: z.int().positive(),
        }),
      )
      .max(100),
  }),
});
const standingRowSchema = z.strictObject({
  position: z.int().positive(),
  club: clubSummarySchema,
  played: z.int().min(0),
  won: z.int().min(0),
  drawn: z.int().min(0),
  lost: z.int().min(0),
  goalsFor: z.int().min(0),
  goalsAgainst: z.int().min(0),
  goalDifference: z.int(),
  points: z.int().min(0),
});
export const standingsReadModelSchema = z.strictObject({
  ...readBase,
  competitionId: entityIdSchema,
  competition: nonEmptyTextSchema,
  rows: z.array(standingRowSchema).min(2).max(100),
});
/** How a chance was built (match-v4, ADR 0015). */
export const matchPlaySchema = z.enum([
  'build_up',
  'counter',
  'individual',
  'cross',
  'long_shot',
  'defensive_error',
]);
export const chanceOutcomeSchema = z.enum([
  'goal',
  'saved',
  'off_target',
  'blocked',
  'woodwork',
]);
/**
 * Playback speeds of the match feed (decision 18: 0.5× is user selectable).
 * The server sends the full list; the list without 0.5× (before it reached
 * the contract) stays valid so older payloads and clients keep parsing.
 */
export const playbackSpeedsSchema = z.union([
  z.tuple([
    z.literal(0.5),
    z.literal(1),
    z.literal(2),
    z.literal(4),
    z.literal(8),
  ]),
  z.tuple([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
]);
const timelineEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('chance'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    xg: z.number().min(0).max(1),
    // Shooter, assistant, play and outcome exist since match-v4; results
    // recorded by older engine versions have none of them.
    playerId: entityIdSchema.optional(),
    assistId: entityIdSchema.optional(),
    play: matchPlaySchema.optional(),
    outcome: chanceOutcomeSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('goal'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    playerId: entityIdSchema,
    assistId: entityIdSchema.optional(),
    play: matchPlaySchema.optional(),
  }),
  z.strictObject({
    type: z.literal('card'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    playerId: entityIdSchema,
    card: z.enum(['yellow', 'red']),
  }),
  z.strictObject({
    type: z.literal('injury'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    playerId: entityIdSchema,
    rounds: z.int().positive(),
  }),
  z.strictObject({
    type: z.literal('substitution'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    playerOutId: entityIdSchema,
    playerInId: entityIdSchema,
    source: z.enum(['manager', 'automatic']).optional(),
  }),
  z.strictObject({
    type: z.literal('tactical_change'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    formation: z.string().min(1),
    mentality: z.string().min(1),
  }),
]);
export const postMatchReadModelSchema = z.strictObject({
  ...readBase,
  matchId: entityIdSchema,
  fixtureId: entityIdSchema,
  homeClub: clubSummarySchema,
  awayClub: clubSummarySchema,
  score: scoreSchema,
  timeline: z.array(timelineEventSchema).max(500),
  participants: z
    .array(
      z.strictObject({
        id: entityIdSchema,
        name: nonEmptyTextSchema,
        side: z.enum(['home', 'away']),
      }),
    )
    .max(80)
    .optional(),
  tableUpdated: z.boolean(),
  playback: z.strictObject({
    modes: z.tuple([
      z.literal('instant'),
      z.literal('fast'),
      z.literal('feed'),
    ]),
    speeds: playbackSpeedsSchema,
    canSkip: z.literal(true),
  }),
});
export type HomeReadModel = z.infer<typeof homeReadModelSchema>;
export type CoachMessage = z.infer<typeof coachMessageSchema>;
export type InboxDecision = z.infer<typeof inboxDecisionSchema>;
export type InboxChoice = z.infer<typeof inboxChoiceSchema>;
export type InboxTopic = z.infer<typeof inboxTopicSchema>;
export type SquadReadModel = z.infer<typeof squadReadModelSchema>;
export type NextMatchReadModel = z.infer<typeof nextMatchReadModelSchema>;
export type StandingsReadModel = z.infer<typeof standingsReadModelSchema>;
export type PostMatchReadModel = z.infer<typeof postMatchReadModelSchema>;

/** Squad summary of the Central (ADR 0014): what the list rows show. */
const bundleSquadSchema = z.strictObject({
  club: clubSummarySchema,
  players: z
    .array(
      z.strictObject({
        id: entityIdSchema,
        name: nonEmptyTextSchema,
        age: z.int().min(15).max(60),
        position: positionSchema,
        shirtNumber: z.int().min(0).max(99).optional(),
        strength: z.number().min(1).max(100),
        condition: percentageSchema,
        morale: percentageSchema,
        squadStatus: z.enum([
          'starter',
          'rotation',
          'backup',
          'listed',
          'youth',
        ]),
        availability: z.enum(['available', 'injured', 'suspended']),
      }),
    )
    .max(100),
  lineupPlayerIds: z.array(entityIdSchema).max(100),
  formation: formationSchema.optional(),
});
/**
 * The whole Central in one read (`GET /v1/careers/:id/bundle`, ADR 0014):
 * home, squad summary, next match, league table and inbox at one aggregate
 * version, served with `ETag` by that version.
 */
export const careerBundleReadModelSchema = z.strictObject({
  ...readBase,
  contentVersion: nonEmptyTextSchema,
  home: homeReadModelSchema,
  squad: bundleSquadSchema.optional(),
  nextMatch: nextMatchReadModelSchema.optional(),
  standings: standingsReadModelSchema.optional(),
  inbox: z.array(coachMessageSchema).max(20),
});
export type CareerBundleReadModel = z.infer<typeof careerBundleReadModelSchema>;

import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type {
  Id,
  InjurySeverity,
  MatchIntent,
  MatchSide,
  MatchType,
  PpwDate,
  WrestlingEventType,
} from "../../domain/src/types.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import {
  resolvedShowSegmentsForEvent,
  type ResolvedSegmentOutcomeBand,
} from "./programme-segments.js";
import type { DetailedShowSegmentType, AttackPresentation, AttackObjective, VideoPackageKind, VideoPackageObjective, VideoPackageReveal, LiveAppearanceKind, LiveAppearanceObjective } from "./planning.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const PLAYER_SHOW_HISTORY_LIMIT = 12;

export type PlayerShowCrowdFactorScope = "ALIGNMENT" | "PROGRAMME" | "PACING";
export type PlayerShowCrowdTone = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
export type PlayerShowCrowdReasonCode =
  | "FACE_HEEL_CLARITY"
  | "SAME_ALIGNMENT"
  | "TWEENER_TENSION"
  | "ALIGNMENT_VOLATILITY"
  | "HOT_PROGRAMME"
  | "PROGRAMME_REPETITION"
  | "COOL_PROGRAMME"
  | "REPEATED_INTENT"
  | "REPEATED_STYLE"
  | "BACK_TO_BACK_INTENSITY"
  | "PACE_CONTRAST"
  | "INTENSITY_BUILD"
  | "BREATHER"
  | "HIGH_INTENSITY_STREAK"
  | "FLAT_CLOSER"
  | "BIG_CLOSER";

export interface PlayerShowCrowdFactorView {
  scope: PlayerShowCrowdFactorScope;
  matchId: Id;
  matchOrder: number;
  reason: PlayerShowCrowdReasonCode;
  label: string;
  impact: number;
}

export interface PlayerShowCrowdStoryView {
  baseCrowdResponse: number;
  finalCrowdResponse: number;
  adjustment: number;
  tone: PlayerShowCrowdTone;
  summary: string;
  positiveDrivers: PlayerShowCrowdFactorView[];
  negativeDrivers: PlayerShowCrowdFactorView[];
}

export interface PlayerShowParticipantView {
  personId: Id;
  name: string;
  side: MatchSide;
  won: boolean;
}

export interface PlayerShowInjuryView {
  injuryId: Id;
  personId: Id;
  personName: string;
  severity: InjurySeverity;
  weeksOut: number;
}

export interface PlayerShowTitleOutcomeView {
  championshipId: Id;
  championshipName: string;
  titleChanged: boolean;
  previousHolderName: string | null;
  winnerHolderName: string;
}

export type PlayerShowStyleDelivery = "NAILED" | "DELIVERED" | "STRETCHED" | "MISSED";

export interface PlayerShowMatchStyleView {
  loadBand: "LIGHT" | "STANDARD" | "DEMANDING" | "EXTREME";
  physicalLoad: number;
  creativeLoad: number;
  totalLoad: number;
  capability: number;
  shortfall: number;
  realizedUpside: number;
  difficultyPenalty: number;
  delivery: PlayerShowStyleDelivery;
}

export interface PlayerShowMatchView {
  matchId: Id;
  order: number;
  isMainEvent: boolean;
  type: MatchType;
  intent: MatchIntent;
  plannedLengthMinutes: number;
  actualLengthMinutes: number;
  criticalRatingStars: number;
  executionQuality: number;
  crowdResponse: number;
  styleResult: PlayerShowMatchStyleView | null;
  finishChangedDueToInjury: boolean;
  participants: PlayerShowParticipantView[];
  winnerNames: string[];
  interference: { personId: Id; name: string; aidedSide: "A" | "B"; outcome: "SUCCESS" | "THWARTED" | "ABORTED" | null } | null;
  titleOutcomes: PlayerShowTitleOutcomeView[];
  injuries: PlayerShowInjuryView[];
  crowdFlowFactors: PlayerShowCrowdFactorView[];
}

export interface PlayerShowSegmentParticipantView {
  personId: Id;
  name: string;
}

export interface PlayerShowSegmentFactorView {
  label: string;
  impact: number;
}

export interface PlayerShowSegmentView {
  segmentId: Id;
  draftSegmentId: string;
  order: number;
  type: DetailedShowSegmentType;
  plannedLengthMinutes: number;
  participants: PlayerShowSegmentParticipantView[];
  videoSubjectPersonId: Id | null;
  videoSubjectName: string | null;
  videoKind: VideoPackageKind | null;
  videoObjective: VideoPackageObjective | null;
  videoReveal: VideoPackageReveal | null;
  liveKind: LiveAppearanceKind | null;
  liveObjective: LiveAppearanceObjective | null;
  programmeId: Id | null;
  attackerPersonId: Id | null;
  victimPersonId: Id | null;
  rescuerPersonId: Id | null;
  sourceMatchId: Id | null;
  victimMatchOutcome: "WON" | "LOST" | "DRAW" | null;
  initiatorPersonId: Id | null;
  targetPersonId: Id | null;
  signingOutcome: "SIGNED" | "REJECTED" | "WALKOUT" | "BRAWL" | null;
  challengeResponse: "ACCEPTED" | "REFUSED" | "LEFT_OPEN" | null;
  interruptionOutcome: "VERBAL_EXCHANGE" | "INTERRUPTER_PREVAILS" | "SPEAKER_PREVAILS" | "BRAWL" | null;
  stableId: Id | null;
  stableName: string | null;
  stableInvitationOutcome: "ACCEPTED" | "REFUSED" | null;
  stableExitOutcome: "EXPELLED" | "WALKED_OUT" | null;
  stableReconciliationOutcome: "RECONCILED" | "REBUFFED" | null;
  attackPresentation: AttackPresentation | null;
  attackObjective: AttackObjective | null;
  turnPersonId: Id | null;
  turnTargetAlignment: WrestlerAlignment | null;
  turnPresentation: "REVEAL" | "BETRAYAL" | null;
  betrayedPersonId: Id | null;
  executionQuality: number | null;
  crowdResponse: number | null;
  outcomeBand: ResolvedSegmentOutcomeBand | null;
  factors: PlayerShowSegmentFactorView[];
}

export type PlayerShowRunningOrderView =
  | { kind: "MATCH"; order: number; match: PlayerShowMatchView }
  | { kind: "SEGMENT"; order: number; segment: PlayerShowSegmentView };

export interface PlayerShowResultView {
  eventId: Id;
  date: PpwDate;
  type: WrestlingEventType;
  marketName: string;
  venueName: string;
  venueCapacity: number;
  attendance: number;
  attendancePercentOfCapacity: number;
  gateRevenue: number;
  totalCost: number;
  netResult: number;
  averageMatchRating: number;
  bestMatchRating: number;
  crowdResponse: number;
  matchCount: number;
  segmentCount: number;
  titleChangeCount: number;
  injuryCount: number;
  crowdStory: PlayerShowCrowdStoryView | null;
  matches: PlayerShowMatchView[];
  segments: PlayerShowSegmentView[];
  runningOrder: PlayerShowRunningOrderView[];
}

export interface PlayerShowHistoryView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  promotion: {
    promotionId: Id;
    name: string;
  } | null;
  shows: PlayerShowResultView[];
}

type LedgerEntry = ApplicationWorldAggregate["state"]["ledger"][number];

const CROWD_REASON_LABELS: Record<PlayerShowCrowdReasonCode, string> = {
  FACE_HEEL_CLARITY: "Clear face-versus-heel dynamic",
  SAME_ALIGNMENT: "Less obvious emotional side",
  TWEENER_TENSION: "Uncertain allegiance added intrigue",
  ALIGNMENT_VOLATILITY: "Recent alignment changes confused the crowd",
  HOT_PROGRAMME: "Hot Programme investment",
  PROGRAMME_REPETITION: "Programme felt overexposed",
  COOL_PROGRAMME: "Programme lacked heat",
  REPEATED_INTENT: "Similar match rhythm repeated",
  REPEATED_STYLE: "Similar match style repeated",
  BACK_TO_BACK_INTENSITY: "Back-to-back intensity taxed the crowd",
  PACE_CONTRAST: "Change of pace refreshed the room",
  INTENSITY_BUILD: "Card intensity built at the right time",
  BREATHER: "Breather reset the crowd",
  HIGH_INTENSITY_STREAK: "Too much sustained intensity",
  FLAT_CLOSER: "Closing slot felt too low-key",
  BIG_CLOSER: "Big closer landed in the right slot",
};

function dateOrdinal(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return (((date.year - 1) * aggregate.state.ruleset.weeksPerYear) + (date.week - 1)) * 7 + date.day;
}

function holderName(aggregate: ApplicationWorldAggregate, holderId: Id): string {
  const person = aggregate.state.people.find((candidate) => candidate.id === holderId);
  if (person) return person.name;
  const team = (aggregate.state.teams ?? []).find((candidate) => candidate.id === holderId);
  return team?.name ?? "Unknown holder";
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

function validatedLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("show-history limit must be an integer from 1 to 50");
  }
  return limit;
}

function isCrowdReasonCode(value: unknown): value is PlayerShowCrowdReasonCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CROWD_REASON_LABELS, value);
}

function crowdFactor(
  entry: LedgerEntry | undefined,
  scope: PlayerShowCrowdFactorScope,
  matchId: Id,
  matchOrder: number,
  modifierKey: string,
  reasonKey: string,
): PlayerShowCrowdFactorView | null {
  if (!entry) return null;
  const impact = entry.payload[modifierKey];
  const reason = entry.payload[reasonKey];
  if (typeof impact !== "number" || !Number.isFinite(impact) || Math.abs(impact) < 0.45) return null;
  if (!isCrowdReasonCode(reason)) return null;
  return {
    scope,
    matchId,
    matchOrder,
    reason,
    label: CROWD_REASON_LABELS[reason],
    impact: Math.round(impact * 10) / 10,
  };
}

function frozenCrowdFactors(
  entry: LedgerEntry | undefined,
  matchId: Id,
  matchOrder: number,
): PlayerShowCrowdFactorView[] {
  const hasSplitAlignment = Boolean(
    entry
    && (
      typeof entry.payload.showFlowAlignmentBaseModifier === "number"
      || typeof entry.payload.showFlowAlignmentVolatilityModifier === "number"
    )
  );
  const factors = [
    ...(hasSplitAlignment ? [
      crowdFactor(entry, "ALIGNMENT", matchId, matchOrder, "showFlowAlignmentBaseModifier", "showFlowAlignmentBaseReason"),
      crowdFactor(entry, "ALIGNMENT", matchId, matchOrder, "showFlowAlignmentVolatilityModifier", "showFlowAlignmentVolatilityReason"),
    ] : [
      crowdFactor(entry, "ALIGNMENT", matchId, matchOrder, "showFlowAlignmentModifier", "showFlowAlignmentReason"),
    ]),
    crowdFactor(entry, "PROGRAMME", matchId, matchOrder, "showFlowProgrammeModifier", "showFlowProgrammeReason"),
    crowdFactor(entry, "PACING", matchId, matchOrder, "showFlowPacingModifier", "showFlowPacingReason"),
  ];
  return factors.filter((factor): factor is PlayerShowCrowdFactorView => factor !== null);
}

function frozenStyleResult(
  entry: LedgerEntry | undefined,
  executionQuality: number,
): PlayerShowMatchStyleView | null {
  if (!entry || entry.payload.styleResolver !== "DIMENSIONAL") return null;
  const physicalLoad = entry.payload.stylePhysicalLoad;
  const creativeLoad = entry.payload.styleCreativeLoad;
  const totalLoad = entry.payload.styleTotalLoad;
  const loadBand = entry.payload.styleLoadBand;
  const capability = entry.payload.styleCapability;
  const shortfall = entry.payload.styleShortfall;
  const realizedUpside = entry.payload.styleRealizedUpside;
  const difficultyPenalty = entry.payload.styleDifficultyPenalty;
  if (
    typeof physicalLoad !== "number" || !Number.isFinite(physicalLoad)
    || typeof creativeLoad !== "number" || !Number.isFinite(creativeLoad)
    || typeof totalLoad !== "number" || !Number.isFinite(totalLoad)
    || !["LIGHT", "STANDARD", "DEMANDING", "EXTREME"].includes(String(loadBand))
    || typeof capability !== "number" || !Number.isFinite(capability)
    || typeof shortfall !== "number" || !Number.isFinite(shortfall)
    || typeof realizedUpside !== "number" || !Number.isFinite(realizedUpside)
    || typeof difficultyPenalty !== "number" || !Number.isFinite(difficultyPenalty)
  ) return null;

  const delivery: PlayerShowStyleDelivery = executionQuality >= 82 && shortfall < 10
    ? "NAILED"
    : executionQuality >= 68 && shortfall < 18
      ? "DELIVERED"
      : executionQuality >= 52
        ? "STRETCHED"
        : "MISSED";
  const round = (value: number): number => Math.round(value * 10) / 10;
  return {
    loadBand: loadBand as PlayerShowMatchStyleView["loadBand"],
    physicalLoad: round(physicalLoad),
    creativeLoad: round(creativeLoad),
    totalLoad: round(totalLoad),
    capability: round(capability),
    shortfall: round(shortfall),
    realizedUpside: round(realizedUpside),
    difficultyPenalty: round(difficultyPenalty),
    delivery,
  };
}

function segmentFactors(segment: ReturnType<typeof resolvedShowSegmentsForEvent>[number]): PlayerShowSegmentFactorView[] {
  const factors: PlayerShowSegmentFactorView[] = [];
  if (Math.abs(segment.programmeModifier) >= 0.45) {
    factors.push({
      label: segment.programmeModifier > 0 ? "Programme heat helped" : "Programme heat / repetition hurt",
      impact: segment.programmeModifier,
    });
  }
  if (Math.abs(segment.moraleModifier) >= 0.45) {
    factors.push({
      label: segment.moraleModifier > 0 ? "Confidence helped the delivery" : "Low morale hurt the delivery",
      impact: segment.moraleModifier,
    });
  }
  if (segment.fatigueModifier <= -0.45) {
    factors.push({ label: "Fatigue hurt the delivery", impact: segment.fatigueModifier });
  }
  if (Math.abs(segment.angleFitModifier) >= 0.45) {
    factors.push({
      label: segment.type === "RESCUE"
        ? (segment.angleFitModifier > 0 ? "Rescue drew a positive reaction" : "Rescue lacked credibility")
        : (segment.angleFitModifier > 0 ? "Attack angle connected with the crowd" : "Attack angle struggled to land"),
      impact: segment.angleFitModifier,
    });
  }
  if (segment.alignmentVolatilityModifier <= -0.45) {
    factors.push({ label: "Recent alignment changes hurt credibility", impact: segment.alignmentVolatilityModifier });
  }
  return factors.sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact));
}

function mergedRunningOrder(
  matches: PlayerShowMatchView[],
  segments: PlayerShowSegmentView[],
): PlayerShowRunningOrderView[] {
  if (segments.length === 0) {
    return matches.map((match, index) => ({ kind: "MATCH", order: index + 1, match }));
  }
  const segmentsByOrder = new Map(segments.map((segment) => [segment.order, segment]));
  const totalSlots = matches.length + segments.length;
  const order: PlayerShowRunningOrderView[] = [];
  let matchIndex = 0;
  for (let slotOrder = 1; slotOrder <= totalSlots; slotOrder += 1) {
    const segment = segmentsByOrder.get(slotOrder);
    if (segment) {
      order.push({ kind: "SEGMENT", order: slotOrder, segment });
      continue;
    }
    const match = matches[matchIndex];
    if (match) {
      order.push({ kind: "MATCH", order: slotOrder, match });
      matchIndex += 1;
    }
  }
  for (; matchIndex < matches.length; matchIndex += 1) {
    order.push({ kind: "MATCH", order: order.length + 1, match: matches[matchIndex]! });
  }
  for (const segment of segments) {
    if (!order.some((slot) => slot.kind === "SEGMENT" && slot.segment.segmentId === segment.segmentId)) {
      order.push({ kind: "SEGMENT", order: order.length + 1, segment });
    }
  }
  return order;
}

function frozenCrowdStory(
  eventLedger: LedgerEntry | undefined,
  matches: PlayerShowMatchView[],
): PlayerShowCrowdStoryView | null {
  if (!eventLedger || eventLedger.payload.showFlowFrozen !== true) return null;
  const base = eventLedger.payload.showFlowBaseCrowdResponse;
  const final = eventLedger.payload.crowdResponse;
  const adjustment = eventLedger.payload.showFlowAdjustment;
  if (
    typeof base !== "number" || !Number.isFinite(base)
    || typeof final !== "number" || !Number.isFinite(final)
    || typeof adjustment !== "number" || !Number.isFinite(adjustment)
  ) return null;

  const factors = matches.flatMap((match) => match.crowdFlowFactors);
  const positiveDrivers = factors
    .filter((factor) => factor.impact > 0)
    .sort((left, right) => right.impact - left.impact || left.matchOrder - right.matchOrder)
    .slice(0, 2);
  const negativeDrivers = factors
    .filter((factor) => factor.impact < 0)
    .sort((left, right) => left.impact - right.impact || left.matchOrder - right.matchOrder)
    .slice(0, 2);
  const tone: PlayerShowCrowdTone = adjustment >= 0.5
    ? "POSITIVE"
    : adjustment <= -0.5
      ? "NEGATIVE"
      : "NEUTRAL";
  const summary = tone === "POSITIVE"
    ? "The way the card was structured lifted the room above the underlying match and segment responses."
    : tone === "NEGATIVE"
      ? "The card lost some crowd energy across the running order even though the individual performances still stood on their own."
      : "The card broadly delivered the crowd response generated by its individual matches and segments.";

  return {
    baseCrowdResponse: Math.round(base * 10) / 10,
    finalCrowdResponse: Math.round(final * 10) / 10,
    adjustment: Math.round(adjustment * 10) / 10,
    tone,
    summary,
    positiveDrivers,
    negativeDrivers,
  };
}

/**
 * Builds a player-safe show-history projection for the promotion they control.
 * It deliberately exposes no rival contract, planning or private business data.
 * Crowd-flow diagnosis is read only from frozen historical ledger evidence; old
 * shows without that evidence remain compatible and are never reinterpreted from
 * mutable present-day Programme or alignment state.
 */
export function buildPlayerShowHistory(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
  limit = PLAYER_SHOW_HISTORY_LIMIT,
): PlayerShowHistoryView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const safeLimit = validatedLimit(limit);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const currentDate = { ...aggregate.state.world.currentDate };

  if (!control) {
    return {
      world: { worldId: aggregate.state.world.id, name: aggregate.state.world.name, currentDate },
      player: { playerId: membership.playerId, promotionId: null },
      promotion: null,
      shows: [],
    };
  }

  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} no longer exists`);

  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const marketsById = new Map(aggregate.state.markets.map((market) => [market.id, market]));
  const venuesById = new Map(aggregate.state.venues.map((venue) => [venue.id, venue]));
  const championshipsById = new Map((aggregate.state.championships ?? []).map((championship) => [championship.id, championship]));
  const contestsByMatch = new Map<Id, NonNullable<ApplicationWorldAggregate["state"]["championshipContests"]>>();
  for (const contest of aggregate.state.championshipContests ?? []) {
    const contests = contestsByMatch.get(contest.matchId) ?? [];
    contests.push(contest);
    contestsByMatch.set(contest.matchId, contests);
  }
  const injuriesByMatch = new Map<Id, ApplicationWorldAggregate["state"]["injuries"]>();
  for (const injury of aggregate.state.injuries) {
    const injuries = injuriesByMatch.get(injury.matchId) ?? [];
    injuries.push(injury);
    injuriesByMatch.set(injury.matchId, injuries);
  }
  const participantsByMatch = new Map<Id, ApplicationWorldAggregate["state"]["matchParticipants"]>();
  for (const participant of aggregate.state.matchParticipants) {
    const participants = participantsByMatch.get(participant.matchId) ?? [];
    participants.push(participant);
    participantsByMatch.set(participant.matchId, participants);
  }
  const eventLedgerByEvent = new Map<Id, LedgerEntry>();
  const matchLedgerByMatch = new Map<Id, LedgerEntry>();
  for (const entry of aggregate.state.ledger) {
    const primaryId = entry.entityIds[0];
    if (!primaryId) continue;
    if (entry.type === "EVENT_COMPLETED") eventLedgerByEvent.set(primaryId, entry);
    if (entry.type === "MATCH_COMPLETED") matchLedgerByMatch.set(primaryId, entry);
  }

  const shows = aggregate.state.events
    .filter((event) => event.promotionId === promotion.id && event.status === "COMPLETED")
    .sort((left, right) => dateOrdinal(aggregate, right.date) - dateOrdinal(aggregate, left.date) || right.id.localeCompare(left.id))
    .slice(0, safeLimit)
    .map((event): PlayerShowResultView => {
      const venue = venuesById.get(event.venueId);
      const eventMatches = aggregate.state.matches
        .filter((match) => match.eventId === event.id && match.promotionId === promotion.id && match.status === "COMPLETED")
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
      const mainEventOrder = eventMatches.reduce((highest, match) => Math.max(highest, match.order), 0);

      const matches = eventMatches.map((match): PlayerShowMatchView => {
        const participants = (participantsByMatch.get(match.id) ?? [])
          .map((participant): PlayerShowParticipantView => ({
            personId: participant.personId,
            name: peopleById.get(participant.personId)?.name ?? "Unknown wrestler",
            side: participant.side,
            won: participant.won,
          }))
          .sort((left, right) => left.side.localeCompare(right.side) || left.name.localeCompare(right.name));
        const titleOutcomes = (contestsByMatch.get(match.id) ?? []).map((contest): PlayerShowTitleOutcomeView => ({
          championshipId: contest.championshipId,
          championshipName: championshipsById.get(contest.championshipId)?.name ?? "Championship",
          titleChanged: contest.titleChanged,
          previousHolderName: contest.previousHolderId ? holderName(aggregate, contest.previousHolderId) : null,
          winnerHolderName: holderName(aggregate, contest.winnerHolderId),
        }));
        const injuries = (injuriesByMatch.get(match.id) ?? []).map((injury): PlayerShowInjuryView => ({
          injuryId: injury.id,
          personId: injury.personId,
          personName: peopleById.get(injury.personId)?.name ?? "Unknown wrestler",
          severity: injury.severity,
          weeksOut: injury.weeksOut,
        }));

        return {
          matchId: match.id,
          order: match.order,
          isMainEvent: match.order === mainEventOrder,
          type: match.type,
          intent: match.intent,
          plannedLengthMinutes: match.plannedLengthMinutes,
          actualLengthMinutes: match.actualLengthMinutes,
          criticalRatingStars: match.criticalRatingStars,
          executionQuality: match.executionQuality,
          crowdResponse: match.crowdResponse,
          styleResult: frozenStyleResult(matchLedgerByMatch.get(match.id), match.executionQuality),
          finishChangedDueToInjury: match.finishChangedDueToInjury,
          participants,
          winnerNames: participants.filter((participant) => participant.won).map((participant) => participant.name),
          interference: match.interference ? {
            personId: match.interference.personId,
            name: peopleById.get(match.interference.personId)?.name ?? "Unknown wrestler",
            aidedSide: match.interference.aidedSide,
            outcome: match.interference.outcome,
          } : null,
          titleOutcomes,
          injuries,
          crowdFlowFactors: frozenCrowdFactors(matchLedgerByMatch.get(match.id), match.id, match.order),
        };
      });

      const segments = resolvedShowSegmentsForEvent(aggregate.state, event.id).map((segment): PlayerShowSegmentView => ({
        segmentId: segment.ledgerId,
        draftSegmentId: segment.draftSegmentId,
        order: segment.slotOrder,
        type: segment.type,
        plannedLengthMinutes: segment.plannedLengthMinutes,
        participants: segment.participantIds.map((personId) => ({
          personId,
          name: peopleById.get(personId)?.name ?? "Unknown wrestler",
        })),
        programmeId: segment.programmeId,
        videoSubjectPersonId: segment.videoSubjectPersonId,
        videoSubjectName: segment.videoSubjectPersonId ? (peopleById.get(segment.videoSubjectPersonId)?.name ?? null) : null,
        videoKind: segment.videoKind,
        videoObjective: segment.videoObjective,
        videoReveal: segment.videoReveal,
        liveKind: segment.liveKind,
        liveObjective: segment.liveObjective,
        attackerPersonId: segment.attackerPersonId,
        victimPersonId: segment.victimPersonId,
        rescuerPersonId: segment.rescuerPersonId,
        sourceMatchId: segment.sourceMatchId,
        victimMatchOutcome: segment.victimMatchOutcome,
        initiatorPersonId: segment.initiatorPersonId,
        targetPersonId: segment.targetPersonId,
        signingOutcome: segment.signingOutcome,
        challengeResponse: segment.challengeResponse,
        interruptionOutcome: segment.interruptionOutcome,
        stableId: segment.stableId,
        stableName: segment.stableName,
        stableInvitationOutcome: segment.stableInvitationOutcome,
        stableExitOutcome: segment.stableExitOutcome,
        stableReconciliationOutcome: segment.stableReconciliationOutcome,
        attackPresentation: segment.attackPresentation,
        attackObjective: segment.attackObjective,
        turnPersonId: segment.turnPersonId,
        turnTargetAlignment: segment.turnTargetAlignment,
        turnPresentation: segment.turnPresentation,
        betrayedPersonId: segment.betrayedPersonId,
        executionQuality: segment.executionQuality,
        crowdResponse: segment.crowdResponse,
        outcomeBand: segment.outcomeBand,
        factors: segmentFactors(segment),
      }));
      const runningOrder = mergedRunningOrder(matches, segments);
      const titleChangeCount = matches.reduce(
        (sum, match) => sum + match.titleOutcomes.filter((outcome) => outcome.titleChanged).length,
        0,
      );
      const injuryCount = matches.reduce((sum, match) => sum + match.injuries.length, 0);
      const venueCapacity = venue?.capacity ?? 0;

      return {
        eventId: event.id,
        date: { ...event.date },
        type: event.type,
        marketName: marketsById.get(event.marketId)?.name ?? "Unknown market",
        venueName: venue?.name ?? "Unknown venue",
        venueCapacity,
        attendance: event.attendance,
        attendancePercentOfCapacity: venueCapacity > 0 ? clampPercentage((event.attendance / venueCapacity) * 100) : 0,
        gateRevenue: event.gateRevenue,
        totalCost: event.totalCost,
        netResult: event.netResult,
        averageMatchRating: event.averageMatchRating,
        bestMatchRating: event.bestMatchRating,
        crowdResponse: event.crowdResponse,
        matchCount: matches.length,
        segmentCount: segments.length,
        titleChangeCount,
        injuryCount,
        crowdStory: frozenCrowdStory(eventLedgerByEvent.get(event.id), matches),
        matches,
        segments,
        runningOrder,
      };
    });

  return {
    world: { worldId: aggregate.state.world.id, name: aggregate.state.world.name, currentDate },
    player: { playerId: membership.playerId, promotionId: promotion.id },
    promotion: { promotionId: promotion.id, name: promotion.name },
    shows,
  };
}

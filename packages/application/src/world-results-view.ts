import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type {
  Id,
  InjurySeverity,
  MatchSide,
  MatchType,
  PpwDate,
  WrestlingEventType,
} from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/index.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import {
  resolvedShowSegmentsForEvent,
  type ResolvedSegmentOutcomeBand,
} from "./programme-segments.js";
import type { DetailedShowSegmentType, AttackPresentation, VideoPackageKind, VideoPackageReveal, LiveAppearancePresentation } from "./planning.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const WORLD_RESULTS_HISTORY_LIMIT = 30;

export interface PlayerWorldResultParticipantView {
  personId: Id;
  name: string;
  side: MatchSide;
  won: boolean;
}

export interface PlayerWorldResultInjuryView {
  injuryId: Id;
  personId: Id;
  personName: string;
  severity: InjurySeverity;
  weeksOut: number;
}

export interface PlayerWorldResultTitleOutcomeView {
  championshipId: Id;
  championshipName: string;
  titleChanged: boolean;
  previousHolderName: string | null;
  winnerHolderName: string;
}

export interface PlayerWorldResultMatchView {
  matchId: Id;
  order: number;
  isMainEvent: boolean;
  type: MatchType;
  actualLengthMinutes: number;
  criticalRatingStars: number;
  crowdResponse: number;
  participants: PlayerWorldResultParticipantView[];
  winnerNames: string[];
  interference: { personId: Id; name: string; aidedSide: "A" | "B"; outcome: "SUCCESS" | "THWARTED" | "ABORTED" | null } | null;
  titleOutcomes: PlayerWorldResultTitleOutcomeView[];
  injuries: PlayerWorldResultInjuryView[];
}

export interface PlayerWorldResultSegmentView {
  segmentId: Id;
  order: number;
  type: DetailedShowSegmentType;
  participants: Array<{ personId: Id; name: string }>;
  videoSubjectName: string | null;
  videoKind: VideoPackageKind | null;
  videoReveal: VideoPackageReveal | null;
  liveAppearanceKind: "DEBUT" | "RETURN" | "SURPRISE_REVEAL" | "INTRODUCTION" | null;
  liveAppearancePresentation: LiveAppearancePresentation | null;
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
  turnPersonId: Id | null;
  turnTargetAlignment: WrestlerAlignment | null;
  turnPresentation: "REVEAL" | "BETRAYAL" | null;
  betrayedPersonId: Id | null;
  crowdResponse: number | null;
  outcomeBand: ResolvedSegmentOutcomeBand | null;
}

export type PlayerWorldResultRunningOrderView =
  | { kind: "MATCH"; order: number; match: PlayerWorldResultMatchView }
  | { kind: "SEGMENT"; order: number; segment: PlayerWorldResultSegmentView };

export interface PlayerWorldResultShowView {
  eventId: Id;
  date: PpwDate;
  type: WrestlingEventType;
  promotionId: Id;
  promotionName: string;
  isPlayerPromotion: boolean;
  marketName: string;
  venueName: string;
  venueCapacity: number;
  attendance: number;
  attendancePercentOfCapacity: number;
  averageMatchRating: number;
  bestMatchRating: number;
  crowdResponse: number;
  matchCount: number;
  segmentCount: number;
  titleChangeCount: number;
  injuryCount: number;
  matches: PlayerWorldResultMatchView[];
  segments: PlayerWorldResultSegmentView[];
  runningOrder: PlayerWorldResultRunningOrderView[];
}

export interface PlayerWorldResultsView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
    revision: number;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  shows: PlayerWorldResultShowView[];
}

function dateOrder(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return ppwDateToWeekIndex(date, aggregate.state.ruleset.weeksPerYear) * 7 + date.day;
}

function holderName(aggregate: ApplicationWorldAggregate, holderId: Id): string {
  const person = aggregate.state.people.find((candidate) => candidate.id === holderId);
  if (person) return person.name;
  const team = (aggregate.state.teams ?? []).find((candidate) => candidate.id === holderId);
  return team?.name ?? "Unknown holder";
}

function validatedLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("world-results limit must be an integer from 1 to 100");
  }
  return limit;
}

function percentage(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

function mergedRunningOrder(
  matches: PlayerWorldResultMatchView[],
  segments: PlayerWorldResultSegmentView[],
): PlayerWorldResultRunningOrderView[] {
  if (segments.length === 0) {
    return matches.map((match, index) => ({ kind: "MATCH", order: index + 1, match }));
  }
  const segmentsByOrder = new Map(segments.map((segment) => [segment.order, segment]));
  const totalSlots = matches.length + segments.length;
  const result: PlayerWorldResultRunningOrderView[] = [];
  let matchIndex = 0;
  for (let slotOrder = 1; slotOrder <= totalSlots; slotOrder += 1) {
    const segment = segmentsByOrder.get(slotOrder);
    if (segment) {
      result.push({ kind: "SEGMENT", order: slotOrder, segment });
      continue;
    }
    const match = matches[matchIndex];
    if (match) {
      result.push({ kind: "MATCH", order: slotOrder, match });
      matchIndex += 1;
    }
  }
  for (; matchIndex < matches.length; matchIndex += 1) {
    result.push({ kind: "MATCH", order: result.length + 1, match: matches[matchIndex]! });
  }
  for (const segment of segments) {
    if (!result.some((slot) => slot.kind === "SEGMENT" && slot.segment.segmentId === segment.segmentId)) {
      result.push({ kind: "SEGMENT", order: result.length + 1, segment });
    }
  }
  return result;
}

/**
 * Public completed-show history across the shared PPW World. Match cards,
 * winners, title outcomes, attendance and injuries are public wrestling
 * history. Rival business economics, contracts, internal condition, booking
 * intent, planned lengths and future planning are deliberately excluded.
 */
export function buildPlayerWorldResultsView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
  limit = WORLD_RESULTS_HISTORY_LIMIT,
): PlayerWorldResultsView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const safeLimit = validatedLimit(limit);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);

  const promotionsById = new Map(aggregate.state.promotions.map((promotion) => [promotion.id, promotion]));
  const marketsById = new Map(aggregate.state.markets.map((market) => [market.id, market]));
  const venuesById = new Map(aggregate.state.venues.map((venue) => [venue.id, venue]));
  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const championshipsById = new Map((aggregate.state.championships ?? []).map((championship) => [championship.id, championship]));

  const matchesByEvent = new Map<Id, ApplicationWorldAggregate["state"]["matches"]>();
  for (const match of aggregate.state.matches) {
    if (match.status !== "COMPLETED") continue;
    const matches = matchesByEvent.get(match.eventId) ?? [];
    matches.push(match);
    matchesByEvent.set(match.eventId, matches);
  }

  const participantsByMatch = new Map<Id, ApplicationWorldAggregate["state"]["matchParticipants"]>();
  for (const participant of aggregate.state.matchParticipants) {
    const participants = participantsByMatch.get(participant.matchId) ?? [];
    participants.push(participant);
    participantsByMatch.set(participant.matchId, participants);
  }

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

  const shows = aggregate.state.events
    .filter((event) => event.status === "COMPLETED")
    .slice()
    .sort((left, right) => (
      dateOrder(aggregate, right.date) - dateOrder(aggregate, left.date)
      || right.id.localeCompare(left.id)
    ))
    .slice(0, safeLimit)
    .map((event): PlayerWorldResultShowView => {
      const promotion = promotionsById.get(event.promotionId);
      const venue = venuesById.get(event.venueId);
      const eventMatches = (matchesByEvent.get(event.id) ?? [])
        .filter((match) => match.promotionId === event.promotionId)
        .slice()
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
      const mainEventOrder = eventMatches.reduce((highest, match) => Math.max(highest, match.order), 0);

      const matches = eventMatches.map((match): PlayerWorldResultMatchView => {
        const participants = (participantsByMatch.get(match.id) ?? [])
          .map((participant): PlayerWorldResultParticipantView => ({
            personId: participant.personId,
            name: peopleById.get(participant.personId)?.name ?? "Unknown wrestler",
            side: participant.side,
            won: participant.won,
          }))
          .sort((left, right) => left.side.localeCompare(right.side) || left.name.localeCompare(right.name));
        const titleOutcomes = (contestsByMatch.get(match.id) ?? []).map((contest): PlayerWorldResultTitleOutcomeView => ({
          championshipId: contest.championshipId,
          championshipName: championshipsById.get(contest.championshipId)?.name ?? "Championship",
          titleChanged: contest.titleChanged,
          previousHolderName: contest.previousHolderId ? holderName(aggregate, contest.previousHolderId) : null,
          winnerHolderName: holderName(aggregate, contest.winnerHolderId),
        }));
        const injuries = (injuriesByMatch.get(match.id) ?? []).map((injury): PlayerWorldResultInjuryView => ({
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
          actualLengthMinutes: match.actualLengthMinutes,
          criticalRatingStars: match.criticalRatingStars,
          crowdResponse: match.crowdResponse,
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
        };
      });

      const segments = resolvedShowSegmentsForEvent(aggregate.state, event.id).map((segment): PlayerWorldResultSegmentView => ({
        segmentId: segment.ledgerId,
        order: segment.slotOrder,
        type: segment.type,
        participants: segment.participantIds.map((personId) => ({
          personId,
          name: peopleById.get(personId)?.name ?? "Unknown wrestler",
        })),
        videoSubjectName: segment.videoSubjectPersonId && segment.videoReveal !== "CRYPTIC"
          ? (peopleById.get(segment.videoSubjectPersonId)?.name ?? null) : null,
        videoKind: segment.videoKind,
        videoReveal: segment.videoReveal,
        liveAppearanceKind: segment.liveAppearanceKind,
        liveAppearancePresentation: segment.liveAppearancePresentation,
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
        turnPersonId: segment.turnPersonId,
        turnTargetAlignment: segment.turnTargetAlignment,
        turnPresentation: segment.turnPresentation,
        betrayedPersonId: segment.betrayedPersonId,
        crowdResponse: segment.crowdResponse,
        outcomeBand: segment.outcomeBand,
      }));
      const runningOrder = mergedRunningOrder(matches, segments);
      const titleChangeCount = matches.reduce(
        (total, match) => total + match.titleOutcomes.filter((outcome) => outcome.titleChanged).length,
        0,
      );
      const injuryCount = matches.reduce((total, match) => total + match.injuries.length, 0);
      const venueCapacity = venue?.capacity ?? 0;
      return {
        eventId: event.id,
        date: { ...event.date },
        type: event.type,
        promotionId: event.promotionId,
        promotionName: promotion?.name ?? "Unknown promotion",
        isPlayerPromotion: control?.promotionId === event.promotionId,
        marketName: marketsById.get(event.marketId)?.name ?? "Unknown market",
        venueName: venue?.name ?? "Unknown venue",
        venueCapacity,
        attendance: event.attendance,
        attendancePercentOfCapacity: venueCapacity > 0 ? percentage((event.attendance / venueCapacity) * 100) : 0,
        averageMatchRating: event.averageMatchRating,
        bestMatchRating: event.bestMatchRating,
        crowdResponse: event.crowdResponse,
        matchCount: matches.length,
        segmentCount: segments.length,
        titleChangeCount,
        injuryCount,
        matches,
        segments,
        runningOrder,
      };
    });

  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...aggregate.state.world.currentDate },
      revision: aggregate.runtime.revision,
    },
    player: {
      playerId: membership.playerId,
      promotionId: control?.promotionId ?? null,
    },
    shows,
  };
}

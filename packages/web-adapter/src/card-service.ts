import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { ProgrammeParticipantRef } from "../../domain/src/programmes.js";
import type {
  Id,
  MatchIntent,
  MatchSide,
  MatchStyleProfile,
  MatchType,
  PpwDate,
  WrestlerDivision,
  WorldState,
} from "../../domain/src/types.js";
import {
  activePromotionControlForPlayer,
  alphaCurrentWeekShowDraftId,
  maxShowParticipantsForEventType,
  playerShowPlanningStatus,
  reservationForDraft,
  reserveDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  requestCreativeBookingConsentCommand,
  creativeConcernsForDraft,
  creativeBlockersForDraft,
  executeIdempotentCommand,
  type CreativeBookingConcern,
  type ApplicationWorldRepository,
  type ChampionshipDraftAssignment,
  type DetailedMatchDraft,
  type DetailedShowSegmentDraft,
  type DetailedShowSegmentType,
  type AttackPresentation,
  type AttackObjective,
  type TurnPresentation,
  type SigningOutcome,
  type StableInvitationOutcome,
  type StableExitOutcome,
  type StableReconciliationOutcome,
  type ChallengeResponse,
  type InterruptionOutcome,
  type DetailedShowSlotRef,
  type PlayerShowPlanningState,
} from "../../application/src/index.js";
import { wrestlerAlignmentForPromotion } from "../../sim-core/src/alignment.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import {
  assessMatchStyleReadiness,
  normalizeMatchStyle,
  type MatchStyleReadinessReason,
  type MatchStyleReadinessStatus,
} from "../../sim-core/src/match-style.js";
import {
  bookHumanChampionshipMatch,
  unbookHumanChampionshipMatch,
} from "../../sim-core/src/human-championships.js";
import {
  clearHumanMatchCard,
  prepareHumanMatchCard,
  type HumanMatchPlan,
} from "../../sim-core/src/human-booking.js";
import {
  defaultPlannedFinishForIntent,
  isBookableMatchFinish,
  type MatchFinish,
} from "../../sim-core/src/match-finishes.js";

export interface AlphaCardParticipantView {
  personId: Id;
  name: string;
  division: WrestlerDivision | null;
  alignment: "FACE" | "HEEL" | "TWEENER";
  popularity: number;
  momentum: number;
  morale: number;
  fatigue: number;
  wear: number;
  skills: {
    inRingQuality: number;
    matchCraft: number;
    safety: number;
    stamina: number;
    presentation: number;
  };
  datesRemaining: number;
  unlimitedAppearances: boolean;
}

export interface AlphaCardMatchReadinessParticipantView {
  personId: Id;
  name: string;
  status: MatchStyleReadinessStatus;
  reasons: MatchStyleReadinessReason[];
  capability: number;
  shortfall: number;
  physicalLoad: number;
}

export interface AlphaCardMatchReadinessView {
  status: MatchStyleReadinessStatus;
  provisional: boolean;
  participants: AlphaCardMatchReadinessParticipantView[];
}

export interface AlphaCardMatchView {
  draftMatchId: string;
  programmeId?: Id | null;
  type: MatchType;
  sideAIds: Id[];
  sideBIds: Id[];
  intendedWinnerSide: MatchSide;
  intent: MatchIntent;
  style?: MatchStyleProfile;
  readiness?: AlphaCardMatchReadinessView;
  plannedLengthMinutes: number;
  plannedFinish?: MatchFinish;
  interfererPersonId?: Id | null;
  interferenceSide?: MatchSide | null;
  interferenceOutcome?: "SUCCESS" | "THWARTED" | null;
}

export interface AlphaCardSegmentView {
  draftSegmentId: string;
  type: DetailedShowSegmentType;
  participantIds: Id[];
  programmeId: Id | null;
  plannedLengthMinutes: number;
  attackerPersonId?: Id | null;
  victimPersonId?: Id | null;
  rescuerPersonId?: Id | null;
  sourceDraftMatchId?: string | null;
  initiatorPersonId?: Id | null;
  targetPersonId?: Id | null;
  signingOutcome?: SigningOutcome | null;
  stableId?: Id | null;
  stableInvitationOutcome?: StableInvitationOutcome | null;
  stableExitOutcome?: StableExitOutcome | null;
  stableReconciliationOutcome?: StableReconciliationOutcome | null;
  challengeResponse?: ChallengeResponse | null;
  interruptionOutcome?: InterruptionOutcome | null;
  attackPresentation?: AttackPresentation | null;
  attackObjective?: AttackObjective | null;
  turnPersonId?: Id | null;
  turnTargetAlignment?: WrestlerAlignment | null;
  turnPresentation?: TurnPresentation | null;
  betrayedPersonId?: Id | null;
}

export interface AlphaCardProgrammeView {
  programmeId: Id;
  label: string;
  participantIds: Id[];
  heat: number | null;
  repetition: number;
}

export interface AlphaCardSlotView {
  kind: "MATCH" | "SEGMENT";
  refId: string;
}

export interface AlphaCardChampionshipView {
  championshipId: Id;
  name: string;
  division: MatchType;
  prestige: number;
  holderName: string | null;
  holderPersonIds: Id[];
}

export interface AlphaChampionshipAssignmentView {
  draftMatchId: string;
  championshipId: Id;
}

export interface AlphaRecentMeetingView {
  personAId: Id;
  personBId: Id;
  year: number;
  week: number;
  weeksAgo: number;
  winnerPersonIds: Id[];
}

export interface AlphaCardTeamView {
  teamId: Id;
  name: string;
  memberIds: [Id, Id];
  memberNames: [string, string];
}

export interface AlphaCardStableView {
  stableId: Id;
  name: string;
  memberIds: Id[];
  formerMemberIds: Id[];
}

export interface AlphaCardCreativeConcernView extends Omit<CreativeBookingConcern, "bookingSignature"> {
  wrestlerName: string;
}

export interface AlphaWithdrawCreativeCardRequest {
  requestId: string;
  expectedRevision: number;
  expectedPlanVersion: number;
  draftId: string;
}

export interface AlphaCreativeConsentRequest {
  requestId: string;
  expectedRevision: number;
  expectedPlanVersion: number;
  draftId: string;
  draftMatchId: string;
  personId: Id;
}

export interface AlphaCurrentWeekCardView {
  world: {
    worldId: Id;
    year: number;
    week: number;
    phase: "OPEN" | "LOCKING" | "RESOLVING";
    revision: number;
  };
  targetDate: PpwDate;
  promotion: {
    promotionId: Id;
    name: string;
  };
  draftId: string;
  workspaceVersion: number;
  reservationId: string | null;
  planningState: PlayerShowPlanningState;
  canEdit: boolean;
  minParticipants: number;
  maxParticipants: number;
  marketName: string;
  venueName: string;
  participants: AlphaCardParticipantView[];
  availableParticipants: AlphaCardParticipantView[];
  availableTeams: AlphaCardTeamView[];
  availableStables: AlphaCardStableView[];
  matches: AlphaCardMatchView[];
  segments: AlphaCardSegmentView[];
  runningOrder: AlphaCardSlotView[];
  programmes: AlphaCardProgrammeView[];
  recentMeetings: AlphaRecentMeetingView[];
  championships: AlphaCardChampionshipView[];
  championshipAssignments: AlphaChampionshipAssignmentView[];
  creativeConcerns: AlphaCardCreativeConcernView[];
  /** A saved amendment to an already materialized show awaits wrestler consent. */
  cardPendingConsent: boolean;
}

export interface AlphaShowCardRequest {
  requestId: string;
  expectedRevision: number;
  expectedPlanVersion: number;
  draftId?: string;
  matches: AlphaCardMatchView[];
  segments?: AlphaCardSegmentView[];
  runningOrder?: AlphaCardSlotView[];
  championshipAssignments: AlphaChampionshipAssignmentView[];
}

const MATCH_TYPES = new Set<MatchType>(["SINGLES", "TAG"]);
const MATCH_SIDES = new Set<MatchSide>(["A", "B"]);
const MATCH_INTENTS = new Set<MatchIntent>([
  "COMPETITIVE",
  "SHOWCASE",
  "DOMINANT",
  "TECHNICAL",
  "HIGH_RISK",
  "STORY",
  "PROTECTIVE",
  "EPIC",
]);
const SEGMENT_TYPES = new Set<DetailedShowSegmentType>([
  "PROMO",
  "INTERVIEW",
  "CONFRONTATION",
  "INTERRUPTION",
  "CHALLENGE",
  "CONTRACT_SIGNING",
  "STABLE_INVITATION",
  "STABLE_EXIT",
  "STABLE_RECONCILIATION",
  "ATTACK",
  "RESCUE",
  "POST_MATCH_ASSAULT",
  "CELEBRATION",
  "TURN",
]);

function requiredText(value: string, label: string, maxLength = 220): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function requireExpectedRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("expectedRevision must be a non-negative integer");
  return value;
}

function requirePlanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("expectedPlanVersion must be a non-negative integer");
  return value;
}

function normalizeCompleteCard(
  matches: AlphaCardMatchView[],
): { matches: DetailedMatchDraft[]; participantIds: Id[] } {
  if (!Array.isArray(matches) || matches.length === 0) throw new Error("match card requires at least one match");

  const used = new Set<Id>();
  const orderedParticipants: Id[] = [];
  const matchIds = new Set<string>();

  const normalized = matches.map((match, index) => {
    const draftMatchId = requiredText(match.draftMatchId, `matches[${index}].draftMatchId`, 128);
    if (matchIds.has(draftMatchId)) throw new Error("match card contains duplicate match IDs");
    matchIds.add(draftMatchId);
    if (!MATCH_TYPES.has(match.type)) throw new Error(`unsupported match type ${String(match.type)}`);
    if (!MATCH_SIDES.has(match.intendedWinnerSide)) throw new Error("intended winner side must be A or B");
    if (!MATCH_INTENTS.has(match.intent)) throw new Error(`unsupported match intent ${String(match.intent)}`);
    const plannedFinish = match.plannedFinish ?? defaultPlannedFinishForIntent(match.intent);
    const style = match.style === undefined ? undefined : normalizeMatchStyle(match.style);
    if (!isBookableMatchFinish(plannedFinish)) throw new Error("planned match finish must be clean, submission, flash or protected");
    if (!Number.isInteger(match.plannedLengthMinutes) || match.plannedLengthMinutes < 3 || match.plannedLengthMinutes > 60) {
      throw new Error("planned match length must be an integer from 3 to 60 minutes");
    }

    const expectedSideSize = match.type === "SINGLES" ? 1 : 2;
    if (match.sideAIds.length !== expectedSideSize || match.sideBIds.length !== expectedSideSize) {
      throw new Error(`${match.type.toLowerCase()} match requires ${expectedSideSize} wrestler(s) per side`);
    }

    const ids = [...match.sideAIds, ...match.sideBIds];
    const interfererPersonId = match.interfererPersonId ?? null;
    const interferenceSide = match.interferenceSide ?? null;
    const interferenceOutcome = interfererPersonId ? (match.interferenceOutcome ?? "SUCCESS") : null;
    if ((interfererPersonId === null) !== (interferenceSide === null)
      || (interferenceSide !== null && !MATCH_SIDES.has(interferenceSide))) {
      throw new Error("run-in requires an outside wrestler and the side they assist");
    }
    if (interferenceOutcome !== null && interferenceOutcome !== "SUCCESS" && interferenceOutcome !== "THWARTED") {
      throw new Error("run-in outcome must be successful or thwarted");
    }
    if (interferenceOutcome === "SUCCESS" && interferenceSide !== match.intendedWinnerSide) {
      throw new Error("successful run-in must aid the booked winning side");
    }
    if (interfererPersonId && ids.includes(interfererPersonId)) {
      throw new Error("run-in wrestler cannot compete in the same match");
    }
    if (new Set(ids).size !== ids.length) throw new Error("one wrestler cannot occupy multiple positions in a match");
    for (const personId of ids) {
      requiredText(personId, `matches[${index}] wrestler`, 128);
      if (used.has(personId)) throw new Error(`${personId} is booked in more than one match on the card`);
      used.add(personId);
      orderedParticipants.push(personId);
    }

    if (interfererPersonId) orderedParticipants.push(interfererPersonId);
    return {
      draftMatchId,
      ...(match.programmeId ? { programmeId: requiredText(match.programmeId, "match programmeId", 128) } : {}),
      type: match.type,
      sideAIds: [...match.sideAIds],
      sideBIds: [...match.sideBIds],
      intendedWinnerSide: match.intendedWinnerSide,
      intent: match.intent,
      ...(style === undefined ? {} : { style }),
      plannedLengthMinutes: match.plannedLengthMinutes,
      plannedFinish,
      ...(interfererPersonId ? { interfererPersonId, interferenceSide, interferenceOutcome } : {}),
    } satisfies DetailedMatchDraft;
  });

  return { matches: normalized, participantIds: orderedParticipants };
}


function readinessRank(status: MatchStyleReadinessStatus): number {
  if (status === "REFUSES") return 2;
  if (status === "CONCERNED") return 1;
  return 0;
}

function matchStyleReadiness(
  state: WorldState,
  match: Pick<DetailedMatchDraft, "sideAIds" | "sideBIds" | "style" | "plannedLengthMinutes">,
  targetDate: PpwDate,
): AlphaCardMatchReadinessView | undefined {
  if (match.style === undefined || match.plannedLengthMinutes === null) return undefined;
  const currentWeek = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const targetWeek = ppwDateToWeekIndex(targetDate, state.ruleset.weeksPerYear);
  const provisional = targetWeek > currentWeek;
  const participants = [...match.sideAIds, ...match.sideBIds].map((personId) => {
    const person = state.people.find((candidate) => candidate.id === personId);
    if (!person) throw new Error(`match wrestler ${personId} was not found`);
    const assessment = assessMatchStyleReadiness(
      match.style!,
      person.skills,
      match.plannedLengthMinutes!,
      person.fatigue,
      person.wear,
    );
    return {
      personId,
      name: person.name,
      status: assessment.status,
      reasons: [...assessment.reasons],
      capability: assessment.capability,
      shortfall: assessment.shortfall,
      physicalLoad: assessment.physicalLoad,
    } satisfies AlphaCardMatchReadinessParticipantView;
  });
  const status = participants.reduce<MatchStyleReadinessStatus>(
    (worst, participant) => (
      readinessRank(participant.status) > readinessRank(worst) ? participant.status : worst
    ),
    "COMFORTABLE",
  );
  return { status, provisional, participants };
}

function refusalNames(readiness: AlphaCardMatchReadinessView | undefined): string[] {
  if (!readiness || readiness.status !== "REFUSES") return [];
  return readiness.participants
    .filter((participant) => participant.status === "REFUSES")
    .map((participant) => participant.name);
}

function programmeParticipantIds(state: WorldState, programmeId: Id): Id[] {
  const programme = (state.programmes ?? []).find((candidate) => candidate.id === programmeId);
  if (!programme) return [];
  const result = new Set<Id>();
  for (const ref of [...programme.sideA, ...programme.sideB]) {
    if (ref.kind === "PERSON") {
      result.add(ref.entityId);
      continue;
    }
    for (const membership of state.teamMemberships ?? []) {
      if (membership.teamId === ref.entityId && membership.active) result.add(membership.personId);
    }
  }
  return [...result];
}

function programmeSideLabel(state: WorldState, refs: ProgrammeParticipantRef[]): string {
  return refs.map((ref) => {
    if (ref.kind === "PERSON") {
      return state.people.find((person) => person.id === ref.entityId)?.name ?? ref.entityId;
    }
    return state.teams?.find((team) => team.id === ref.entityId)?.name ?? ref.entityId;
  }).join(" & ");
}

function cardProgrammes(state: WorldState, promotionId: Id): AlphaCardProgrammeView[] {
  return (state.programmes ?? [])
    .filter((programme) => programme.promotionId === promotionId && programme.status === "ACTIVE")
    .map((programme) => ({
      programmeId: programme.id,
      label: `${programmeSideLabel(state, programme.sideA)} vs ${programmeSideLabel(state, programme.sideB)}`,
      participantIds: programmeParticipantIds(state, programme.id),
      heat: programme.heat,
      repetition: programme.repetition,
    }))
    .sort((left, right) => (
      (right.heat ?? -1) - (left.heat ?? -1)
      || left.label.localeCompare(right.label)
      || left.programmeId.localeCompare(right.programmeId)
    ));
}

function normalizeSegments(
  segments: AlphaCardSegmentView[] | undefined,
  state: WorldState,
  promotionId: Id,
): { segments: DetailedShowSegmentDraft[]; participantIds: Id[] } {
  if (segments === undefined) return { segments: [], participantIds: [] };
  if (!Array.isArray(segments)) throw new Error("segments must be an array");
  const segmentIds = new Set<string>();
  const usedProgrammes = new Set<Id>();
  const participantIds: Id[] = [];

  const normalized = segments.map((segment, index) => {
    const draftSegmentId = requiredText(segment.draftSegmentId, `segments[${index}].draftSegmentId`, 128);
    if (segmentIds.has(draftSegmentId)) throw new Error("show contains duplicate segment IDs");
    segmentIds.add(draftSegmentId);
    if (!SEGMENT_TYPES.has(segment.type)) throw new Error(`unsupported segment type ${String(segment.type)}`);
    if (!Array.isArray(segment.participantIds) || segment.participantIds.length < 1 || segment.participantIds.length > 4) {
      throw new Error("segment requires one to four wrestlers");
    }
    const people = segment.participantIds.map((personId, personIndex) => (
      requiredText(personId, `segments[${index}].participantIds[${personIndex}]`, 128)
    ));
    if (new Set(people).size !== people.length) throw new Error("segment cannot include the same wrestler twice");
    if (["CONFRONTATION", "INTERRUPTION", "CHALLENGE", "CONTRACT_SIGNING", "STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION", "ATTACK"].includes(segment.type) && people.length < 2) {
      throw new Error(`${segment.type.toLowerCase()} segment requires at least two wrestlers`);
    }
    if (segment.type === "POST_MATCH_ASSAULT" && people.length < 2) {
      throw new Error("POST_MATCH_ASSAULT segment requires two distinct wrestlers");
    }
    if (segment.type === "RESCUE" && people.length < 3) {
      throw new Error("RESCUE segment requires three distinct wrestlers");
    }
    if (!Number.isInteger(segment.plannedLengthMinutes) || segment.plannedLengthMinutes < 2 || segment.plannedLengthMinutes > 20) {
      throw new Error("segment length must be an integer from 2 to 20 minutes");
    }

    const programmeId = segment.programmeId === null
      ? null
      : requiredText(segment.programmeId, `segments[${index}].programmeId`, 128);
    const turnPersonId = segment.type === "TURN"
      ? requiredText(segment.turnPersonId ?? "", `segments[${index}].turnPersonId`, 128)
      : null;
    const turnTargetAlignment = segment.type === "TURN" ? (segment.turnTargetAlignment ?? null) : null;
    const turnPresentation = segment.type === "TURN" ? (segment.turnPresentation ?? "REVEAL") : null;
    const betrayedPersonId = segment.type === "TURN" && turnPresentation === "BETRAYAL"
      ? requiredText(segment.betrayedPersonId ?? "", `segments[${index}].betrayedPersonId`, 128)
      : null;
    const attackerPersonId = (segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT")
      ? requiredText(segment.attackerPersonId ?? "", `segments[${index}].attackerPersonId`, 128) : null;
    const victimPersonId = (segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT")
      ? requiredText(segment.victimPersonId ?? "", `segments[${index}].victimPersonId`, 128) : null;
    const sourceDraftMatchId = segment.type === "POST_MATCH_ASSAULT"
      ? requiredText(segment.sourceDraftMatchId ?? "", `segments[${index}].sourceDraftMatchId`, 128) : null;
    const rescuerPersonId = segment.type === "RESCUE"
      ? requiredText(segment.rescuerPersonId ?? "", `segments[${index}].rescuerPersonId`, 128) : null;
    if ((segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT") && (
      attackerPersonId === victimPersonId || !people.includes(attackerPersonId!) || !people.includes(victimPersonId!)
    )) throw new Error("attack angle requires distinct attacker and victim among its participants");
    if (segment.type === "RESCUE" && (
      rescuerPersonId === attackerPersonId || rescuerPersonId === victimPersonId
      || !people.includes(rescuerPersonId!)
    )) throw new Error("RESCUE requires a distinct rescuer among segment participants");
    const isDirected = segment.type === "CHALLENGE" || segment.type === "CONFRONTATION" || segment.type === "INTERRUPTION" || segment.type === "CONTRACT_SIGNING" || segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION";
    const initiatorPersonId = isDirected && segment.initiatorPersonId != null
      ? requiredText(segment.initiatorPersonId, `segments[${index}].initiatorPersonId`, 128) : null;
    const targetPersonId = isDirected && segment.targetPersonId != null
      ? requiredText(segment.targetPersonId, `segments[${index}].targetPersonId`, 128) : null;
    if (isDirected && (initiatorPersonId !== null || targetPersonId !== null) && (
      !initiatorPersonId || !targetPersonId || initiatorPersonId === targetPersonId
      || !people.includes(initiatorPersonId) || !people.includes(targetPersonId)
    )) throw new Error("directed segment requires distinct initiator and target among participants");
    const challengeResponse = segment.type === "CHALLENGE" ? (segment.challengeResponse ?? null) : null;
    if (challengeResponse !== null && !["ACCEPTED", "REFUSED", "LEFT_OPEN"].includes(challengeResponse)) {
      throw new Error("CHALLENGE has an unsupported scripted response");
    }
    const interruptionOutcome = segment.type === "INTERRUPTION" ? (segment.interruptionOutcome ?? "VERBAL_EXCHANGE") : null;
    if (segment.type === "INTERRUPTION" && (
      !initiatorPersonId || !targetPersonId
      || !["VERBAL_EXCHANGE", "INTERRUPTER_PREVAILS", "SPEAKER_PREVAILS", "BRAWL"].includes(interruptionOutcome!)
    )) throw new Error("INTERRUPTION requires interrupter, original speaker and a scripted outcome");
    const stableId = segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION"
      ? (segment.stableId ? requiredText(segment.stableId, `segments[${index}].stableId`, 128) : null) : null;
    const stableInvitationOutcome = segment.type === "STABLE_INVITATION" ? (segment.stableInvitationOutcome ?? "REFUSED") : null;
    const stableExitOutcome = segment.type === "STABLE_EXIT" ? (segment.stableExitOutcome ?? "EXPELLED") : null;
    const stableReconciliationOutcome = segment.type === "STABLE_RECONCILIATION"
      ? (segment.stableReconciliationOutcome ?? "RECONCILED") : null;
    if (segment.type === "STABLE_RECONCILIATION") {
      const stable = (state.stables ?? []).find((entry) => entry.id === stableId
        && entry.promotionId === promotionId && entry.status === "ACTIVE");
      if (!stable) throw new Error("STABLE_RECONCILIATION requires an active stable in this promotion");
      if (!initiatorPersonId || !targetPersonId
        || !["RECONCILED", "REBUFFED"].includes(stableReconciliationOutcome!)) {
        throw new Error("STABLE_RECONCILIATION needs a representative, former member and scripted outcome");
      }
      const members = (state.stableMemberships ?? []).filter((entry) => entry.stableId === stable.id);
      if (!members.some((entry) => entry.personId === initiatorPersonId && entry.active)) {
        throw new Error("reconciliation representative must be a current member");
      }
      if (!members.some((entry) => entry.personId === targetPersonId && !entry.active)
        || members.some((entry) => entry.personId === targetPersonId && entry.active)) {
        throw new Error("reconciliation target must be a former, not current, stable member");
      }
    }
    if (segment.type === "STABLE_EXIT") {
      const stable = (state.stables ?? []).find((entry) => entry.id === stableId
        && entry.promotionId === promotionId && entry.status === "ACTIVE");
      if (!stable) throw new Error("STABLE_EXIT requires an active stable in this promotion");
      if (!initiatorPersonId || !targetPersonId || !["EXPELLED", "WALKED_OUT"].includes(stableExitOutcome!)) {
        throw new Error("STABLE_EXIT needs representative, departing wrestler and a scripted exit");
      }
      const memberIds = new Set((state.stableMemberships ?? [])
        .filter((entry) => entry.stableId === stable.id && entry.active).map((entry) => entry.personId));
      if (!memberIds.has(initiatorPersonId) || !memberIds.has(targetPersonId)) {
        throw new Error("stable exit requires two current members of the selected stable");
      }
    }
    if (segment.type === "STABLE_INVITATION") {
      const stable = (state.stables ?? []).find((entry) => entry.id === stableId
        && entry.promotionId === promotionId && entry.status === "ACTIVE");
      if (!stable) throw new Error("STABLE_INVITATION requires an active stable in this promotion");
      if (!initiatorPersonId || !targetPersonId || !["ACCEPTED", "REFUSED"].includes(stableInvitationOutcome!)) {
        throw new Error("STABLE_INVITATION needs recruiter, recruit and scripted acceptance or refusal");
      }
      const members = (state.stableMemberships ?? []).filter((entry) => entry.stableId === stable.id && entry.active);
      if (!members.some((entry) => entry.personId === initiatorPersonId)) {
        throw new Error("stable recruiter must be a current member of the selected stable");
      }
      if (members.some((entry) => entry.personId === targetPersonId)) {
        throw new Error("stable recruit already belongs to the selected stable");
      }
    }
    const signingOutcome = segment.type === "CONTRACT_SIGNING" ? (segment.signingOutcome ?? "SIGNED") : null;
    if (segment.type === "CONTRACT_SIGNING" && (
      !initiatorPersonId || !targetPersonId
      || !["SIGNED", "REJECTED", "WALKOUT", "BRAWL"].includes(signingOutcome!)
    )) throw new Error("CONTRACT_SIGNING needs proposer, responder and a scripted outcome");
    const attackPresentation = segment.type === "ATTACK" ? (segment.attackPresentation ?? "BLINDSIDE") : null;
    const attackObjective = segment.type === "ATTACK" ? (segment.attackObjective ?? "GENERATE_HEAT") : null;
    if (segment.type === "ATTACK" && (
      !["BLINDSIDE", "BEATDOWN", "PULL_APART_BRAWL"].includes(attackPresentation!)
      || !["GENERATE_HEAT", "BUILD_SYMPATHY", "ESCALATE_RIVALRY"].includes(attackObjective!)
    )) throw new Error("ATTACK segment has an unsupported presentation or objective");
    if (segment.type === "TURN") {
      if (turnPresentation !== "REVEAL" && turnPresentation !== "BETRAYAL") {
        throw new Error("TURN segment has an unsupported presentation");
      }
      if (turnPresentation === "BETRAYAL" && (
        betrayedPersonId === turnPersonId || !people.includes(betrayedPersonId!)
      )) throw new Error("BETRAYAL requires a distinct betrayed wrestler among segment participants");
      if (!people.includes(turnPersonId!)) throw new Error("TURN segment wrestler must be one of the segment participants");
      if (!turnTargetAlignment || !["FACE", "HEEL", "TWEENER"].includes(turnTargetAlignment)) {
        throw new Error("TURN segment must choose face, heel or tweener");
      }
      if (wrestlerAlignmentForPromotion(state, promotionId, turnPersonId!) === turnTargetAlignment) {
        throw new Error("TURN segment target alignment must differ from the wrestler's current presentation");
      }
    }
    if (programmeId !== null) {
      const programme = (state.programmes ?? []).find((candidate) => candidate.id === programmeId);
      if (!programme || programme.status !== "ACTIVE" || programme.promotionId !== promotionId) {
        throw new Error(`active Programme ${programmeId} was not found for this promotion`);
      }
      if (usedProgrammes.has(programmeId)) throw new Error("one Programme can have only one segment on a show");
      usedProgrammes.add(programmeId);
      const storyPeople = new Set(programmeParticipantIds(state, programmeId));
      for (const personId of people) {
        if ((segment.type === "RESCUE" && personId === rescuerPersonId)
          || (segment.type === "POST_MATCH_ASSAULT" && personId === attackerPersonId)) continue;
        if (!storyPeople.has(personId)) throw new Error(`${personId} does not belong to Programme ${programmeId}`);
      }
    }

    participantIds.push(...people);
    return {
      draftSegmentId,
      type: segment.type,
      participantIds: people,
      programmeId,
      plannedLengthMinutes: segment.plannedLengthMinutes,
      ...(isDirected ? { initiatorPersonId, targetPersonId } : {}),
      ...(segment.type === "CONTRACT_SIGNING" ? { signingOutcome } : {}),
      ...(segment.type === "STABLE_INVITATION" ? { stableId, stableInvitationOutcome } : {}),
      ...(segment.type === "STABLE_EXIT" ? { stableId, stableExitOutcome } : {}),
      ...(segment.type === "STABLE_RECONCILIATION" ? { stableId, stableReconciliationOutcome } : {}),
      ...(segment.type === "CHALLENGE" && challengeResponse ? { challengeResponse } : {}),
      ...(segment.type === "INTERRUPTION" ? { interruptionOutcome } : {}),
      ...(segment.type === "ATTACK" ? { attackerPersonId, victimPersonId, attackPresentation, attackObjective } : {}),
      ...(segment.type === "RESCUE" ? { attackerPersonId, victimPersonId, rescuerPersonId } : {}),
      ...(segment.type === "POST_MATCH_ASSAULT" ? { attackerPersonId, victimPersonId, sourceDraftMatchId } : {}),
      ...(segment.type === "TURN" ? { turnPersonId, turnTargetAlignment, turnPresentation, betrayedPersonId } : {}),
    } satisfies DetailedShowSegmentDraft;
  });

  return { segments: normalized, participantIds };
}

function normalizeRunningOrder(
  runningOrder: AlphaCardSlotView[] | undefined,
  matches: DetailedMatchDraft[],
  segments: DetailedShowSegmentDraft[],
): DetailedShowSlotRef[] {
  const defaultOrder: DetailedShowSlotRef[] = [
    ...matches.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
    ...segments.map((segment) => ({ kind: "SEGMENT" as const, refId: segment.draftSegmentId })),
  ];
  if (runningOrder === undefined) return defaultOrder;
  if (!Array.isArray(runningOrder)) throw new Error("runningOrder must be an array");

  const valid = new Set(defaultOrder.map((slot) => `${slot.kind}:${slot.refId}`));
  const seen = new Set<string>();
  const normalized = runningOrder.map((slot, index) => {
    if (!slot || (slot.kind !== "MATCH" && slot.kind !== "SEGMENT")) {
      throw new Error(`runningOrder[${index}] has an invalid slot kind`);
    }
    const refId = requiredText(slot.refId, `runningOrder[${index}].refId`, 128);
    const key = `${slot.kind}:${refId}`;
    if (!valid.has(key)) throw new Error(`running order references missing ${slot.kind.toLowerCase()} ${refId}`);
    if (seen.has(key)) throw new Error("running order contains a duplicate slot");
    seen.add(key);
    return { kind: slot.kind, refId };
  });
  if (seen.size !== valid.size || [...valid].some((key) => !seen.has(key))) {
    throw new Error("running order must contain every match and segment exactly once");
  }
  return normalized;
}

function activeReign(state: WorldState, championshipId: Id) {
  const championship = state.championships?.find((candidate) => candidate.id === championshipId);
  if (!championship?.currentReignId) return null;
  return state.championshipReigns?.find(
    (reign) => reign.id === championship.currentReignId && reign.status === "ACTIVE",
  ) ?? null;
}

function activeTeamMemberIds(state: WorldState, teamId: Id): Id[] {
  return (state.teamMemberships ?? [])
    .filter((membership) => membership.teamId === teamId && membership.active)
    .map((membership) => membership.personId)
    .sort();
}

function championshipHolder(
  state: WorldState,
  championshipId: Id,
): { holderName: string | null; holderPersonIds: Id[] } {
  const reign = activeReign(state, championshipId);
  if (!reign) return { holderName: null, holderPersonIds: [] };
  if (reign.holderType === "PERSON") {
    const person = state.people.find((candidate) => candidate.id === reign.holderId);
    return { holderName: person?.name ?? reign.holderId, holderPersonIds: [reign.holderId] };
  }
  const holderPersonIds = activeTeamMemberIds(state, reign.holderId);
  const team = state.teams?.find((candidate) => candidate.id === reign.holderId);
  const memberNames = holderPersonIds
    .map((personId) => state.people.find((person) => person.id === personId)?.name ?? personId)
    .join(" & ");
  return {
    holderName: team?.name ?? (memberNames || reign.holderId),
    holderPersonIds,
  };
}

function sameSideContainsHolder(match: DetailedMatchDraft, holderPersonIds: Id[]): boolean {
  if (holderPersonIds.length === 0) return true;
  if (holderPersonIds.length === 1) {
    return [...match.sideAIds, ...match.sideBIds].includes(holderPersonIds[0]!);
  }
  if (match.type !== "TAG" || holderPersonIds.length !== 2) return false;
  const holderKey = [...holderPersonIds].sort().join(":");
  return [match.sideAIds, match.sideBIds].some((side) => [...side].sort().join(":") === holderKey);
}

function normalizeChampionshipAssignments(
  assignments: AlphaChampionshipAssignmentView[],
  matches: DetailedMatchDraft[],
  state: WorldState,
  promotionId: Id,
): ChampionshipDraftAssignment[] {
  if (!Array.isArray(assignments)) throw new Error("championshipAssignments must be an array");
  const usedMatches = new Set<string>();
  const usedChampionships = new Set<Id>();

  return assignments.map((assignment, index) => {
    const draftMatchId = requiredText(
      assignment.draftMatchId,
      `championshipAssignments[${index}].draftMatchId`,
      128,
    );
    const championshipId = requiredText(
      assignment.championshipId,
      `championshipAssignments[${index}].championshipId`,
      128,
    );
    const match = matches.find((candidate) => candidate.draftMatchId === draftMatchId);
    if (!match) throw new Error(`championship assignment references missing match ${draftMatchId}`);
    const championship = state.championships?.find((candidate) => candidate.id === championshipId);
    if (!championship || championship.status !== "ACTIVE") throw new Error(`active championship ${championshipId} was not found`);
    if (championship.promotionId !== promotionId) throw new Error("championship belongs to another promotion");
    if (championship.division !== match.type) throw new Error("championship division does not match match type");
    if (usedMatches.has(draftMatchId)) throw new Error("one match cannot carry multiple championships");
    if (usedChampionships.has(championshipId)) throw new Error("one championship cannot be assigned twice on the card");

    const holder = championshipHolder(state, championshipId);
    if (!sameSideContainsHolder(match, holder.holderPersonIds)) {
      throw new Error("reigning champion must participate in a championship defense");
    }

    usedMatches.add(draftMatchId);
    usedChampionships.add(championshipId);
    return { draftMatchId, championshipId };
  });
}

function sameIdSet(left: readonly Id[], right: readonly Id[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return new Set(left).size === left.length && left.every((id) => rightSet.has(id));
}

function committedEventParticipantIds(state: WorldState, eventId: Id): Id[] {
  return state.scheduledAppearances
    .filter((appearance) => appearance.eventId === eventId && appearance.status === "COMMITTED")
    .map((appearance) => appearance.personId);
}

function replaceMaterializedEventCard(
  state: WorldState,
  eventId: Id,
  matches: DetailedMatchDraft[],
  championshipAssignments: ChampionshipDraftAssignment[],
): void {
  const existingBookings = [...(state.championshipMatchBookings ?? [])]
    .filter((booking) => booking.eventId === eventId);
  for (const booking of existingBookings) {
    unbookHumanChampionshipMatch(state, eventId, booking.championshipId);
  }
  clearHumanMatchCard(state, eventId);

  const plans: HumanMatchPlan[] = matches.map((match) => {
    if (match.intendedWinnerSide === null || match.intent === null || match.plannedLengthMinutes === null) {
      throw new Error("materialized card contains an incomplete match");
    }
    return {
      type: match.type,
      sideAIds: [...match.sideAIds],
      sideBIds: [...match.sideBIds],
      intendedWinnerSide: match.intendedWinnerSide,
      intent: match.intent,
      ...(match.style === undefined ? {} : { style: { ...match.style } }),
      plannedLengthMinutes: match.plannedLengthMinutes,
      plannedFinish: match.plannedFinish ?? defaultPlannedFinishForIntent(match.intent),
      ...(match.interfererPersonId && match.interferenceSide
        ? { interfererPersonId: match.interfererPersonId, interferenceSide: match.interferenceSide,
          interferenceOutcome: match.interferenceOutcome ?? "SUCCESS" } : {}),
    };
  });
  const materializedMatches = prepareHumanMatchCard(state, eventId, plans);
  const byDraftId = new Map<string, string>();
  matches.forEach((match, index) => byDraftId.set(match.draftMatchId, materializedMatches[index]!.id));

  for (const assignment of championshipAssignments) {
    const matchId = byDraftId.get(assignment.draftMatchId);
    if (!matchId) throw new Error(`championship assignment references missing match ${assignment.draftMatchId}`);
    bookHumanChampionshipMatch(state, eventId, matchId, assignment.championshipId);
  }
}

function resolveDraftId(
  promotionId: Id,
  currentDate: PpwDate,
  requestedDraftId?: string,
): string {
  return requestedDraftId === undefined
    ? alphaCurrentWeekShowDraftId(promotionId, currentDate)
    : requiredText(requestedDraftId, "draftId", 128);
}

function weekIndex(date: PpwDate, weeksPerYear: number): number {
  return ((date.year - 1) * weeksPerYear) + (date.week - 1);
}

function contractCoversDate(
  state: WorldState,
  contract: WorldState["contracts"][number],
  date: PpwDate,
): boolean {
  return contract.status === "SIGNED"
    && comparePpwDates(date, contract.startDate, state.ruleset.weeksPerYear) >= 0
    && comparePpwDates(date, contract.endDate, state.ruleset.weeksPerYear) <= 0;
}

function availableCardParticipants(
  state: WorldState,
  promotionId: Id,
  targetDate: PpwDate,
  selectedIds: readonly Id[],
): AlphaCardParticipantView[] {
  const selected = new Set(selectedIds);
  const datesByPerson = new Map<Id, number>();
  for (const contract of state.contracts) {
    if (contract.promotionId !== promotionId || !contractCoversDate(state, contract, targetDate)) continue;
    const remaining = contract.family === "EXCLUSIVE"
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, contract.dateEntitlement - contract.datesUsed);
    if (remaining <= 0 && !selected.has(contract.personId)) continue;
    datesByPerson.set(contract.personId, (datesByPerson.get(contract.personId) ?? 0) + remaining);
  }

  const result: AlphaCardParticipantView[] = [];
  for (const [personId, datesRemaining] of datesByPerson.entries()) {
    const person = state.people.find((candidate) => candidate.id === personId);
    if (!person || person.status !== "ACTIVE") continue;
    result.push({
      personId,
      name: person.name,
      division: person.division ?? null,
      alignment: wrestlerAlignmentForPromotion(state, promotionId, person.id),
      popularity: person.popularity,
      momentum: person.momentum,
      morale: person.morale,
      fatigue: person.fatigue,
      wear: person.wear,
      skills: {
        inRingQuality: person.skills.inRingQuality,
        matchCraft: person.skills.matchCraft,
        safety: person.skills.safety,
        stamina: person.skills.stamina,
        presentation: person.skills.presentation,
      },
      datesRemaining: datesRemaining === Number.MAX_SAFE_INTEGER ? 0 : datesRemaining,
      unlimitedAppearances: datesRemaining >= Number.MAX_SAFE_INTEGER,
    });
  }
  return result.sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));
}

function pairKey(left: Id, right: Id): string {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function recentMeetingsForParticipants(
  state: WorldState,
  promotionId: Id,
  participantIds: Id[],
  currentDate: PpwDate,
): AlphaRecentMeetingView[] {
  const selected = new Set(participantIds);
  if (selected.size < 2) return [];

  const completedEvents = new Map(
    state.events
      .filter((event) => event.promotionId === promotionId && event.status === "COMPLETED")
      .map((event) => [event.id, event]),
  );
  const participantsByMatch = new Map<Id, WorldState["matchParticipants"]>();
  for (const participant of state.matchParticipants) {
    if (!selected.has(participant.personId)) continue;
    const list = participantsByMatch.get(participant.matchId) ?? [];
    list.push(participant);
    participantsByMatch.set(participant.matchId, list);
  }

  const matches = state.matches
    .filter((match) => match.promotionId === promotionId && match.status === "COMPLETED" && completedEvents.has(match.eventId))
    .sort((left, right) => {
      const leftEvent = completedEvents.get(left.eventId)!;
      const rightEvent = completedEvents.get(right.eventId)!;
      return weekIndex(rightEvent.date, state.ruleset.weeksPerYear) - weekIndex(leftEvent.date, state.ruleset.weeksPerYear)
        || rightEvent.date.day - leftEvent.date.day
        || right.order - left.order
        || right.id.localeCompare(left.id);
    });

  const currentWeek = weekIndex(currentDate, state.ruleset.weeksPerYear);
  const latestByPair = new Map<string, AlphaRecentMeetingView>();
  for (const match of matches) {
    const event = completedEvents.get(match.eventId)!;
    const participants = participantsByMatch.get(match.id) ?? [];
    const sideA = participants.filter((participant) => participant.side === "A");
    const sideB = participants.filter((participant) => participant.side === "B");
    if (sideA.length === 0 || sideB.length === 0) continue;
    const winnerPersonIds = participants.filter((participant) => participant.won).map((participant) => participant.personId);
    for (const left of sideA) {
      for (const right of sideB) {
        const key = pairKey(left.personId, right.personId);
        if (latestByPair.has(key)) continue;
        latestByPair.set(key, {
          personAId: left.personId,
          personBId: right.personId,
          year: event.date.year,
          week: event.date.week,
          weeksAgo: Math.max(0, currentWeek - weekIndex(event.date, state.ruleset.weeksPerYear)),
          winnerPersonIds: [...winnerPersonIds],
        });
      }
    }
  }

  return [...latestByPair.values()].sort((left, right) => (
    left.weeksAgo - right.weeksAgo
    || left.year - right.year
    || left.week - right.week
    || pairKey(left.personAId, left.personBId).localeCompare(pairKey(right.personAId, right.personBId))
  ));
}

export async function loadAlphaShowCard(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  requestedDraftId?: string,
): Promise<AlphaCurrentWeekCardView> {
  const aggregate = await repository.load(worldId);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  if (!control) throw new Error("Take control of a promotion before booking a card");

  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} was not found`);

  const currentDate = aggregate.state.world.currentDate;
  const draftId = resolveDraftId(promotion.id, currentDate, requestedDraftId);
  const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id);
  const draft = workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
  const reservation = reservationForDraft(aggregate.planning, promotion.id, draftId);
  if (!workspace || !draft) {
    throw new Error("Plan this show before booking its card");
  }

  const status = playerShowPlanningStatus(
    aggregate.state,
    aggregate.planning,
    aggregate.runtime,
    promotion.id,
    draftId,
  );
  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const candidateParticipants = availableCardParticipants(
    aggregate.state,
    promotion.id,
    draft.targetDate,
    draft.participantIds,
  );
  const committedIds = status.eventId === null
    ? null
    : new Set(committedEventParticipantIds(aggregate.state, status.eventId));
  const availableParticipants = committedIds === null
    ? candidateParticipants
    : candidateParticipants.filter((person) => committedIds.has(person.personId));
  const availableById = new Map(availableParticipants.map((person) => [person.personId, person]));
  const availableParticipantIds = new Set(availableParticipants.map((person) => person.personId));
  const availableTeams = (aggregate.state.teams ?? [])
    .filter((team) => team.status === "ACTIVE")
    .map((team): AlphaCardTeamView | null => {
      const memberIds = (aggregate.state.teamMemberships ?? [])
        .filter((membership) => membership.teamId === team.id && membership.active)
        .map((membership) => membership.personId)
        .sort();
      if (memberIds.length !== 2 || !memberIds.every((personId) => availableParticipantIds.has(personId))) return null;
      const memberNames = memberIds.map((personId) => peopleById.get(personId)?.name ?? personId);
      return {
        teamId: team.id,
        name: team.name,
        memberIds: [memberIds[0]!, memberIds[1]!],
        memberNames: [memberNames[0]!, memberNames[1]!],
      };
    })
    .filter((team): team is AlphaCardTeamView => team !== null)
    .sort((left, right) => left.name.localeCompare(right.name));

  const availableStables = (aggregate.state.stables ?? [])
    .filter((stable) => stable.promotionId === promotion.id && stable.status === "ACTIVE")
    .map((stable): AlphaCardStableView => ({
      stableId: stable.id,
      name: stable.name,
      memberIds: (aggregate.state.stableMemberships ?? [])
        .filter((member) => member.stableId === stable.id && member.active)
        .map((member) => member.personId),
      formerMemberIds: [...new Set((aggregate.state.stableMemberships ?? [])
        .filter((member) => member.stableId === stable.id && !member.active)
        .map((member) => member.personId))]
        .filter((personId) => !(aggregate.state.stableMemberships ?? []).some((member) =>
          member.stableId === stable.id && member.personId === personId && member.active)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const participants = draft.participantIds.map((personId) => {
    const available = availableById.get(personId);
    if (available) return { ...available };
    const person = peopleById.get(personId);
    if (!person) throw new Error(`booked wrestler ${personId} was not found`);
    return {
      personId,
      name: person.name,
      division: person.division ?? null,
      alignment: wrestlerAlignmentForPromotion(aggregate.state, promotion.id, person.id),
      popularity: person.popularity,
      momentum: person.momentum,
      morale: person.morale,
      fatigue: person.fatigue,
      wear: person.wear,
      skills: {
        inRingQuality: person.skills.inRingQuality,
        matchCraft: person.skills.matchCraft,
        safety: person.skills.safety,
        stamina: person.skills.stamina,
        presentation: person.skills.presentation,
      },
      datesRemaining: 0,
      unlimitedAppearances: false,
    } satisfies AlphaCardParticipantView;
  });

  const market = draft.marketId ? aggregate.state.markets.find((candidate) => candidate.id === draft.marketId) : null;
  const venue = draft.venueId ? aggregate.state.venues.find((candidate) => candidate.id === draft.venueId) : null;
  const programmes = cardProgrammes(aggregate.state, promotion.id);
  const segments: AlphaCardSegmentView[] = [
    ...(draft.segments ?? []).map((segment) => ({
      draftSegmentId: segment.draftSegmentId,
      type: segment.type,
      participantIds: [...segment.participantIds],
      programmeId: segment.programmeId,
      plannedLengthMinutes: segment.plannedLengthMinutes,
      attackerPersonId: ["ATTACK", "RESCUE", "POST_MATCH_ASSAULT"].includes(segment.type) ? (segment.attackerPersonId ?? null) : null,
      victimPersonId: ["ATTACK", "RESCUE", "POST_MATCH_ASSAULT"].includes(segment.type) ? (segment.victimPersonId ?? null) : null,
      rescuerPersonId: segment.type === "RESCUE" ? (segment.rescuerPersonId ?? null) : null,
      sourceDraftMatchId: segment.type === "POST_MATCH_ASSAULT" ? (segment.sourceDraftMatchId ?? null) : null,
      initiatorPersonId: ["CHALLENGE", "CONFRONTATION", "INTERRUPTION", "CONTRACT_SIGNING", "STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION"].includes(segment.type) ? (segment.initiatorPersonId ?? null) : null,
      targetPersonId: ["CHALLENGE", "CONFRONTATION", "INTERRUPTION", "CONTRACT_SIGNING", "STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION"].includes(segment.type) ? (segment.targetPersonId ?? null) : null,
      signingOutcome: segment.type === "CONTRACT_SIGNING" ? (segment.signingOutcome ?? "SIGNED") : null,
      stableId: segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION" ? (segment.stableId ?? null) : null,
      stableInvitationOutcome: segment.type === "STABLE_INVITATION" ? (segment.stableInvitationOutcome ?? "REFUSED") : null,
      stableExitOutcome: segment.type === "STABLE_EXIT" ? (segment.stableExitOutcome ?? "EXPELLED") : null,
      stableReconciliationOutcome: segment.type === "STABLE_RECONCILIATION" ? (segment.stableReconciliationOutcome ?? "RECONCILED") : null,
      challengeResponse: segment.type === "CHALLENGE" ? (segment.challengeResponse ?? null) : null,
      interruptionOutcome: segment.type === "INTERRUPTION" ? (segment.interruptionOutcome ?? "VERBAL_EXCHANGE") : null,
      attackPresentation: segment.type === "ATTACK" ? (segment.attackPresentation ?? "BLINDSIDE") : null,
      attackObjective: segment.type === "ATTACK" ? (segment.attackObjective ?? "GENERATE_HEAT") : null,
      turnPersonId: segment.type === "TURN" ? (segment.turnPersonId ?? null) : null,
      turnTargetAlignment: segment.type === "TURN" ? (segment.turnTargetAlignment ?? null) : null,
      turnPresentation: segment.type === "TURN" ? (segment.turnPresentation ?? "REVEAL") : null,
      betrayedPersonId: segment.type === "TURN" && segment.turnPresentation === "BETRAYAL"
        ? (segment.betrayedPersonId ?? null) : null,
    })),
    ...(draft.programmeSegments ?? []).map((segment) => ({
      draftSegmentId: segment.draftSegmentId,
      type: "PROMO" as const,
      participantIds: [...segment.participantIds],
      programmeId: segment.programmeId,
      plannedLengthMinutes: 6,
      turnPersonId: null,
      turnTargetAlignment: null,
      turnPresentation: null,
      betrayedPersonId: null,
    })),
  ];
  const segmentIds = new Set(segments.map((segment) => segment.draftSegmentId));
  const runningOrder: AlphaCardSlotView[] = draft.runningOrder
    ? draft.runningOrder
        .filter((slot) => slot.kind === "MATCH" || segmentIds.has(slot.refId))
        .map((slot) => ({ kind: slot.kind, refId: slot.refId }))
    : [
        ...draft.matches.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
        ...segments.map((segment) => ({ kind: "SEGMENT" as const, refId: segment.draftSegmentId })),
      ];

  const championships = (aggregate.state.championships ?? [])
    .filter((championship) => championship.promotionId === promotion.id && championship.status === "ACTIVE")
    .sort((a, b) => a.division.localeCompare(b.division) || a.name.localeCompare(b.name))
    .map((championship) => {
      const holder = championshipHolder(aggregate.state, championship.id);
      return {
        championshipId: championship.id,
        name: championship.name,
        division: championship.division,
        prestige: championship.prestige,
        holderName: holder.holderName,
        holderPersonIds: holder.holderPersonIds,
      } satisfies AlphaCardChampionshipView;
    });

  return {
    world: {
      worldId,
      year: currentDate.year,
      week: currentDate.week,
      phase: aggregate.runtime.phase,
      revision: aggregate.runtime.revision,
    },
    targetDate: { ...draft.targetDate },
    promotion: {
      promotionId: promotion.id,
      name: promotion.name,
    },
    draftId,
    workspaceVersion: workspace.version,
    reservationId: reservation?.reservationId ?? null,
    planningState: status.state,
    canEdit: aggregate.runtime.phase === "OPEN"
      && (status.availableActions.includes("EDIT_DRAFT") || status.availableActions.includes("EDIT_CARD")),
    minParticipants: aggregate.state.ruleset.minEventParticipants,
    maxParticipants: maxShowParticipantsForEventType(
      promotion,
      draft.showSeriesId
        ? aggregate.state.showSeries?.find((series) => series.id === draft.showSeriesId)?.eventType ?? "REGULAR"
        : "REGULAR",
    ),
    marketName: market?.name ?? draft.marketId ?? "Market not selected",
    venueName: venue?.name ?? draft.venueId ?? "Venue not selected",
    participants,
    availableParticipants,
    availableTeams,
    availableStables,
    matches: draft.matches.flatMap((match) => (
      match.intendedWinnerSide !== null && match.intent !== null && match.plannedLengthMinutes !== null
        ? [{
          draftMatchId: match.draftMatchId,
          programmeId: match.programmeId ?? null,
          type: match.type,
          sideAIds: [...match.sideAIds],
          sideBIds: [...match.sideBIds],
          intendedWinnerSide: match.intendedWinnerSide,
          intent: match.intent,
          ...(match.style === undefined ? {} : {
            style: { ...match.style },
            readiness: matchStyleReadiness(aggregate.state, match, draft.targetDate),
          }),
          plannedLengthMinutes: match.plannedLengthMinutes,
          plannedFinish: match.plannedFinish ?? defaultPlannedFinishForIntent(match.intent),
          interfererPersonId: match.interfererPersonId ?? null,
          interferenceSide: match.interferenceSide ?? null,
          interferenceOutcome: match.interferenceOutcome ?? (match.interfererPersonId ? "SUCCESS" : null),
        } satisfies AlphaCardMatchView]
        : []
    )),
    segments,
    runningOrder,
    programmes,
    recentMeetings: recentMeetingsForParticipants(
      aggregate.state,
      promotion.id,
      draft.participantIds,
      currentDate,
    ),
    championships,
    championshipAssignments: draft.championshipAssignments.map((assignment) => ({ ...assignment })),
    creativeConcerns: creativeConcernsForDraft(aggregate.state, aggregate.planning, draft).map(({ bookingSignature: _signature, ...concern }) => ({
      ...concern, wrestlerName: peopleById.get(concern.personId)?.name ?? concern.personId,
    })),
    cardPendingConsent: status.eventId !== null
      && (aggregate.planning.pendingCardAmendments ?? []).some((entry) =>
        entry.promotionId === promotion.id && entry.draftId === draftId
        && entry.eventId === status.eventId),
  };
}

export async function loadAlphaCurrentWeekCard(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<AlphaCurrentWeekCardView> {
  return loadAlphaShowCard(repository, worldId, playerId);
}

export async function saveAlphaShowCard(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaShowCardRequest,
): Promise<AlphaCurrentWeekCardView> {
  const requestId = requiredText(request.requestId, "requestId");
  const expectedRevision = requireExpectedRevision(request.expectedRevision);
  const expectedPlanVersion = requirePlanVersion(request.expectedPlanVersion);
  const requestedDraftId = request.draftId === undefined
    ? undefined
    : requiredText(request.draftId, "draftId", 128);
  const cardRequestId = `${requestId}:card`;
  const reservationRequestId = `${requestId}:reserve`;

  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before booking a card");

    const cardReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === cardRequestId);
    if (!cardReceipt && aggregate.runtime.revision !== expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${expectedRevision}, current ${aggregate.runtime.revision}`);
    }

    const draftId = resolveDraftId(control.promotionId, aggregate.state.world.currentDate, requestedDraftId);
    const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === control.promotionId);
    const draft = workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
    if (!workspace || !draft) {
      throw new Error("Plan this show before booking its card");
    }
    const status = playerShowPlanningStatus(
      aggregate.state,
      aggregate.planning,
      aggregate.runtime,
      control.promotionId,
      draftId,
    );
    const materializedEventId = status.eventId !== null && status.availableActions.includes("EDIT_CARD")
      ? status.eventId
      : null;

    const normalizedCard = normalizeCompleteCard(request.matches);
    for (const match of normalizedCard.matches) {
      const readiness = matchStyleReadiness(aggregate.state, match, draft.targetDate);
      if (readiness?.status !== "REFUSES" || readiness.provisional) continue;
      const names = refusalNames(readiness);
      throw new Error(
        `${names.join(" & ") || "A wrestler"} refuses this match style in their current condition`,
      );
    }
    const normalizedSegments = normalizeSegments(request.segments, aggregate.state, control.promotionId);
    const runningOrder = normalizeRunningOrder(request.runningOrder, normalizedCard.matches, normalizedSegments.segments);
    for (const segment of normalizedSegments.segments) {
      if (segment.type !== "POST_MATCH_ASSAULT") continue;
      const source = normalizedCard.matches.find((match) => match.draftMatchId === segment.sourceDraftMatchId);
      if (!source) throw new Error("post-match assault must reference a match booked on this card");
      if (![...source.sideAIds, ...source.sideBIds].includes(segment.victimPersonId!)) {
        throw new Error("post-match assault victim must compete in the referenced match");
      }
      const sourcePosition = runningOrder.findIndex((slot) => slot.kind === "MATCH" && slot.refId === source.draftMatchId);
      const assaultPosition = runningOrder.findIndex((slot) => slot.kind === "SEGMENT" && slot.refId === segment.draftSegmentId);
      if (assaultPosition !== sourcePosition + 1) {
        throw new Error("post-match assault must immediately follow its referenced match");
      }
    }
    const matchOrder = new Map(
      runningOrder
        .filter((slot) => slot.kind === "MATCH")
        .map((slot, index) => [slot.refId, index]),
    );
    const matches = [...normalizedCard.matches].sort((left, right) => (
      (matchOrder.get(left.draftMatchId) ?? Number.MAX_SAFE_INTEGER)
      - (matchOrder.get(right.draftMatchId) ?? Number.MAX_SAFE_INTEGER)
    ));
    const participantIds = [...new Set([
      ...normalizedCard.participantIds,
      ...normalizedSegments.participantIds,
    ])];
    if (participantIds.length < aggregate.state.ruleset.minEventParticipants) {
      throw new Error(`show booking requires at least ${aggregate.state.ruleset.minEventParticipants} wrestlers across the card`);
    }
    if (materializedEventId !== null) {
      const committedIds = committedEventParticipantIds(aggregate.state, materializedEventId);
      if (!sameIdSet(participantIds, committedIds)) {
        throw new Error("current-week card must use every wrestler already committed to the materialized show");
      }
    }
    const championshipAssignments = normalizeChampionshipAssignments(
      request.championshipAssignments,
      matches,
      aggregate.state,
      control.promotionId,
    );
    const committedDraftBeforeEdit = materializedEventId !== null ? structuredClone(draft) : null;
    const committedConsentsBeforeEdit = materializedEventId !== null
      ? structuredClone((aggregate.planning.creativeConsents ?? []).filter((entry) =>
          entry.promotionId === control.promotionId && entry.draftId === draftId))
      : [];
    const nextWorkspace = upsertDetailedShowDraftCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.planning,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: cardRequestId,
        worldId,
        playerId,
        commandType: "UPSERT_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: control.promotionId,
          expectedPlanVersion,
          draft: {
            ...structuredClone(draft),
            participantIds,
            matches,
            championshipAssignments,
            programmeSegments: undefined,
            segments: normalizedSegments.segments,
            runningOrder,
          },
        },
      },
    );

    if (materializedEventId !== null) {
      const storedDraft = nextWorkspace.detailedShowDrafts.find((entry) => entry.draftId === draftId)!;
      // Keep the previously committed card in place until ALL protected
      // participants approve this exact amended script. Saving a proposal
      // never substitutes a different winner or silently overrides a veto.
      if (!cardReceipt) {
        const blockers = creativeBlockersForDraft(aggregate.state, aggregate.planning, storedDraft);
        if (blockers.length > 0) {
          aggregate.planning.pendingCardAmendments ??= [];
          if (!aggregate.planning.pendingCardAmendments.some((entry) =>
            entry.promotionId === control.promotionId && entry.draftId === draftId)) {
            aggregate.planning.pendingCardAmendments.push({
              promotionId: control.promotionId,
              draftId,
              eventId: materializedEventId,
              committedDraft: committedDraftBeforeEdit!,
              committedConsents: committedConsentsBeforeEdit,
            });
          }
        } else {
          replaceMaterializedEventCard(
            aggregate.state,
            materializedEventId,
            matches,
            championshipAssignments,
          );
          // The new script was applied; its previous rollback point is stale.
          aggregate.planning.pendingCardAmendments = (aggregate.planning.pendingCardAmendments ?? [])
            .filter((entry) => !(entry.promotionId === control.promotionId && entry.draftId === draftId));
        }
      }
      return;
    }

    reserveDetailedShowDraftCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.planning,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: reservationRequestId,
        worldId,
        playerId,
        commandType: "RESERVE_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: control.promotionId,
          expectedPlanVersion: nextWorkspace.version,
          draftId,
        },
      },
    );
  });

  return loadAlphaShowCard(repository, worldId, playerId, requestedDraftId);
}

export async function saveAlphaCurrentWeekCard(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaShowCardRequest,
): Promise<AlphaCurrentWeekCardView> {
  return saveAlphaShowCard(repository, worldId, playerId, { ...request, draftId: undefined });
}

/**
 * Request agreement to a saved booking, never an unsaved client-side script.
 * The same World transaction both records the response and, once fully
 * approved, applies a pending edit to an already-materialized show.
 */
export async function requestAlphaShowCreativeConsent(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaCreativeConsentRequest,
): Promise<AlphaCurrentWeekCardView> {
  const requestId = requiredText(request.requestId, "requestId");
  const draftId = requiredText(request.draftId, "draftId", 128);
  const draftMatchId = requiredText(request.draftMatchId, "draftMatchId", 128);
  const personId = requiredText(request.personId, "personId", 128);
  const expectedRevision = requireExpectedRevision(request.expectedRevision);
  const expectedPlanVersion = requirePlanVersion(request.expectedPlanVersion);
  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before requesting consent");
    const commandRequestId = `${requestId}:creative-consent`;
    const oldReceipt = aggregate.commands.receipts.find((entry) => entry.requestId === commandRequestId);
    if (!oldReceipt && aggregate.runtime.revision !== expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${expectedRevision}, current ${aggregate.runtime.revision}`);
    }
    const workspace = aggregate.planning.workspaces.find((entry) => entry.promotionId === control.promotionId);
    const draft = workspace?.detailedShowDrafts.find((entry) => entry.draftId === draftId);
    if (!workspace || !draft) throw new Error("Save this show before requesting wrestler consent");

    const status = playerShowPlanningStatus(aggregate.state, aggregate.planning, aggregate.runtime, control.promotionId, draftId);
    if (!oldReceipt && !status.availableActions.some((action) => action === "EDIT_DRAFT" || action === "EDIT_CARD")) {
      throw new Error("Creative approval requests are closed for this show");
    }

    const result = requestCreativeBookingConsentCommand(
      aggregate.state, aggregate.ownership, aggregate.planning, aggregate.commands, aggregate.runtime,
      {
        requestId: commandRequestId, worldId, playerId,
        commandType: "REQUEST_CREATIVE_BOOKING_CONSENT",
        payload: { promotionId: control.promotionId, draftId, draftMatchId, personId, expectedPlanVersion },
      },
    );
    if (!oldReceipt && result.decision === "APPROVED" && status.eventId !== null
      && creativeBlockersForDraft(aggregate.state, aggregate.planning, draft).length === 0) {
      const plans = draft.matches.filter((match) => (
        match.intendedWinnerSide !== null && match.intent !== null && match.plannedLengthMinutes !== null
      ));
      if (plans.length !== draft.matches.length || plans.length === 0) {
        throw new Error("A complete show card is required before applying approved changes");
      }
      replaceMaterializedEventCard(
        aggregate.state, status.eventId, plans, draft.championshipAssignments,
      );
      aggregate.planning.pendingCardAmendments = (aggregate.planning.pendingCardAmendments ?? [])
        .filter((entry) => !(entry.promotionId === control.promotionId && entry.draftId === draftId));
    }
  });
  return loadAlphaShowCard(repository, worldId, playerId, draftId);
}

/**
 * Discard only a pending amendment and return the show editor to its most
 * recent committed script. Actual scheduled match objects were never changed,
 * so no match IDs, titles, fees, contract dates or outcomes are rewritten.
 */
export async function withdrawAlphaShowCreativeAmendment(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaWithdrawCreativeCardRequest,
): Promise<AlphaCurrentWeekCardView> {
  const requestId = requiredText(request.requestId, "requestId", 220);
  const draftId = requiredText(request.draftId, "draftId", 128);
  const expectedRevision = requireExpectedRevision(request.expectedRevision);
  const expectedPlanVersion = requirePlanVersion(request.expectedPlanVersion);
  const commandRequestId = `${requestId}:withdraw-creative-card`;
  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before withdrawing a card amendment");
    const priorReceipt = aggregate.commands.receipts.find((entry) => entry.requestId === commandRequestId);
    if (!priorReceipt && aggregate.runtime.revision !== expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${expectedRevision}, current ${aggregate.runtime.revision}`);
    }
    executeIdempotentCommand(
      aggregate.commands, aggregate.runtime,
      {
        requestId: commandRequestId, worldId, playerId,
        commandType: "WITHDRAW_CREATIVE_CARD_AMENDMENT",
        payload: { promotionId: control.promotionId, draftId, expectedPlanVersion },
      },
      aggregate.state.world.currentDate,
      () => {
        const workspace = aggregate.planning.workspaces.find((entry) =>
          entry.promotionId === control.promotionId);
        if (!workspace || workspace.version !== expectedPlanVersion) {
          throw new Error("stale show plan version: reload the Show Card before withdrawing");
        }
        const status = playerShowPlanningStatus(
          aggregate.state, aggregate.planning, aggregate.runtime, control.promotionId, draftId,
        );
        if (status.eventId === null || !status.availableActions.includes("EDIT_CARD")) {
          throw new Error("Only an editable materialized show can restore its committed card");
        }
        const pending = (aggregate.planning.pendingCardAmendments ?? []).find((entry) =>
          entry.promotionId === control.promotionId && entry.draftId === draftId
          && entry.eventId === status.eventId);
        if (!pending) throw new Error("No pending creative card amendment to withdraw");
        const draftIndex = workspace.detailedShowDrafts.findIndex((entry) => entry.draftId === draftId);
        if (draftIndex < 0) throw new Error("The amended show draft no longer exists");

        workspace.detailedShowDrafts[draftIndex] = structuredClone(pending.committedDraft);
        const otherConsents = (aggregate.planning.creativeConsents ?? []).filter((entry) =>
          entry.promotionId !== control.promotionId || entry.draftId !== draftId);
        aggregate.planning.creativeConsents = [...otherConsents, ...structuredClone(pending.committedConsents)];
        aggregate.planning.pendingCardAmendments = (aggregate.planning.pendingCardAmendments ?? [])
          .filter((entry) => entry !== pending);
        workspace.version += 1;
        return { restoredDraftId: draftId, restoredPlanVersion: workspace.version };
      },
    );
  });
  return loadAlphaShowCard(repository, worldId, playerId, draftId);
}

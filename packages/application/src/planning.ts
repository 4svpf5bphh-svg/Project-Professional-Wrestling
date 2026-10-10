import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type {
  Id,
  MatchIntent,
  MatchSide,
  MatchStyleProfile,
  MatchType,
  PpwDate,
  TicketStrategy,
  WorldState,
} from "../../domain/src/types.js";
import { isWrestlerAlignment, wrestlerAlignmentForPromotion } from "../../sim-core/src/alignment.js";
import type { MatchFinish } from "../../sim-core/src/match-finishes.js";
import { normalizeMatchStyle } from "../../sim-core/src/match-style.js";
import { promotionShowSeriesDueForDate } from "../../sim-core/src/show-calendar.js";
import { requireSameWrestlerDivision } from "../../sim-core/src/wrestler-division.js";

export const DETAILED_PLANNING_HORIZON_WEEKS = 6 as const;

export interface DetailedMatchDraft {
  draftMatchId: string;
  type: MatchType;
  sideAIds: Id[];
  sideBIds: Id[];
  intendedWinnerSide: MatchSide | null;
  intent: MatchIntent | null;
  style?: MatchStyleProfile;
  plannedLengthMinutes: number | null;
  plannedFinish?: MatchFinish;
  interfererPersonId?: Id | null;
  interferenceSide?: MatchSide | null;
  interferenceOutcome?: "SUCCESS" | "THWARTED" | null;
}

export interface ChampionshipDraftAssignment {
  draftMatchId: string;
  championshipId: Id;
}

export interface DetailedProgrammeSegmentDraft {
  draftSegmentId: string;
  programmeId: Id;
  participantIds: Id[];
}

export type DetailedShowSegmentType =
  | "PROMO"
  | "INTERVIEW"
  | "CONFRONTATION"
  | "INTERRUPTION"
  | "CHALLENGE"
  | "CONTRACT_SIGNING"
  | "ATTACK"
  | "RESCUE"
  | "POST_MATCH_ASSAULT"
  | "CELEBRATION"
  | "TURN";

export type AttackPresentation = "BLINDSIDE" | "BEATDOWN" | "PULL_APART_BRAWL";
export type AttackObjective = "GENERATE_HEAT" | "BUILD_SYMPATHY" | "ESCALATE_RIVALRY";
export type TurnPresentation = "REVEAL" | "BETRAYAL";
export type SigningOutcome = "SIGNED" | "REJECTED" | "WALKOUT" | "BRAWL";
export type ChallengeResponse = "ACCEPTED" | "REFUSED" | "LEFT_OPEN";
// Both outcomes are player-scripted; no random story outcome at World Lock.
export type InterruptionOutcome = "VERBAL_EXCHANGE" | "INTERRUPTER_PREVAILS" | "SPEAKER_PREVAILS" | "BRAWL";

export interface DetailedShowSegmentDraft {
  draftSegmentId: string;
  type: DetailedShowSegmentType;
  participantIds: Id[];
  programmeId: Id | null;
  plannedLengthMinutes: number;
  // Roles are authored intent; participants alone must not invent attack direction.
  attackerPersonId?: Id | null;
  victimPersonId?: Id | null;
  // RESCUE is an attack interrupted by a third, explicitly identified wrestler.
  rescuerPersonId?: Id | null;
  // POST_MATCH_ASSAULT must follow its referenced match in the same show.
  sourceDraftMatchId?: string | null;
  // CHALLENGE/CONFRONTATION direction is authored, never inferred from participant order.
  initiatorPersonId?: Id | null;
  targetPersonId?: Id | null;
  signingOutcome?: SigningOutcome | null;
  challengeResponse?: ChallengeResponse | null;
  interruptionOutcome?: InterruptionOutcome | null;
  attackPresentation?: AttackPresentation | null;
  attackObjective?: AttackObjective | null;
  turnPersonId?: Id | null;
  turnTargetAlignment?: WrestlerAlignment | null;
  turnPresentation?: TurnPresentation | null;
  betrayedPersonId?: Id | null;
}

export interface DetailedShowSlotRef {
  kind: "MATCH" | "SEGMENT";
  refId: string;
}

export interface DetailedShowDraft {
  draftId: string;
  promotionId: Id;
  showSeriesId?: Id | null;
  targetDate: PpwDate;
  marketId: Id | null;
  venueId: Id | null;
  ticketStrategy: TicketStrategy | null;
  participantIds: Id[];
  matches: DetailedMatchDraft[];
  championshipAssignments: ChampionshipDraftAssignment[];
  programmeSegments?: DetailedProgrammeSegmentDraft[];
  segments?: DetailedShowSegmentDraft[];
  runningOrder?: DetailedShowSlotRef[];
}

export interface ReservedShowParticipant {
  personId: Id;
  contractId: Id;
  serviceCapacityAtReservation: number;
}

export interface DetailedShowReservation {
  reservationId: string;
  sourceDraftId: string;
  promotionId: Id;
  showSeriesId?: Id | null;
  targetDate: PpwDate;
  marketId: Id;
  venueId: Id;
  ticketStrategy: TicketStrategy;
  participants: ReservedShowParticipant[];
  reservedPlanVersion: number;
}

export interface PromotionPlanningWorkspace {
  worldId: Id;
  promotionId: Id;
  version: number;
  detailedShowDrafts: DetailedShowDraft[];
}

export interface WorldPlanningState {
  worldId: Id;
  workspaces: PromotionPlanningWorkspace[];
  showReservations: DetailedShowReservation[];
}

const TICKET_STRATEGIES = new Set<TicketStrategy>(["ACCESSIBLE", "STANDARD", "PREMIUM", "PRESTIGE"]);
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
const BOOKABLE_MATCH_FINISHES = new Set<MatchFinish>([
  "CLEAN_PIN",
  "SUBMISSION",
  "FLASH_PIN",
  "PROTECTED_FINISH",
]);
const SHOW_SEGMENT_TYPES = new Set<DetailedShowSegmentType>([
  "PROMO",
  "INTERVIEW",
  "CONFRONTATION",
  "INTERRUPTION",
  "CHALLENGE",
  "CONTRACT_SIGNING",
  "ATTACK",
  "RESCUE",
  "POST_MATCH_ASSAULT",
  "CELEBRATION",
  "TURN",
]);

function normalizedId(value: string, label: string, maxLength = 128): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} must contain at most ${maxLength} characters`);
  return normalized;
}

function weekIndex(date: PpwDate, weeksPerYear: number): number {
  if (!Number.isInteger(date.year) || date.year < 1) throw new Error("planning target year must be a positive integer");
  if (!Number.isInteger(date.week) || date.week < 1 || date.week > weeksPerYear) {
    throw new Error(`planning target week must be between 1 and ${weeksPerYear}`);
  }
  if (!Number.isInteger(date.day) || date.day < 1 || date.day > 7) {
    throw new Error("planning target day must be between 1 and 7");
  }
  return ((date.year - 1) * weeksPerYear) + (date.week - 1);
}

function validateMatchDraft(
  state: WorldState,
  draft: DetailedMatchDraft,
  participantIds: Set<Id>,
  usedParticipantIds: Set<Id>,
): DetailedMatchDraft {
  const draftMatchId = normalizedId(draft.draftMatchId, "draftMatchId");
  if (!MATCH_TYPES.has(draft.type)) throw new Error(`unsupported draft match type ${String(draft.type)}`);

  const expectedSideSize = draft.type === "SINGLES" ? 1 : 2;
  if (!Array.isArray(draft.sideAIds) || !Array.isArray(draft.sideBIds)) {
    throw new Error("draft match sides must be arrays");
  }
  if (draft.sideAIds.length !== expectedSideSize || draft.sideBIds.length !== expectedSideSize) {
    throw new Error(`${draft.type} draft match requires ${expectedSideSize} wrestler(s) per side`);
  }

  const sideIds = [...draft.sideAIds, ...draft.sideBIds];
  if (new Set(sideIds).size !== sideIds.length) throw new Error("one wrestler cannot occupy multiple positions in a draft match");
  const sidePeople = sideIds.map((personId) => state.people.find((candidate) => candidate.id === personId));
  if (sidePeople.some((person) => !person)) throw new Error("draft match references a missing wrestler");
  requireSameWrestlerDivision(
    sidePeople as NonNullable<(typeof sidePeople)[number]>[],
    "draft matches cannot mix men's and women's divisions",
  );
  for (const personId of sideIds) {
    if (!participantIds.has(personId)) throw new Error(`${personId} is not selected for this show draft`);
    if (usedParticipantIds.has(personId)) throw new Error(`${personId} is booked more than once on this draft card`);
    usedParticipantIds.add(personId);
  }

  if (draft.intendedWinnerSide !== null && !MATCH_SIDES.has(draft.intendedWinnerSide)) {
    throw new Error("draft intended winner side must be A, B or null");
  }
  if (draft.intent !== null && !MATCH_INTENTS.has(draft.intent)) {
    throw new Error(`unsupported draft match intent ${String(draft.intent)}`);
  }
  if (
    draft.plannedLengthMinutes !== null
    && (!Number.isInteger(draft.plannedLengthMinutes) || draft.plannedLengthMinutes < 3 || draft.plannedLengthMinutes > 60)
  ) {
    throw new Error("draft planned match length must be an integer from 3 to 60 minutes or null");
  }
  if (draft.plannedFinish !== undefined && !BOOKABLE_MATCH_FINISHES.has(draft.plannedFinish)) {
    throw new Error("draft planned match finish must be clean, submission, flash or protected");
  }
  const style = draft.style === undefined ? undefined : normalizeMatchStyle(draft.style);
  const interfererPersonId = draft.interfererPersonId == null ? null : normalizedId(draft.interfererPersonId, "interfererPersonId");
  const interferenceSide = draft.interferenceSide ?? null;
  const interferenceOutcome = interfererPersonId ? (draft.interferenceOutcome ?? "SUCCESS") : null;
  if ((interfererPersonId === null) !== (interferenceSide === null)
    || (interferenceSide !== null && !MATCH_SIDES.has(interferenceSide))) {
    throw new Error("run-in requires an outside wrestler and an aided match side");
  }
  if (interferenceOutcome !== null && interferenceOutcome !== "SUCCESS" && interferenceOutcome !== "THWARTED") {
    throw new Error("run-in outcome must be successful or thwarted");
  }
  if (interferenceOutcome === "SUCCESS" && draft.intendedWinnerSide !== null && interferenceSide !== draft.intendedWinnerSide) {
    throw new Error("successful run-in must aid the booked winning side");
  }
  if (interfererPersonId !== null && sideIds.includes(interfererPersonId)) {
    throw new Error("run-in wrestler cannot compete in the same match");
  }
  if (interfererPersonId !== null && !participantIds.has(interfererPersonId)) {
    throw new Error("run-in wrestler must be selected for this show draft");
  }

  return {
    draftMatchId,
    type: draft.type,
    sideAIds: [...draft.sideAIds],
    sideBIds: [...draft.sideBIds],
    intendedWinnerSide: draft.intendedWinnerSide,
    intent: draft.intent,
    ...(style === undefined ? {} : { style }),
    plannedLengthMinutes: draft.plannedLengthMinutes,
    ...(draft.plannedFinish === undefined ? {} : { plannedFinish: draft.plannedFinish }),
    ...(interfererPersonId === null ? {} : { interfererPersonId, interferenceSide, interferenceOutcome }),
  };
}

function programmePersonIds(state: WorldState, programmeId: Id): Set<Id> {
  const programme = (state.programmes ?? []).find((candidate) => candidate.id === programmeId);
  if (!programme) return new Set();
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
  return result;
}

function validateProgrammeSegmentDraft(
  state: WorldState,
  promotionId: Id,
  draft: DetailedProgrammeSegmentDraft,
  showParticipantIds: Set<Id>,
): DetailedProgrammeSegmentDraft {
  const draftSegmentId = normalizedId(draft.draftSegmentId, "draftSegmentId");
  const programmeId = normalizedId(draft.programmeId, "programmeId");
  const programme = (state.programmes ?? []).find((candidate) => candidate.id === programmeId);
  if (!programme || programme.status !== "ACTIVE") throw new Error(`active Programme ${programmeId} was not found`);
  if (programme.promotionId !== promotionId) throw new Error("Programme segment belongs to another promotion");
  if (!Array.isArray(draft.participantIds) || draft.participantIds.length < 1 || draft.participantIds.length > 4) {
    throw new Error("Programme segment requires one to four wrestlers");
  }
  if (new Set(draft.participantIds).size !== draft.participantIds.length) {
    throw new Error("Programme segment cannot include the same wrestler twice");
  }
  const storyPeople = programmePersonIds(state, programmeId);
  for (const personId of draft.participantIds) {
    if (!showParticipantIds.has(personId)) throw new Error(`${personId} is not selected for this show draft`);
    if (!storyPeople.has(personId)) throw new Error(`${personId} does not belong to Programme ${programmeId}`);
  }
  return { draftSegmentId, programmeId, participantIds: [...draft.participantIds] };
}

function validateShowSegmentDraft(
  state: WorldState,
  promotionId: Id,
  draft: DetailedShowSegmentDraft,
  showParticipantIds: Set<Id>,
): DetailedShowSegmentDraft {
  const draftSegmentId = normalizedId(draft.draftSegmentId, "draftSegmentId");
  if (!SHOW_SEGMENT_TYPES.has(draft.type)) throw new Error(`unsupported show segment type ${String(draft.type)}`);
  if (!Array.isArray(draft.participantIds) || draft.participantIds.length < 1 || draft.participantIds.length > 4) {
    throw new Error("show segment requires one to four wrestlers");
  }
  if (new Set(draft.participantIds).size !== draft.participantIds.length) {
    throw new Error("show segment cannot include the same wrestler twice");
  }
  if (["CONFRONTATION", "INTERRUPTION", "CHALLENGE", "CONTRACT_SIGNING", "ATTACK"].includes(draft.type) && draft.participantIds.length < 2) {
    throw new Error(`${draft.type} segment requires at least two wrestlers`);
  }
  if (draft.type === "POST_MATCH_ASSAULT" && draft.participantIds.length < 2) {
    throw new Error("POST_MATCH_ASSAULT segment requires two distinct wrestlers");
  }
  if (draft.type === "RESCUE" && draft.participantIds.length < 3) {
    throw new Error("RESCUE segment requires three distinct wrestlers");
  }
  if (!Number.isInteger(draft.plannedLengthMinutes) || draft.plannedLengthMinutes < 2 || draft.plannedLengthMinutes > 20) {
    throw new Error("show segment length must be an integer from 2 to 20 minutes");
  }
  for (const personId of draft.participantIds) {
    if (!showParticipantIds.has(personId)) throw new Error(`${personId} is not selected for this show draft`);
  }

  const programmeId = draft.programmeId === null ? null : normalizedId(draft.programmeId, "programmeId");
  const turnPersonId = draft.type === "TURN"
    ? (draft.turnPersonId === null || draft.turnPersonId === undefined
      ? null
      : normalizedId(draft.turnPersonId, "turnPersonId"))
    : null;
  const turnTargetAlignment = draft.type === "TURN" ? (draft.turnTargetAlignment ?? null) : null;
  const attackerPersonId = (draft.type === "ATTACK" || draft.type === "RESCUE" || draft.type === "POST_MATCH_ASSAULT")
    ? (draft.attackerPersonId == null ? null : normalizedId(draft.attackerPersonId, "attackerPersonId")) : null;
  const victimPersonId = (draft.type === "ATTACK" || draft.type === "RESCUE" || draft.type === "POST_MATCH_ASSAULT")
    ? (draft.victimPersonId == null ? null : normalizedId(draft.victimPersonId, "victimPersonId")) : null;
  const sourceDraftMatchId = draft.type === "POST_MATCH_ASSAULT"
    ? (draft.sourceDraftMatchId == null ? null : normalizedId(draft.sourceDraftMatchId, "sourceDraftMatchId"))
    : null;
  const rescuerPersonId = draft.type === "RESCUE"
    ? (draft.rescuerPersonId == null ? null : normalizedId(draft.rescuerPersonId, "rescuerPersonId"))
    : null;
  if ((draft.type === "ATTACK" || draft.type === "RESCUE" || draft.type === "POST_MATCH_ASSAULT") && (
    !attackerPersonId || !victimPersonId || attackerPersonId === victimPersonId
    || !draft.participantIds.includes(attackerPersonId)
    || !draft.participantIds.includes(victimPersonId)
  )) throw new Error("attack angle requires distinct attacker and victim among its participants");
  if (draft.type === "RESCUE" && (
    !rescuerPersonId || rescuerPersonId === attackerPersonId || rescuerPersonId === victimPersonId
    || !draft.participantIds.includes(rescuerPersonId)
  )) throw new Error("RESCUE requires a distinct rescuer among segment participants");
  const isDirected = draft.type === "CHALLENGE" || draft.type === "CONFRONTATION" || draft.type === "INTERRUPTION" || draft.type === "CONTRACT_SIGNING";
  const initiatorPersonId = isDirected && draft.initiatorPersonId != null
    ? normalizedId(draft.initiatorPersonId, "initiatorPersonId") : null;
  const targetPersonId = isDirected && draft.targetPersonId != null
    ? normalizedId(draft.targetPersonId, "targetPersonId") : null;
  // Legacy saved segments can have no roles. New role-aware bookings must supply a valid pair.
  if (isDirected && (initiatorPersonId !== null || targetPersonId !== null) && (
    !initiatorPersonId || !targetPersonId || initiatorPersonId === targetPersonId
    || !draft.participantIds.includes(initiatorPersonId)
    || !draft.participantIds.includes(targetPersonId)
  )) throw new Error("directed segment requires distinct initiator and target among participants");
  // Null represents legacy challenges recorded before authored responses.
  const challengeResponse = draft.type === "CHALLENGE" ? (draft.challengeResponse ?? null) : null;
  if (challengeResponse !== null && !["ACCEPTED", "REFUSED", "LEFT_OPEN"].includes(challengeResponse)) {
    throw new Error("CHALLENGE has an unsupported scripted response");
  }
  const interruptionOutcome = draft.type === "INTERRUPTION" ? (draft.interruptionOutcome ?? "VERBAL_EXCHANGE") : null;
  if (draft.type === "INTERRUPTION" && (
    !initiatorPersonId || !targetPersonId
    || !["VERBAL_EXCHANGE", "INTERRUPTER_PREVAILS", "SPEAKER_PREVAILS", "BRAWL"].includes(interruptionOutcome!)
  )) throw new Error("INTERRUPTION requires interrupter, original speaker and a scripted outcome");
  const signingOutcome = draft.type === "CONTRACT_SIGNING" ? (draft.signingOutcome ?? "SIGNED") : null;
  if (draft.type === "CONTRACT_SIGNING" && (
    !initiatorPersonId || !targetPersonId
    || !["SIGNED", "REJECTED", "WALKOUT", "BRAWL"].includes(signingOutcome!)
  )) throw new Error("CONTRACT_SIGNING needs proposer, responder and a scripted outcome");
  const attackPresentation = draft.type === "ATTACK" ? (draft.attackPresentation ?? "BLINDSIDE") : null;
  const attackObjective = draft.type === "ATTACK" ? (draft.attackObjective ?? "GENERATE_HEAT") : null;
  if (draft.type === "ATTACK" && (
    !["BLINDSIDE", "BEATDOWN", "PULL_APART_BRAWL"].includes(attackPresentation!)
    || !["GENERATE_HEAT", "BUILD_SYMPATHY", "ESCALATE_RIVALRY"].includes(attackObjective!)
  )) throw new Error("ATTACK segment has an unsupported presentation or objective");
  const turnPresentation = draft.type === "TURN" ? (draft.turnPresentation ?? "REVEAL") : null;
  const betrayedPersonId = draft.type === "TURN" && turnPresentation === "BETRAYAL"
    ? (draft.betrayedPersonId == null ? null : normalizedId(draft.betrayedPersonId, "betrayedPersonId"))
    : null;
  if (draft.type === "TURN") {
    if (turnPresentation !== "REVEAL" && turnPresentation !== "BETRAYAL") {
      throw new Error("TURN segment has an unsupported presentation");
    }
    if (turnPresentation === "BETRAYAL" && (
      !betrayedPersonId || betrayedPersonId === turnPersonId || !draft.participantIds.includes(betrayedPersonId)
    )) throw new Error("BETRAYAL requires a distinct betrayed wrestler among segment participants");
    if (!turnPersonId || !draft.participantIds.includes(turnPersonId)) {
      throw new Error("TURN segment must identify one participating wrestler who turns");
    }
    if (!turnTargetAlignment || !isWrestlerAlignment(turnTargetAlignment)) {
      throw new Error("TURN segment must choose face, heel or tweener as its target alignment");
    }
    if (wrestlerAlignmentForPromotion(state, promotionId, turnPersonId) === turnTargetAlignment) {
      throw new Error("TURN segment target alignment must differ from the wrestler's current presentation");
    }
  }

  if (programmeId !== null) {
    const programme = (state.programmes ?? []).find((candidate) => candidate.id === programmeId);
    if (!programme || programme.status !== "ACTIVE") throw new Error(`active Programme ${programmeId} was not found`);
    if (programme.promotionId !== promotionId) throw new Error("show segment Programme belongs to another promotion");
    const storyPeople = programmePersonIds(state, programmeId);
    for (const personId of draft.participantIds) {
      // A rescuer can intervene in an existing feud without becoming a
      // Programme participant. Aggressor and victim still belong to it.
      if ((draft.type === "RESCUE" && personId === rescuerPersonId)
        || (draft.type === "POST_MATCH_ASSAULT" && personId === attackerPersonId)) continue;
      if (!storyPeople.has(personId)) throw new Error(`${personId} does not belong to Programme ${programmeId}`);
    }
  }

  return {
    draftSegmentId,
    type: draft.type,
    participantIds: [...draft.participantIds],
    programmeId,
    plannedLengthMinutes: draft.plannedLengthMinutes,
    ...(isDirected ? { initiatorPersonId, targetPersonId } : {}),
    ...(draft.type === "CONTRACT_SIGNING" ? { signingOutcome } : {}),
    ...(draft.type === "CHALLENGE" && challengeResponse ? { challengeResponse } : {}),
    ...(draft.type === "INTERRUPTION" ? { interruptionOutcome } : {}),
    ...(draft.type === "ATTACK" ? { attackerPersonId, victimPersonId, attackPresentation, attackObjective } : {}),
    ...(draft.type === "RESCUE" ? { attackerPersonId, victimPersonId, rescuerPersonId } : {}),
    ...(draft.type === "POST_MATCH_ASSAULT" ? { attackerPersonId, victimPersonId, sourceDraftMatchId } : {}),
    ...(draft.type === "TURN" ? { turnPersonId, turnTargetAlignment, turnPresentation, betrayedPersonId } : {}),
  };
}

function validateRunningOrder(
  raw: DetailedShowSlotRef[] | undefined,
  matchIds: Set<string>,
  segmentIds: Set<string>,
): DetailedShowSlotRef[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new Error("draft runningOrder must be an array");
  const expectedCount = matchIds.size + segmentIds.size;
  if (raw.length !== expectedCount) throw new Error("draft running order must contain every match and segment exactly once");
  const seen = new Set<string>();
  const normalized = raw.map((slot) => {
    if (!slot || (slot.kind !== "MATCH" && slot.kind !== "SEGMENT")) throw new Error("draft running order has an invalid slot kind");
    const refId = normalizedId(slot.refId, "running order refId");
    const key = `${slot.kind}:${refId}`;
    if (seen.has(key)) throw new Error("draft running order contains a duplicate slot");
    seen.add(key);
    if (slot.kind === "MATCH" && !matchIds.has(refId)) throw new Error(`running order references missing match ${refId}`);
    if (slot.kind === "SEGMENT" && !segmentIds.has(refId)) throw new Error(`running order references missing segment ${refId}`);
    return { kind: slot.kind, refId };
  });
  if (seen.size !== expectedCount) throw new Error("draft running order is incomplete");
  return normalized;
}

export function detailedShowRunningOrder(draft: DetailedShowDraft): DetailedShowSlotRef[] {
  if (draft.runningOrder) return structuredClone(draft.runningOrder);
  return [
    ...draft.matches.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
    ...(draft.segments ?? []).map((segment) => ({ kind: "SEGMENT" as const, refId: segment.draftSegmentId })),
    ...(draft.programmeSegments ?? []).map((segment) => ({ kind: "SEGMENT" as const, refId: segment.draftSegmentId })),
  ];
}

export function createWorldPlanningState(worldId: Id): WorldPlanningState {
  return { worldId, workspaces: [], showReservations: [] };
}

export function promotionPlanningWorkspace(
  planning: WorldPlanningState,
  promotionId: Id,
): PromotionPlanningWorkspace | null {
  const workspace = planning.workspaces.find((candidate) => candidate.promotionId === promotionId);
  return workspace ? structuredClone(workspace) : null;
}

export function normalizeWorldPlanningState(planning: WorldPlanningState): WorldPlanningState {
  const legacy = planning as WorldPlanningState & { showReservations?: DetailedShowReservation[] };
  return structuredClone({
    worldId: legacy.worldId,
    workspaces: legacy.workspaces ?? [],
    showReservations: Array.isArray(legacy.showReservations) ? legacy.showReservations : [],
  });
}

export function validateWorldPlanningStateShape(state: WorldState, planning: WorldPlanningState): void {
  if (planning.worldId !== state.world.id) throw new Error("planning state crosses World boundary");
  if (!Array.isArray(planning.workspaces)) throw new Error("planning workspaces must be an array");
  if (!Array.isArray(planning.showReservations)) throw new Error("planning reservations must be an array");
  const promotionIds = new Set(state.promotions.map((promotion) => promotion.id));
  const seenPromotions = new Set<Id>();

  for (const workspace of planning.workspaces) {
    if (workspace.worldId !== state.world.id) throw new Error("planning workspace crosses World boundary");
    if (!promotionIds.has(workspace.promotionId)) throw new Error("planning workspace references missing promotion");
    if (seenPromotions.has(workspace.promotionId)) throw new Error("promotion has duplicate planning workspaces");
    seenPromotions.add(workspace.promotionId);
    if (!Number.isSafeInteger(workspace.version) || workspace.version < 0) {
      throw new Error("planning workspace version is invalid");
    }
    const draftIds = new Set<string>();
    for (const draft of workspace.detailedShowDrafts) {
      if (draft.promotionId !== workspace.promotionId) throw new Error("show draft belongs to another promotion workspace");
      const draftId = normalizedId(draft.draftId, "draftId");
      if (draftIds.has(draftId)) throw new Error("planning workspace contains duplicate show draft IDs");
      draftIds.add(draftId);
    }
  }

  const reservationIds = new Set<string>();
  for (const reservation of planning.showReservations) {
    const reservationId = normalizedId(reservation.reservationId, "reservationId", 256);
    if (reservationIds.has(reservationId)) throw new Error("planning state contains duplicate reservation IDs");
    reservationIds.add(reservationId);
    normalizedId(reservation.sourceDraftId, "reservation sourceDraftId");
    if (!promotionIds.has(reservation.promotionId)) throw new Error("show reservation references missing promotion");
    weekIndex(reservation.targetDate, state.ruleset.weeksPerYear);
    if (reservation.showSeriesId) {
      const dueSeries = promotionShowSeriesDueForDate(state, reservation.promotionId, reservation.targetDate);
      if (!dueSeries.some((series) => series.id === reservation.showSeriesId)) {
        throw new Error("show reservation references a show identity that is not due in its target PPW week");
      }
    }
    const market = state.markets.find((candidate) => candidate.id === reservation.marketId);
    if (!market) throw new Error("show reservation references missing market");
    const venue = state.venues.find((candidate) => candidate.id === reservation.venueId);
    if (!venue || venue.marketId !== market.id) throw new Error("show reservation references invalid venue/market pair");
    if (!TICKET_STRATEGIES.has(reservation.ticketStrategy)) throw new Error("show reservation has invalid ticket strategy");
    if (!Number.isSafeInteger(reservation.reservedPlanVersion) || reservation.reservedPlanVersion < 0) {
      throw new Error("planning workspace version is invalid");
    }
    const participantIds = new Set<Id>();
    for (const participant of reservation.participants) {
      if (participantIds.has(participant.personId)) throw new Error("show reservation contains duplicate participant");
      participantIds.add(participant.personId);
      if (!state.people.some((person) => person.id === participant.personId)) {
        throw new Error("show reservation references missing wrestler");
      }
      const contract = state.contracts.find((candidate) => candidate.id === participant.contractId);
      if (!contract || contract.personId !== participant.personId || contract.promotionId !== reservation.promotionId) {
        throw new Error("show reservation references invalid participant contract");
      }
      if (!Number.isSafeInteger(participant.serviceCapacityAtReservation) || participant.serviceCapacityAtReservation < 1) {
        throw new Error("show reservation has invalid service capacity snapshot");
      }
    }
  }
}

export function validateDetailedShowDraft(state: WorldState, draft: DetailedShowDraft): DetailedShowDraft {
  const promotion = state.promotions.find((candidate) => candidate.id === draft.promotionId);
  if (!promotion) throw new Error(`promotion ${draft.promotionId} was not found`);

  const currentIndex = weekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const targetIndex = weekIndex(draft.targetDate, state.ruleset.weeksPerYear);
  const delta = targetIndex - currentIndex;
  if (delta < 0 || delta >= DETAILED_PLANNING_HORIZON_WEEKS) {
    throw new Error(`detailed show drafts must target the current PPW week or next ${DETAILED_PLANNING_HORIZON_WEEKS - 1} weeks`);
  }

  const draftId = normalizedId(draft.draftId, "draftId");
  const showSeriesId = draft.showSeriesId ?? null;
  if (showSeriesId !== null) {
    const dueSeries = promotionShowSeriesDueForDate(state, draft.promotionId, draft.targetDate);
    if (!dueSeries.some((series) => series.id === showSeriesId)) {
      throw new Error("selected show identity is not due for this promotion in the draft target PPW week");
    }
  }
  if (draft.ticketStrategy !== null && !TICKET_STRATEGIES.has(draft.ticketStrategy)) {
    throw new Error(`unsupported ticket strategy ${String(draft.ticketStrategy)}`);
  }

  if (draft.marketId !== null && !state.markets.some((market) => market.id === draft.marketId)) {
    throw new Error(`market ${draft.marketId} was not found`);
  }
  if (draft.venueId !== null) {
    const venue = state.venues.find((candidate) => candidate.id === draft.venueId);
    if (!venue) throw new Error(`venue ${draft.venueId} was not found`);
    if (draft.marketId === null) throw new Error("a draft venue requires a selected market");
    if (venue.marketId !== draft.marketId) throw new Error("draft venue does not belong to the selected market");
  }

  if (!Array.isArray(draft.participantIds)) throw new Error("draft participantIds must be an array");
  const participantIds = new Set<Id>();
  for (const personId of draft.participantIds) {
    if (participantIds.has(personId)) throw new Error(`${personId} is selected more than once for the show draft`);
    const person = state.people.find((candidate) => candidate.id === personId);
    if (!person) throw new Error(`wrestler ${personId} was not found`);
    if (person.status === "RETIRED") throw new Error(`${personId} is retired and cannot be added to a future show draft`);
    participantIds.add(personId);
  }

  if (!Array.isArray(draft.matches)) throw new Error("draft matches must be an array");
  const usedParticipantIds = new Set<Id>();
  const draftMatchIds = new Set<string>();
  const matches = draft.matches.map((match) => {
    const validated = validateMatchDraft(state, match, participantIds, usedParticipantIds);
    if (draftMatchIds.has(validated.draftMatchId)) throw new Error("draft card contains duplicate match IDs");
    draftMatchIds.add(validated.draftMatchId);
    return validated;
  });

  if (!Array.isArray(draft.championshipAssignments)) throw new Error("draft championshipAssignments must be an array");
  const assignedMatches = new Set<string>();
  const assignedChampionships = new Set<Id>();
  const championshipAssignments = draft.championshipAssignments.map((assignment) => {
    const draftMatchId = normalizedId(assignment.draftMatchId, "championship draftMatchId");
    const match = matches.find((candidate) => candidate.draftMatchId === draftMatchId);
    if (!match) throw new Error(`championship assignment references missing draft match ${draftMatchId}`);
    const championship = state.championships?.find((candidate) => candidate.id === assignment.championshipId);
    if (!championship || championship.status !== "ACTIVE") throw new Error(`active championship ${assignment.championshipId} was not found`);
    if (championship.promotionId !== draft.promotionId) throw new Error("draft championship belongs to another promotion");
    if (championship.division !== match.type) throw new Error("draft championship division does not match draft match type");
    if (assignedMatches.has(draftMatchId)) throw new Error("one draft match cannot carry multiple championships");
    if (assignedChampionships.has(championship.id)) throw new Error("one championship cannot be assigned twice on a draft card");
    assignedMatches.add(draftMatchId);
    assignedChampionships.add(championship.id);
    return { draftMatchId, championshipId: championship.id };
  });

  const rawProgrammeSegments = draft.programmeSegments;
  if (rawProgrammeSegments !== undefined && !Array.isArray(rawProgrammeSegments)) {
    throw new Error("draft programmeSegments must be an array");
  }
  const draftSegmentIds = new Set<string>();
  const segmentProgrammeIds = new Set<Id>();
  const programmeSegments = (rawProgrammeSegments ?? []).map((segment) => {
    const validated = validateProgrammeSegmentDraft(state, draft.promotionId, segment, participantIds);
    if (draftSegmentIds.has(validated.draftSegmentId)) throw new Error("draft contains duplicate segment IDs");
    if (segmentProgrammeIds.has(validated.programmeId)) throw new Error("one Programme can have only one segment on a show");
    draftSegmentIds.add(validated.draftSegmentId);
    segmentProgrammeIds.add(validated.programmeId);
    return validated;
  });

  const rawSegments = draft.segments;
  if (rawSegments !== undefined && !Array.isArray(rawSegments)) throw new Error("draft segments must be an array");
  const segments = (rawSegments ?? []).map((segment) => {
    const validated = validateShowSegmentDraft(state, draft.promotionId, segment, participantIds);
    if (draftSegmentIds.has(validated.draftSegmentId)) throw new Error("draft contains duplicate segment IDs");
    if (validated.programmeId && segmentProgrammeIds.has(validated.programmeId)) {
      throw new Error("one Programme can have only one segment on a show");
    }
    draftSegmentIds.add(validated.draftSegmentId);
    if (validated.programmeId) segmentProgrammeIds.add(validated.programmeId);
    return validated;
  });
  const runningOrder = validateRunningOrder(draft.runningOrder, draftMatchIds, draftSegmentIds);
  const actualOrder = runningOrder ?? [
    ...matches.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
    ...segments.map((segment) => ({ kind: "SEGMENT" as const, refId: segment.draftSegmentId })),
    ...programmeSegments.map((segment) => ({ kind: "SEGMENT" as const, refId: segment.draftSegmentId })),
  ];
  for (const segment of segments) {
    if (segment.type !== "POST_MATCH_ASSAULT") continue;
    const source = matches.find((match) => match.draftMatchId === segment.sourceDraftMatchId);
    if (!source) throw new Error("post-match assault must reference a match booked on this card");
    const victimIsCompetitor = [...source.sideAIds, ...source.sideBIds].includes(segment.victimPersonId!);
    if (!victimIsCompetitor) throw new Error("post-match assault victim must compete in the referenced match");
    const sourcePosition = actualOrder.findIndex((slot) => slot.kind === "MATCH" && slot.refId === source.draftMatchId);
    const assaultPosition = actualOrder.findIndex((slot) => slot.kind === "SEGMENT" && slot.refId === segment.draftSegmentId);
    if (assaultPosition !== sourcePosition + 1) {
      throw new Error("post-match assault must immediately follow its referenced match");
    }
  }

  return structuredClone({
    draftId,
    promotionId: draft.promotionId,
    showSeriesId,
    targetDate: draft.targetDate,
    marketId: draft.marketId,
    venueId: draft.venueId,
    ticketStrategy: draft.ticketStrategy,
    participantIds: [...draft.participantIds],
    matches,
    championshipAssignments,
    ...(rawProgrammeSegments === undefined ? {} : { programmeSegments }),
    ...(rawSegments === undefined ? {} : { segments }),
    ...(runningOrder === undefined ? {} : { runningOrder }),
  });
}

function requireWorkspaceVersion(workspace: PromotionPlanningWorkspace | null, expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("expected plan version is invalid");
  const currentVersion = workspace?.version ?? 0;
  if (currentVersion !== expectedVersion) {
    throw new Error(`stale plan version: expected ${expectedVersion}, current ${currentVersion}`);
  }
}

export function upsertDetailedShowDraft(
  state: WorldState,
  planning: WorldPlanningState,
  promotionId: Id,
  expectedVersion: number,
  draft: DetailedShowDraft,
): PromotionPlanningWorkspace {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");
  if (draft.promotionId !== promotionId) throw new Error("show draft promotion does not match planning command promotion");

  const existing = planning.workspaces.find((candidate) => candidate.promotionId === promotionId) ?? null;
  requireWorkspaceVersion(existing, expectedVersion);
  const validatedDraft = validateDetailedShowDraft(state, draft);

  let workspace = existing;
  if (!workspace) {
    workspace = { worldId: state.world.id, promotionId, version: 0, detailedShowDrafts: [] };
    planning.workspaces.push(workspace);
  }

  const conflictingDraft = workspace.detailedShowDrafts.find((candidate) => (
    candidate.draftId !== validatedDraft.draftId
    && candidate.showSeriesId === validatedDraft.showSeriesId
    && candidate.targetDate.year === validatedDraft.targetDate.year
    && candidate.targetDate.week === validatedDraft.targetDate.week
  ));
  if (conflictingDraft) {
    throw new Error("show identity already has a draft in that PPW week");
  }

  const existingIndex = workspace.detailedShowDrafts.findIndex((candidate) => candidate.draftId === validatedDraft.draftId);
  if (existingIndex >= 0) workspace.detailedShowDrafts[existingIndex] = validatedDraft;
  else workspace.detailedShowDrafts.push(validatedDraft);

  workspace.detailedShowDrafts.sort((a, b) => {
    const aIndex = weekIndex(a.targetDate, state.ruleset.weeksPerYear);
    const bIndex = weekIndex(b.targetDate, state.ruleset.weeksPerYear);
    return aIndex - bIndex || a.targetDate.day - b.targetDate.day || a.draftId.localeCompare(b.draftId);
  });
  workspace.version += 1;
  return structuredClone(workspace);
}

export function removeDetailedShowDraft(
  planning: WorldPlanningState,
  promotionId: Id,
  expectedVersion: number,
  draftIdInput: string,
): PromotionPlanningWorkspace {
  const workspace = planning.workspaces.find((candidate) => candidate.promotionId === promotionId) ?? null;
  requireWorkspaceVersion(workspace, expectedVersion);
  if (!workspace) throw new Error(`promotion ${promotionId} has no planning workspace`);
  const draftId = normalizedId(draftIdInput, "draftId");
  const index = workspace.detailedShowDrafts.findIndex((candidate) => candidate.draftId === draftId);
  if (index < 0) throw new Error(`show draft ${draftId} was not found`);
  workspace.detailedShowDrafts.splice(index, 1);
  workspace.version += 1;
  return structuredClone(workspace);
}

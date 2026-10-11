import type { Id, MatchSide, MatchType, PpwDate, WorldState } from "../../domain/src/types.js";
import { addPpwWeeks, comparePpwDates } from "../../sim-core/src/clock.js";
import {
  applicableCreativeContract,
  creativeBookingAgreed,
  creativeBookingDecisionScore,
  resolvedCreativeControl,
} from "../../sim-core/src/creative-control.js";
import type { Programme, ProgrammeParticipantRef } from "../../domain/src/programmes.js";
import { defaultPlannedFinishForIntent } from "../../sim-core/src/match-finishes.js";
import type { DetailedMatchDraft, WorldPlanningState } from "./planning.js";

export type StandingCreativeOutcome = "WIN_ONLY" | "WIN_OR_PROTECTED_LOSS";

/**
 * A narrow wrestler-approved Programme arc, NOT blanket contract consent.
 * The participant rosters are frozen at agreement time so roster/team edits
 * cannot enlarge a promise after it was negotiated.
 */
export interface StandingProgrammeCreativeAgreement {
  worldId: Id;
  promotionId: Id;
  programmeId: Id;
  personId: Id;
  contractId: Id;
  decidedDate: PpwDate;
  expiresDate: PpwDate;
  approved: boolean;
  score: number;
  matchType: MatchType;
  permittedOutcome: StandingCreativeOutcome;
  ownSidePersonIds: Id[];
  opposingPersonIds: Id[];
}

export interface StandingProgrammeCreativeRequest {
  promotionId: Id;
  programmeId: Id;
  personId: Id;
  matchType: MatchType;
  permittedOutcome: StandingCreativeOutcome;
  termWeeks: number;
}

function participantsForRefs(state: WorldState, refs: ProgrammeParticipantRef[]): Id[] {
  const all = refs.flatMap((ref) => ref.kind === "PERSON"
    ? [ref.entityId]
    : (state.teamMemberships ?? [])
      .filter((member) => member.teamId === ref.entityId && member.active)
      .map((member) => member.personId));
  return [...new Set(all)].sort();
}

function sidesForProgramme(state: WorldState, programme: Programme, personId: Id): {
  own: Id[]; opponents: Id[];
} | null {
  const sideA = participantsForRefs(state, programme.sideA);
  const sideB = participantsForRefs(state, programme.sideB);
  if (sideA.includes(personId) && !sideB.includes(personId)) return { own: sideA, opponents: sideB };
  if (sideB.includes(personId) && !sideA.includes(personId)) return { own: sideB, opponents: sideA };
  return null;
}

/**
 * One decision per wrestler+contract+Programme. Repeating the request,
 * changing a clause after refusal, or going offline cannot reroll consent.
 * This service is pure application state; owning-controller and World Lock
 * checks belong to the idempotent command wrapper.
 */
export function requestStandingProgrammeCreativeAgreement(
  state: WorldState,
  planning: WorldPlanningState,
  input: StandingProgrammeCreativeRequest,
): StandingProgrammeCreativeAgreement {
  if (planning.worldId !== state.world.id) throw new Error("standing creative agreement crosses World boundary");
  if (!Number.isSafeInteger(input.termWeeks) || input.termWeeks < 1 || input.termWeeks > 6) {
    throw new Error("standing creative agreement must last between 1 and 6 PPW weeks");
  }
  if (input.matchType !== "SINGLES" && input.matchType !== "TAG") {
    throw new Error("standing creative agreement has invalid match type");
  }
  if (input.permittedOutcome !== "WIN_ONLY" && input.permittedOutcome !== "WIN_OR_PROTECTED_LOSS") {
    throw new Error("standing creative agreement has invalid finish scope");
  }
  const programme = (state.programmes ?? []).find((item) => item.id === input.programmeId
    && item.promotionId === input.promotionId && item.worldId === state.world.id && item.status === "ACTIVE");
  if (!programme) throw new Error("an active, controlled Programme is required");
  const sides = sidesForProgramme(state, programme, input.personId);
  if (!sides || sides.own.length === 0 || sides.opponents.length === 0) {
    throw new Error("wrestler must be a current Programme participant with opponents");
  }
  const contract = applicableCreativeContract(state, input.promotionId, input.personId, state.world.currentDate);
  if (!contract || resolvedCreativeControl(contract.creativeControl) !== "FULL_APPROVAL") {
    throw new Error("standing match agreements require a signed FULL_APPROVAL contract");
  }
  const previous = (planning.standingProgrammeCreativeAgreements ?? []).find((entry) =>
    entry.promotionId === input.promotionId && entry.programmeId === programme.id
    && entry.personId === input.personId && entry.contractId === contract.id);
  if (previous) {
    if (previous.matchType !== input.matchType || previous.permittedOutcome !== input.permittedOutcome
      || comparePpwDates(previous.expiresDate, addPpwWeeks(previous.decidedDate, input.termWeeks, state.ruleset.weeksPerYear), state.ruleset.weeksPerYear) !== 0) {
      throw new Error("standing Programme terms already agreed or refused; do not reroll with different terms");
    }
    return structuredClone(previous);
  }
  const person = state.people.find((item) => item.id === input.personId);
  if (!person) throw new Error("Programme wrestler no longer exists");
  const expiresDate = addPpwWeeks(state.world.currentDate, input.termWeeks, state.ruleset.weeksPerYear);
  const score = Math.max(0, creativeBookingDecisionScore(person, contract, "MATCH_APPROVAL")
    - (input.permittedOutcome === "WIN_OR_PROTECTED_LOSS" ? 8 : 0));
  const approved = creativeBookingAgreed(score);
  const entry: StandingProgrammeCreativeAgreement = {
    worldId: state.world.id, promotionId: input.promotionId,
    programmeId: programme.id, personId: input.personId, contractId: contract.id,
    decidedDate: { ...state.world.currentDate }, expiresDate,
    approved, score,
    matchType: input.matchType, permittedOutcome: input.permittedOutcome,
    ownSidePersonIds: sides.own, opposingPersonIds: sides.opponents,
  };
  planning.standingProgrammeCreativeAgreements ??= [];
  planning.standingProgrammeCreativeAgreements.push(entry);
  return structuredClone(entry);
}

/**
 * Applied ONLY when a match explicitly names its Programme; matching wrestler
 * IDs alone must never manufacture a waiver. Clean/submission losses and
 * unagreed outside interference always require fresh exact-match approval.
 */
export function standingProgrammeAgreementCoversMatch(
  state: WorldState,
  planning: WorldPlanningState,
  input: {
    programmeId: Id;
    promotionId: Id;
    personId: Id;
    targetDate: PpwDate;
    match: DetailedMatchDraft;
  },
): boolean {
  const { match } = input;
  const programme = (state.programmes ?? []).find((item) => item.id === input.programmeId
    && item.promotionId === input.promotionId && item.status === "ACTIVE");
  if (!programme || match.intendedWinnerSide === null || match.intent === null
    || match.plannedLengthMinutes === null || match.interfererPersonId) return false;
  const agreement = (planning.standingProgrammeCreativeAgreements ?? []).find((entry) =>
    entry.worldId === state.world.id && entry.promotionId === input.promotionId
    && entry.programmeId === input.programmeId && entry.personId === input.personId
    && entry.approved && entry.matchType === match.type);
  if (!agreement || comparePpwDates(input.targetDate, agreement.decidedDate, state.ruleset.weeksPerYear) < 0
    || comparePpwDates(input.targetDate, agreement.expiresDate, state.ruleset.weeksPerYear) > 0) return false;
  const contract = applicableCreativeContract(state, input.promotionId, input.personId, input.targetDate);
  if (!contract || contract.id !== agreement.contractId
    || resolvedCreativeControl(contract.creativeControl) !== "FULL_APPROVAL") return false;
  const sides = sidesForProgramme(state, programme, input.personId);
  if (!sides || JSON.stringify(sides.own) !== JSON.stringify(agreement.ownSidePersonIds)
    || JSON.stringify(sides.opponents) !== JSON.stringify(agreement.opposingPersonIds)) return false;
  const ownBookedSide: MatchSide | null =
    match.sideAIds.includes(input.personId) ? "A" :
      match.sideBIds.includes(input.personId) ? "B" : null;
  if (!ownBookedSide) return false;
  const ownBooked = ownBookedSide === "A" ? match.sideAIds : match.sideBIds;
  const opponents = ownBookedSide === "A" ? match.sideBIds : match.sideAIds;
  if (!ownBooked.length || !opponents.length || !ownBooked.every((id) => sides.own.includes(id))
    || !opponents.every((id) => sides.opponents.includes(id))) return false;
  const loses = ownBookedSide !== match.intendedWinnerSide;
  if (!loses) return true;
  if (agreement.permittedOutcome !== "WIN_OR_PROTECTED_LOSS") return false;
  const finish = match.plannedFinish ?? defaultPlannedFinishForIntent(match.intent);
  return finish === "PROTECTED_FINISH" || finish === "FLASH_PIN";
}

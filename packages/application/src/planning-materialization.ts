import type {
  Contract,
  Id,
  Match,
  PpwDate,
  Promotion,
  WorldState,
  WrestlingEvent,
} from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { serviceCapacityDatesPerWeek } from "../../sim-core/src/contracts.js";
import { prepareHumanShow } from "../../sim-core/src/events.js";
import {
  prepareHumanMatchCard,
  type HumanMatchPlan,
} from "../../sim-core/src/human-booking.js";
import { bookHumanChampionshipMatch } from "../../sim-core/src/human-championships.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import type {
  DetailedShowDraft,
  DetailedShowReservation,
  WorldPlanningState,
} from "./planning.js";

export type ReservationRiskReason =
  | "PROMOTION_NOT_HUMAN_CONTROLLED"
  | "PROMOTION_NOT_OPERATING"
  | "PROMOTION_SHOW_ALREADY_EXISTS"
  | "MARKET_OR_VENUE_INVALID"
  | "VENUE_UNAVAILABLE"
  | "WRESTLER_UNAVAILABLE"
  | "WRESTLER_DOUBLE_BOOKED"
  | "SERVICE_CAPACITY_EXCEEDED"
  | "CONTRACT_UNAVAILABLE"
  | "CONTRACT_DATE_EXHAUSTED";

export type ReservationAssessmentStatus = "NOT_DUE" | "READY" | "AT_RISK" | "EXPIRED";

export interface ReservationAssessment {
  reservationId: string;
  promotionId: Id;
  sourceDraftId: string;
  targetDate: PpwDate;
  status: ReservationAssessmentStatus;
  reasons: ReservationRiskReason[];
}

export interface ChampionshipMaterializationWarning {
  draftMatchId: string;
  championshipId: Id;
  reason: string;
}

export interface MaterializedShowReservation {
  reservationId: string;
  sourceDraftId: string;
  promotionId: Id;
  eventId: Id;
  cardMaterialized: boolean;
  matchIds: Id[];
  championshipAssignmentsApplied: number;
  championshipWarnings: ChampionshipMaterializationWarning[];
}

export interface ReservationMaterializationPass {
  materialized: MaterializedShowReservation[];
  atRisk: ReservationAssessment[];
  expiredReservationIds: string[];
}

export interface ReservationLockClosure extends ReservationMaterializationPass {
  releasedAtRisk: ReservationAssessment[];
}

function samePpwDate(a: PpwDate, b: PpwDate): boolean {
  return a.year === b.year && a.week === b.week && a.day === b.day;
}

function samePpwWeek(a: PpwDate, b: PpwDate): boolean {
  return a.year === b.year && a.week === b.week;
}

function targetWeekIndex(state: WorldState, date: PpwDate): number {
  return ppwDateToWeekIndex(date, state.ruleset.weeksPerYear);
}

function currentWeekIndex(state: WorldState): number {
  return ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
}

function promotionRunsAtDate(state: WorldState, promotion: Promotion, date: PpwDate): boolean {
  if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") return false;
  return targetWeekIndex(state, date) % Math.max(1, promotion.eventCadenceWeeks) === 0;
}

function contractCoversDate(state: WorldState, contract: Contract, date: PpwDate): boolean {
  if (contract.status !== "SIGNED") return false;
  return comparePpwDates(date, contract.startDate, state.ruleset.weeksPerYear) >= 0
    && comparePpwDates(date, contract.endDate, state.ruleset.weeksPerYear) <= 0;
}

function scheduledContractDates(state: WorldState, contractId: Id): number {
  return state.scheduledAppearances.filter(
    (appearance) => appearance.contractId === contractId && appearance.status === "COMMITTED",
  ).length;
}

function reservedContractDates(
  planning: WorldPlanningState,
  contractId: Id,
  excludingReservationId: string,
): number {
  let count = 0;
  for (const reservation of planning.showReservations) {
    if (reservation.reservationId === excludingReservationId) continue;
    count += reservation.participants.filter((participant) => participant.contractId === contractId).length;
  }
  return count;
}

function uniqueReasons(reasons: ReservationRiskReason[]): ReservationRiskReason[] {
  return [...new Set(reasons)];
}

export function assessDetailedShowReservation(
  state: WorldState,
  planning: WorldPlanningState,
  reservation: DetailedShowReservation,
): ReservationAssessment {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");

  const currentWeek = currentWeekIndex(state);
  const targetWeek = targetWeekIndex(state, reservation.targetDate);
  const base = {
    reservationId: reservation.reservationId,
    promotionId: reservation.promotionId,
    sourceDraftId: reservation.sourceDraftId,
    targetDate: { ...reservation.targetDate },
  };
  if (targetWeek < currentWeek) return { ...base, status: "EXPIRED", reasons: [] };
  if (targetWeek > currentWeek) return { ...base, status: "NOT_DUE", reasons: [] };

  const reasons: ReservationRiskReason[] = [];
  const promotion = state.promotions.find((candidate) => candidate.id === reservation.promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN") {
    reasons.push("PROMOTION_NOT_HUMAN_CONTROLLED");
  }
  if (!promotion || !promotionRunsAtDate(state, promotion, reservation.targetDate)) {
    reasons.push("PROMOTION_NOT_OPERATING");
  }

  if (state.events.some((event) => (
    event.promotionId === reservation.promotionId
    && event.status !== "CANCELLED"
    && samePpwWeek(event.date, reservation.targetDate)
  ))) {
    reasons.push("PROMOTION_SHOW_ALREADY_EXISTS");
  }

  const market = state.markets.find((candidate) => candidate.id === reservation.marketId);
  const venue = state.venues.find((candidate) => candidate.id === reservation.venueId);
  if (!market || !venue || venue.marketId !== market.id) {
    reasons.push("MARKET_OR_VENUE_INVALID");
  } else if (state.events.some((event) => (
    event.status !== "CANCELLED"
    && event.venueId === venue.id
    && samePpwDate(event.date, reservation.targetDate)
  ))) {
    reasons.push("VENUE_UNAVAILABLE");
  }

  for (const reservedParticipant of reservation.participants) {
    const person = state.people.find((candidate) => candidate.id === reservedParticipant.personId);
    if (!person || person.status !== "ACTIVE") {
      reasons.push("WRESTLER_UNAVAILABLE");
      continue;
    }

    if (state.scheduledAppearances.some((appearance) => (
      appearance.personId === person.id
      && appearance.status !== "CANCELLED"
      && samePpwDate(appearance.date, reservation.targetDate)
    ))) {
      reasons.push("WRESTLER_DOUBLE_BOOKED");
    }

    const capacity = Math.max(1, Math.floor(serviceCapacityDatesPerWeek(person)));
    const scheduledThisWeek = state.scheduledAppearances.filter((appearance) => (
      appearance.personId === person.id
      && appearance.status !== "CANCELLED"
      && samePpwWeek(appearance.date, reservation.targetDate)
    )).length;
    const reservedThisWeek = planning.showReservations.filter((candidate) => (
      candidate.reservationId !== reservation.reservationId
      && samePpwWeek(candidate.targetDate, reservation.targetDate)
    )).reduce(
      (count, candidate) => count + (candidate.participants.some((entry) => entry.personId === person.id) ? 1 : 0),
      0,
    );
    if (scheduledThisWeek + reservedThisWeek >= capacity) reasons.push("SERVICE_CAPACITY_EXCEEDED");

    const contract = state.contracts.find((candidate) => candidate.id === reservedParticipant.contractId);
    if (
      !contract
      || contract.personId !== person.id
      || contract.promotionId !== reservation.promotionId
      || !contractCoversDate(state, contract, reservation.targetDate)
    ) {
      reasons.push("CONTRACT_UNAVAILABLE");
      continue;
    }

    const committedDates = contract.datesUsed
      + scheduledContractDates(state, contract.id)
      + reservedContractDates(planning, contract.id, reservation.reservationId);
    if (committedDates >= contract.dateEntitlement) reasons.push("CONTRACT_DATE_EXHAUSTED");
  }

  const normalizedReasons = uniqueReasons(reasons);
  return {
    ...base,
    status: normalizedReasons.length ? "AT_RISK" : "READY",
    reasons: normalizedReasons,
  };
}

function sourceDraft(
  planning: WorldPlanningState,
  reservation: DetailedShowReservation,
): DetailedShowDraft | null {
  const workspace = planning.workspaces.find((candidate) => candidate.promotionId === reservation.promotionId);
  return workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === reservation.sourceDraftId) ?? null;
}

function sameParticipantSet(draft: DetailedShowDraft, reservation: DetailedShowReservation): boolean {
  const draftIds = [...draft.participantIds].sort();
  const reservedIds = reservation.participants.map((participant) => participant.personId).sort();
  return draftIds.length === reservedIds.length && draftIds.every((personId, index) => personId === reservedIds[index]);
}

function completeCardPlans(
  draft: DetailedShowDraft,
  reservation: DetailedShowReservation,
): { plans: HumanMatchPlan[]; draftMatchIds: string[] } | null {
  if (!sameParticipantSet(draft, reservation) || draft.matches.length === 0) return null;
  const reservedIds = new Set(reservation.participants.map((participant) => participant.personId));
  const used = new Set<Id>();
  const plans: HumanMatchPlan[] = [];
  const draftMatchIds: string[] = [];

  for (const match of draft.matches) {
    if (match.intendedWinnerSide === null || match.intent === null || match.plannedLengthMinutes === null) return null;
    const expectedSideSize = match.type === "SINGLES" ? 1 : 2;
    if (match.sideAIds.length !== expectedSideSize || match.sideBIds.length !== expectedSideSize) return null;
    const ids = [...match.sideAIds, ...match.sideBIds];
    if (new Set(ids).size !== ids.length) return null;
    for (const personId of ids) {
      if (!reservedIds.has(personId) || used.has(personId)) return null;
      used.add(personId);
    }
    plans.push({
      type: match.type,
      sideAIds: [...match.sideAIds],
      sideBIds: [...match.sideBIds],
      intendedWinnerSide: match.intendedWinnerSide,
      intent: match.intent,
      plannedLengthMinutes: match.plannedLengthMinutes,
    });
    draftMatchIds.push(match.draftMatchId);
  }

  if (used.size !== reservedIds.size || [...reservedIds].some((personId) => !used.has(personId))) return null;
  return { plans, draftMatchIds };
}

function pinReservedContracts(
  state: WorldState,
  event: WrestlingEvent,
  reservation: DetailedShowReservation,
): void {
  const appearances = state.scheduledAppearances.filter(
    (appearance) => appearance.eventId === event.id && appearance.status === "COMMITTED",
  );
  for (const reservedParticipant of reservation.participants) {
    const appearance = appearances.find((candidate) => candidate.personId === reservedParticipant.personId);
    if (!appearance) throw new Error(`materialized event is missing reserved wrestler ${reservedParticipant.personId}`);
    appearance.contractId = reservedParticipant.contractId;
  }
}

function materializeCardIfComplete(
  state: WorldState,
  planning: WorldPlanningState,
  reservation: DetailedShowReservation,
  event: WrestlingEvent,
): {
  matches: Match[];
  championshipAssignmentsApplied: number;
  championshipWarnings: ChampionshipMaterializationWarning[];
} {
  const draft = sourceDraft(planning, reservation);
  if (!draft) return { matches: [], championshipAssignmentsApplied: 0, championshipWarnings: [] };
  const complete = completeCardPlans(draft, reservation);
  if (!complete) return { matches: [], championshipAssignmentsApplied: 0, championshipWarnings: [] };

  let matches: Match[];
  try {
    matches = prepareHumanMatchCard(state, event.id, complete.plans);
  } catch {
    return { matches: [], championshipAssignmentsApplied: 0, championshipWarnings: [] };
  }

  const matchByDraftId = new Map<string, Match>();
  complete.draftMatchIds.forEach((draftMatchId, index) => matchByDraftId.set(draftMatchId, matches[index]!));
  const warnings: ChampionshipMaterializationWarning[] = [];
  let applied = 0;
  for (const assignment of draft.championshipAssignments) {
    const match = matchByDraftId.get(assignment.draftMatchId);
    if (!match) continue;
    try {
      bookHumanChampionshipMatch(state, event.id, match.id, assignment.championshipId);
      applied += 1;
    } catch (error) {
      warnings.push({
        draftMatchId: assignment.draftMatchId,
        championshipId: assignment.championshipId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { matches, championshipAssignmentsApplied: applied, championshipWarnings: warnings };
}

function removeReservation(planning: WorldPlanningState, reservationId: string): void {
  const index = planning.showReservations.findIndex((candidate) => candidate.reservationId === reservationId);
  if (index >= 0) planning.showReservations.splice(index, 1);
}

function appendMaterializedLedger(
  state: WorldState,
  reservation: DetailedShowReservation,
  event: WrestlingEvent,
  cardMaterialized: boolean,
  championshipAssignmentsApplied: number,
  championshipWarnings: ChampionshipMaterializationWarning[],
): void {
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "PLANNED_SHOW_MATERIALIZED",
    significance: event.type === "MAJOR" ? "NOTABLE" : "ROUTINE",
    entityIds: [event.id, reservation.promotionId, reservation.marketId, reservation.venueId],
    payload: {
      reservationId: reservation.reservationId,
      sourceDraftId: reservation.sourceDraftId,
      cardMaterialized,
      championshipAssignmentsApplied,
      championshipWarnings: championshipWarnings.length,
    },
  });
}

function appendReservationExpiryLedger(
  state: WorldState,
  reservation: DetailedShowReservation,
  type: "PLANNED_SHOW_RESERVATION_EXPIRED" | "PLANNED_SHOW_RESERVATION_RELEASED_AT_LOCK",
  reasons: ReservationRiskReason[],
): void {
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type,
    significance: type === "PLANNED_SHOW_RESERVATION_RELEASED_AT_LOCK" ? "NOTABLE" : "ROUTINE",
    entityIds: [reservation.promotionId, reservation.marketId, reservation.venueId],
    payload: {
      reservationId: reservation.reservationId,
      sourceDraftId: reservation.sourceDraftId,
      targetDate: `${reservation.targetDate.year}-W${reservation.targetDate.week}-D${reservation.targetDate.day}`,
      reasons: reasons.join(","),
    },
  });
}

function materializeReadyReservation(
  state: WorldState,
  planning: WorldPlanningState,
  reservation: DetailedShowReservation,
): MaterializedShowReservation {
  const event = prepareHumanShow(state, {
    promotionId: reservation.promotionId,
    marketId: reservation.marketId,
    venueId: reservation.venueId,
    day: reservation.targetDate.day,
    ticketStrategy: reservation.ticketStrategy,
    participantIds: reservation.participants.map((participant) => participant.personId),
  });
  pinReservedContracts(state, event, reservation);
  const card = materializeCardIfComplete(state, planning, reservation, event);
  removeReservation(planning, reservation.reservationId);
  appendMaterializedLedger(
    state,
    reservation,
    event,
    card.matches.length > 0,
    card.championshipAssignmentsApplied,
    card.championshipWarnings,
  );
  return {
    reservationId: reservation.reservationId,
    sourceDraftId: reservation.sourceDraftId,
    promotionId: reservation.promotionId,
    eventId: event.id,
    cardMaterialized: card.matches.length > 0,
    matchIds: card.matches.map((match) => match.id),
    championshipAssignmentsApplied: card.championshipAssignmentsApplied,
    championshipWarnings: card.championshipWarnings,
  };
}

export function materializeCurrentWeekReservations(
  state: WorldState,
  planning: WorldPlanningState,
): ReservationMaterializationPass {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");
  const materialized: MaterializedShowReservation[] = [];
  const atRisk: ReservationAssessment[] = [];
  const expiredReservationIds: string[] = [];
  const ordered = [...planning.showReservations].sort((a, b) => (
    targetWeekIndex(state, a.targetDate) - targetWeekIndex(state, b.targetDate)
    || a.targetDate.day - b.targetDate.day
    || a.reservationId.localeCompare(b.reservationId)
  ));

  for (const reservation of ordered) {
    const assessment = assessDetailedShowReservation(state, planning, reservation);
    if (assessment.status === "EXPIRED") {
      removeReservation(planning, reservation.reservationId);
      appendReservationExpiryLedger(state, reservation, "PLANNED_SHOW_RESERVATION_EXPIRED", []);
      expiredReservationIds.push(reservation.reservationId);
      continue;
    }
    if (assessment.status === "NOT_DUE") continue;
    if (assessment.status === "AT_RISK") {
      atRisk.push(assessment);
      continue;
    }
    materialized.push(materializeReadyReservation(state, planning, reservation));
  }

  return { materialized, atRisk, expiredReservationIds };
}

export function closeCurrentWeekReservationsAtLock(
  state: WorldState,
  planning: WorldPlanningState,
): ReservationLockClosure {
  const pass = materializeCurrentWeekReservations(state, planning);
  const releasedAtRisk: ReservationAssessment[] = [];
  for (const reservation of [...planning.showReservations]) {
    if (!samePpwWeek(reservation.targetDate, state.world.currentDate)) continue;
    const assessment = assessDetailedShowReservation(state, planning, reservation);
    if (assessment.status !== "AT_RISK") continue;
    removeReservation(planning, reservation.reservationId);
    appendReservationExpiryLedger(
      state,
      reservation,
      "PLANNED_SHOW_RESERVATION_RELEASED_AT_LOCK",
      assessment.reasons,
    );
    releasedAtRisk.push(assessment);
  }
  return { ...pass, releasedAtRisk };
}

export function reservationAssessmentForDraft(
  state: WorldState,
  planning: WorldPlanningState,
  promotionId: Id,
  draftId: string,
): ReservationAssessment | null {
  const reservation = planning.showReservations.find(
    (candidate) => candidate.promotionId === promotionId && candidate.sourceDraftId === draftId,
  );
  return reservation ? assessDetailedShowReservation(state, planning, reservation) : null;
}

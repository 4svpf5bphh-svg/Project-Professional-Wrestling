import type {
  Contract,
  Id,
  Person,
  PpwDate,
  Promotion,
  WrestlingEventType,
  WorldState,
} from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { serviceCapacityDatesPerWeek } from "../../sim-core/src/contracts.js";
import {
  validateDetailedShowDraft,
  type DetailedShowReservation,
  type PromotionPlanningWorkspace,
  type ReservedShowParticipant,
  type WorldPlanningState,
} from "./planning.js";

function samePpwDate(a: PpwDate, b: PpwDate): boolean {
  return a.year === b.year && a.week === b.week && a.day === b.day;
}

function samePpwWeek(a: PpwDate, b: PpwDate): boolean {
  return a.year === b.year && a.week === b.week;
}

function reservationIdFor(promotionId: Id, draftId: string): string {
  return `show-reservation:${promotionId}:${draftId}`;
}

function targetEventType(state: WorldState, date: PpwDate): WrestlingEventType {
  const weekIndex = ppwDateToWeekIndex(date, state.ruleset.weeksPerYear);
  return (weekIndex + 1) % state.ruleset.majorEventIntervalWeeks === 0 ? "MAJOR" : "REGULAR";
}

function eventRosterTarget(promotion: Promotion, type: WrestlingEventType): number {
  const regular = promotion.tier === "GLOBAL"
    ? 16
    : promotion.tier === "NATIONAL"
      ? 14
      : promotion.tier === "RISING"
        ? 12
        : promotion.tier === "INDEPENDENT"
          ? 10
          : 8;
  return type === "MAJOR" ? regular + 2 : regular;
}

function promotionRunsAtDate(state: WorldState, promotion: Promotion, date: PpwDate): boolean {
  if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") return false;
  const weekIndex = ppwDateToWeekIndex(date, state.ruleset.weeksPerYear);
  return weekIndex % Math.max(1, promotion.eventCadenceWeeks) === 0;
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

function chooseFutureContract(
  state: WorldState,
  planning: WorldPlanningState,
  promotionId: Id,
  person: Person,
  date: PpwDate,
  excludingReservationId: string,
): Contract | null {
  const candidates = state.contracts
    .filter((contract) => (
      contract.personId === person.id
      && contract.promotionId === promotionId
      && contractCoversDate(state, contract, date)
    ))
    .map((contract) => {
      const alreadyCommitted = contract.datesUsed + scheduledContractDates(state, contract.id)
        + reservedContractDates(planning, contract.id, excludingReservationId);
      return { contract, remaining: contract.dateEntitlement - alreadyCommitted };
    })
    .filter((entry) => entry.remaining > 0)
    .sort((a, b) => a.remaining - b.remaining || a.contract.id.localeCompare(b.contract.id));
  return candidates[0]?.contract ?? null;
}

function requireWorkspace(
  planning: WorldPlanningState,
  promotionId: Id,
  expectedPlanVersion: number,
): PromotionPlanningWorkspace {
  if (!Number.isSafeInteger(expectedPlanVersion) || expectedPlanVersion < 0) {
    throw new Error("expected plan version is invalid");
  }
  const workspace = planning.workspaces.find((candidate) => candidate.promotionId === promotionId);
  if (!workspace) throw new Error(`promotion ${promotionId} has no planning workspace`);
  if (workspace.version !== expectedPlanVersion) {
    throw new Error(`stale plan version: expected ${expectedPlanVersion}, current ${workspace.version}`);
  }
  return workspace;
}

function validateScarceResources(
  state: WorldState,
  planning: WorldPlanningState,
  promotion: Promotion,
  reservationId: string,
  date: PpwDate,
  venueId: Id,
  participantIds: Id[],
): ReservedShowParticipant[] {
  if (state.events.some((event) => (
    event.status !== "CANCELLED"
    && event.venueId === venueId
    && samePpwDate(event.date, date)
  ))) {
    throw new Error("selected venue is already occupied on that PPW day");
  }
  if (planning.showReservations.some((reservation) => (
    reservation.reservationId !== reservationId
    && reservation.venueId === venueId
    && samePpwDate(reservation.targetDate, date)
  ))) {
    throw new Error("selected venue is already reserved on that PPW day");
  }
  if (planning.showReservations.some((reservation) => (
    reservation.reservationId !== reservationId
    && reservation.promotionId === promotion.id
    && samePpwWeek(reservation.targetDate, date)
  ))) {
    throw new Error("promotion already has a reserved show in that PPW week");
  }
  if (state.events.some((event) => (
    event.status !== "CANCELLED"
    && event.promotionId === promotion.id
    && samePpwWeek(event.date, date)
  ))) {
    throw new Error("promotion already has a committed show in that PPW week");
  }

  const selected: ReservedShowParticipant[] = [];
  for (const personId of participantIds) {
    const person = state.people.find((candidate) => candidate.id === personId);
    if (!person) throw new Error(`unknown wrestler ${personId}`);
    if (person.status !== "ACTIVE") throw new Error(`${person.name} is not currently available to reserve`);

    const alreadySameDay = state.scheduledAppearances.some((appearance) => (
      appearance.personId === personId
      && appearance.status !== "CANCELLED"
      && samePpwDate(appearance.date, date)
    )) || planning.showReservations.some((reservation) => (
      reservation.reservationId !== reservationId
      && samePpwDate(reservation.targetDate, date)
      && reservation.participants.some((participant) => participant.personId === personId)
    ));
    if (alreadySameDay) throw new Error(`${person.name} is already committed on that PPW day`);

    const capacity = Math.max(1, Math.floor(serviceCapacityDatesPerWeek(person)));
    const scheduledThisWeek = state.scheduledAppearances.filter((appearance) => (
      appearance.personId === personId
      && appearance.status !== "CANCELLED"
      && samePpwWeek(appearance.date, date)
    )).length;
    const reservedThisWeek = planning.showReservations.filter((reservation) => (
      reservation.reservationId !== reservationId && samePpwWeek(reservation.targetDate, date)
    )).reduce(
      (count, reservation) => count + (reservation.participants.some((participant) => participant.personId === personId) ? 1 : 0),
      0,
    );
    if (scheduledThisWeek + reservedThisWeek >= capacity) {
      throw new Error(`${person.name} has no Service Capacity remaining in that PPW week`);
    }

    const contract = chooseFutureContract(state, planning, promotion.id, person, date, reservationId);
    if (!contract) throw new Error(`${person.name} has no unreserved contract date covering the planned show`);
    selected.push({ personId, contractId: contract.id, serviceCapacityAtReservation: capacity });
  }
  return selected;
}

export function reservationForDraft(
  planning: WorldPlanningState,
  promotionId: Id,
  draftId: string,
): DetailedShowReservation | null {
  const reservation = planning.showReservations.find(
    (candidate) => candidate.promotionId === promotionId && candidate.sourceDraftId === draftId,
  );
  return reservation ? structuredClone(reservation) : null;
}

export function reserveDetailedShowDraft(
  state: WorldState,
  planning: WorldPlanningState,
  promotionId: Id,
  expectedPlanVersion: number,
  draftId: string,
): DetailedShowReservation {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion) throw new Error(`promotion ${promotionId} was not found`);
  const workspace = requireWorkspace(planning, promotionId, expectedPlanVersion);
  const sourceDraft = workspace.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
  if (!sourceDraft) throw new Error(`show draft ${draftId} was not found`);
  const draft = validateDetailedShowDraft(state, sourceDraft);

  if (!promotionRunsAtDate(state, promotion, draft.targetDate)) {
    throw new Error("promotion has no scheduled operating show in the draft target PPW week");
  }
  if (draft.marketId === null || draft.venueId === null || draft.ticketStrategy === null) {
    throw new Error("show draft needs market, venue and ticket strategy before reservation");
  }
  if (draft.participantIds.length < state.ruleset.minEventParticipants || draft.participantIds.length % 2 !== 0) {
    throw new Error(`reserved show roster must contain an even number of at least ${state.ruleset.minEventParticipants} wrestlers`);
  }
  const rosterTarget = eventRosterTarget(promotion, targetEventType(state, draft.targetDate));
  if (draft.participantIds.length > rosterTarget) {
    throw new Error(`reserved show roster exceeds event target of ${rosterTarget}`);
  }

  const reservationId = reservationIdFor(promotionId, draft.draftId);
  const participants = validateScarceResources(
    state,
    planning,
    promotion,
    reservationId,
    draft.targetDate,
    draft.venueId,
    draft.participantIds,
  );
  const reservation: DetailedShowReservation = {
    reservationId,
    sourceDraftId: draft.draftId,
    promotionId,
    targetDate: { ...draft.targetDate },
    marketId: draft.marketId,
    venueId: draft.venueId,
    ticketStrategy: draft.ticketStrategy,
    participants,
    reservedPlanVersion: workspace.version,
  };

  const existingIndex = planning.showReservations.findIndex((candidate) => candidate.reservationId === reservationId);
  if (existingIndex >= 0) planning.showReservations[existingIndex] = reservation;
  else planning.showReservations.push(reservation);
  planning.showReservations.sort((a, b) => {
    const aWeek = ppwDateToWeekIndex(a.targetDate, state.ruleset.weeksPerYear);
    const bWeek = ppwDateToWeekIndex(b.targetDate, state.ruleset.weeksPerYear);
    return aWeek - bWeek || a.targetDate.day - b.targetDate.day || a.reservationId.localeCompare(b.reservationId);
  });
  return structuredClone(reservation);
}

export function releaseDetailedShowReservation(
  planning: WorldPlanningState,
  promotionId: Id,
  draftId: string,
): DetailedShowReservation {
  const index = planning.showReservations.findIndex(
    (candidate) => candidate.promotionId === promotionId && candidate.sourceDraftId === draftId,
  );
  if (index < 0) throw new Error(`show draft ${draftId} has no active reservation`);
  const [released] = planning.showReservations.splice(index, 1);
  return structuredClone(released!);
}

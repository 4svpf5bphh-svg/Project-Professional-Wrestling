/**
 * Contract-specific booking evidence for the booker's own talent.
 *
 * This reads factual, completed World records. It deliberately does not
 * infer talent dissatisfaction, change scripted outcomes, or penalise a
 * limited-dates contract for not appearing on every promotion show.
 */
import type { Contract, Id, PpwDate, RoleExpectation, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { contractIsActive } from "../../sim-core/src/contracts.js";

export type TalentBookingPosition =
  | "MAIN_EVENT" | "UPPER_CARD" | "LOWER_CARD" | "SEGMENT_ONLY" | "APPEARANCE_ONLY";

export interface TalentCompletedBooking {
  eventId: Id;
  date: PpwDate;
  eventType: "REGULAR" | "MAJOR";
  /** Match positioning, or SEGMENT_ONLY if a wrestler appeared in an angle alone. */
  position: TalentBookingPosition;
  matchCount: number;
  segmentCount: number;
}

export interface TalentExpectationEvidence {
  contractId: Id;
  personId: Id;
  promotionId: Id;
  roleExpectation: RoleExpectation;
  observationWindowWeeks: number;
  completedPromotionShows: number;
  completedAppearanceShows: number;
  showsWithoutAppearance: number;
  inRingShows: number;
  segmentShows: number;
  mainEventShows: number;
  upperCardShows: number;
  lowerCardShows: number;
  appearanceOnlyShows: number;
  datesPurchased: number;
  datesUsed: number;
  datesRemaining: number;
  /** Historical facts, not a satisfaction or morale rating. Newest first. */
  recentBookings: TalentCompletedBooking[];
}

const DEFAULT_OBSERVATION_WEEKS = 12;
const MAX_OBSERVATION_WEEKS = 52;

function windowWeeks(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_OBSERVATION_WEEKS) {
    throw new Error("talent expectation window must contain between 1 and 52 weeks");
  }
  return value;
}

function inObservationWindow(
  date: PpwDate,
  contract: Contract,
  currentDate: PpwDate,
  weeksPerYear: number,
  firstWeek: number,
): boolean {
  const week = ppwDateToWeekIndex(date, weeksPerYear);
  return week >= firstWeek
    && comparePpwDates(date, contract.startDate, weeksPerYear) >= 0
    && comparePpwDates(date, contract.endDate, weeksPerYear) <= 0
    && comparePpwDates(date, currentDate, weeksPerYear) <= 0;
}

export function talentExpectationEvidenceForContract(
  state: WorldState,
  contractId: Id,
  observationWeeks = DEFAULT_OBSERVATION_WEEKS,
): TalentExpectationEvidence | null {
  const span = windowWeeks(observationWeeks);
  const contract = state.contracts.find((entry) => entry.id === contractId);
  if (!contract || !contractIsActive(state, contract)) return null;

  const weeksPerYear = state.ruleset.weeksPerYear;
  const firstWeek = ppwDateToWeekIndex(state.world.currentDate, weeksPerYear) - span + 1;
  const shows = state.events
    .filter((event) => event.promotionId === contract.promotionId
      && event.status === "COMPLETED"
      && inObservationWindow(event.date, contract, state.world.currentDate, weeksPerYear, firstWeek))
    .sort((left, right) => comparePpwDates(right.date, left.date, weeksPerYear)
      || right.id.localeCompare(left.id));
  const showIds = new Set(shows.map((event) => event.id));
  const appearances = new Set(state.scheduledAppearances
    .filter((appearance) => appearance.contractId === contract.id
      && appearance.personId === contract.personId
      && appearance.promotionId === contract.promotionId
      && appearance.status === "COMPLETED"
      && showIds.has(appearance.eventId))
    .map((appearance) => appearance.eventId));

  const matchesByShow = new Map<Id, WorldState["matches"]>();
  for (const match of state.matches) {
    if (!showIds.has(match.eventId) || match.status !== "COMPLETED") continue;
    const matches = matchesByShow.get(match.eventId) ?? [];
    matches.push(match);
    matchesByShow.set(match.eventId, matches);
  }
  const ownMatchIds = new Set(state.matchParticipants
    .filter((participant) => participant.personId === contract.personId && showIds.has(participant.eventId))
    .map((participant) => participant.matchId));

  const segmentCounts = new Map<Id, number>();
  for (const entry of state.ledger) {
    if (entry.type !== "SHOW_SEGMENT_COMPLETED") continue;
    const eventId = entry.payload.eventId;
    if (typeof eventId !== "string" || !showIds.has(eventId)) continue;
    if (entry.payload.promotionId !== contract.promotionId) continue;
    const people = entry.payload.participantIds;
    if (typeof people !== "string" || !people.split(",").includes(contract.personId)) continue;
    segmentCounts.set(eventId, (segmentCounts.get(eventId) ?? 0) + 1);
  }

  const bookings: TalentCompletedBooking[] = [];
  for (const show of shows) {
    if (!appearances.has(show.id)) continue;
    const card = (matchesByShow.get(show.id) ?? [])
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    const performed = card.filter((match) => ownMatchIds.has(match.id));
    let position: TalentBookingPosition;
    if (performed.length === 0) {
      position = (segmentCounts.get(show.id) ?? 0) > 0 ? "SEGMENT_ONLY" : "APPEARANCE_ONLY";
    } else {
      const bestIndex = Math.max(...performed.map((match) => card.indexOf(match)));
      position = bestIndex === card.length - 1 ? "MAIN_EVENT"
        : bestIndex >= Math.floor(card.length / 2) ? "UPPER_CARD" : "LOWER_CARD";
    }
    bookings.push({
      eventId: show.id,
      date: { ...show.date },
      eventType: show.type,
      position,
      matchCount: performed.length,
      segmentCount: segmentCounts.get(show.id) ?? 0,
    });
  }

  return {
    contractId: contract.id,
    personId: contract.personId,
    promotionId: contract.promotionId,
    roleExpectation: contract.roleExpectation,
    observationWindowWeeks: span,
    completedPromotionShows: shows.length,
    completedAppearanceShows: bookings.length,
    showsWithoutAppearance: shows.length - bookings.length,
    inRingShows: bookings.filter((booking) => booking.matchCount > 0).length,
    segmentShows: bookings.filter((booking) => booking.segmentCount > 0).length,
    mainEventShows: bookings.filter((booking) => booking.position === "MAIN_EVENT").length,
    upperCardShows: bookings.filter((booking) => booking.position === "UPPER_CARD").length,
    lowerCardShows: bookings.filter((booking) => booking.position === "LOWER_CARD").length,
    appearanceOnlyShows: bookings.filter((booking) => booking.position === "APPEARANCE_ONLY").length,
    datesPurchased: contract.dateEntitlement,
    datesUsed: contract.datesUsed,
    datesRemaining: Math.max(0, contract.dateEntitlement - contract.datesUsed),
    recentBookings: bookings.slice(0, 8),
  };
}

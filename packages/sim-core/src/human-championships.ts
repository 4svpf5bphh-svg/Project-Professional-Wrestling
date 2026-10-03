import type {
  Championship,
  ChampionshipMatchBooking,
  ChampionshipReign,
  Match,
  MatchParticipant,
  WorldState,
} from "../../domain/src/types.js";
import { activeTeamMemberIds, ensureWorldChampionships } from "./competition.js";
import { LedgerWriter } from "./ledger.js";

const BOOKING_EVENT_TYPE = "HUMAN_CHAMPIONSHIP_MATCH_BOOKED";
const UNBOOKING_EVENT_TYPE = "HUMAN_CHAMPIONSHIP_MATCH_UNBOOKED";

function activeReign(state: WorldState, championship: Championship): ChampionshipReign | null {
  if (!championship.currentReignId) return null;
  return state.championshipReigns?.find(
    (reign) => reign.id === championship.currentReignId && reign.status === "ACTIVE",
  ) ?? null;
}

function participantsForMatch(state: WorldState, matchId: string): MatchParticipant[] {
  return state.matchParticipants.filter((participant) => participant.matchId === matchId);
}

function sideIds(participants: MatchParticipant[], side: "A" | "B"): string[] {
  return participants
    .filter((participant) => participant.side === side)
    .map((participant) => participant.personId)
    .sort();
}

function reigningHolderIsInMatch(
  state: WorldState,
  championship: Championship,
  match: Match,
  participants: MatchParticipant[],
): boolean {
  const reign = activeReign(state, championship);
  if (!reign) return true;
  if (reign.holderType === "PERSON") {
    return participants.some((participant) => participant.personId === reign.holderId);
  }
  if (match.type !== "TAG") return false;
  const members = activeTeamMemberIds(state, reign.holderId).sort();
  if (members.length !== 2) return false;
  return (["A", "B"] as const).some((side) => sideIds(participants, side).join(":") === members.join(":"));
}

function championshipBookings(state: WorldState): ChampionshipMatchBooking[] {
  if (!state.championshipMatchBookings) state.championshipMatchBookings = [];
  return state.championshipMatchBookings;
}

function existingHumanTitleBookings(state: WorldState, eventId: string): ChampionshipMatchBooking[] {
  return championshipBookings(state).filter((booking) => booking.eventId === eventId);
}

export function bookHumanChampionshipMatch(
  state: WorldState,
  eventId: string,
  matchId: string,
  championshipId: string,
): void {
  ensureWorldChampionships(state);

  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`unknown event ${eventId}`);
  if (event.status !== "SCHEDULED") throw new Error("title match can only be booked for a scheduled event");

  const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN") {
    throw new Error("manual championship booking requires a human-controlled promotion");
  }

  const match = state.matches.find((candidate) => candidate.id === matchId && candidate.eventId === event.id);
  if (!match) throw new Error(`match ${matchId} does not belong to event ${eventId}`);
  if (match.status !== "SCHEDULED") throw new Error("title designation requires a scheduled match");

  const championship = state.championships?.find((candidate) => candidate.id === championshipId);
  if (!championship) throw new Error(`unknown championship ${championshipId}`);
  if (championship.promotionId !== promotion.id) throw new Error("cannot book another promotion's championship");
  if (championship.status !== "ACTIVE") throw new Error("inactive championship cannot be booked");

  const requiredType = championship.division === "SINGLES" ? "SINGLES" : "TAG";
  if (match.type !== requiredType) {
    throw new Error(`${championship.division.toLowerCase()} championship requires a ${requiredType.toLowerCase()} match`);
  }

  const bookings = existingHumanTitleBookings(state, event.id);
  if (bookings.some((booking) => booking.matchId === match.id)) {
    throw new Error("match is already assigned to a championship");
  }
  if (bookings.some((booking) => booking.championshipId === championship.id)) {
    throw new Error("championship is already assigned to another match on this event");
  }

  const participants = participantsForMatch(state, match.id);
  if (!reigningHolderIsInMatch(state, championship, match, participants)) {
    throw new Error("reigning champion must participate in a championship defense");
  }

  championshipBookings(state).push({
    worldId: state.world.id,
    promotionId: promotion.id,
    eventId: event.id,
    matchId: match.id,
    championshipId: championship.id,
  });

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: BOOKING_EVENT_TYPE,
    significance: "NOTABLE",
    entityIds: [championship.id, match.id, event.id, promotion.id],
    payload: {
      championshipId: championship.id,
      championshipName: championship.name,
      division: championship.division,
      eventId: event.id,
      matchId: match.id,
    },
  });
}

export function unbookHumanChampionshipMatch(
  state: WorldState,
  eventId: string,
  championshipId: string,
): void {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`unknown event ${eventId}`);
  if (event.status !== "SCHEDULED") throw new Error("title match can only be unbooked before the event resolves");

  const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN") {
    throw new Error("manual championship unbooking requires a human-controlled promotion");
  }

  const bookings = championshipBookings(state);
  const index = bookings.findIndex(
    (booking) => booking.eventId === event.id && booking.championshipId === championshipId,
  );
  if (index < 0) throw new Error("championship is not currently booked on this event");

  const [removed] = bookings.splice(index, 1);
  const championship = state.championships?.find((candidate) => candidate.id === championshipId);

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: UNBOOKING_EVENT_TYPE,
    significance: "ROUTINE",
    entityIds: [championshipId, removed!.matchId, event.id, promotion.id],
    payload: {
      championshipId,
      championshipName: championship?.name ?? championshipId,
      eventId: event.id,
      matchId: removed!.matchId,
    },
  });
}

export function humanBookedChampionshipMatchId(
  state: WorldState,
  eventId: string,
  championshipId: string,
): string | null {
  const booking = state.championshipMatchBookings?.find(
    (candidate) => candidate.eventId === eventId && candidate.championshipId === championshipId,
  );
  return booking?.matchId ?? null;
}

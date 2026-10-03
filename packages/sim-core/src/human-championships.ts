import type {
  Championship,
  ChampionshipReign,
  Match,
  MatchParticipant,
  WorldState,
} from "../../domain/src/types.js";
import { activeTeamMemberIds, ensureWorldChampionships } from "./competition.js";
import { LedgerWriter } from "./ledger.js";

const BOOKING_EVENT_TYPE = "HUMAN_CHAMPIONSHIP_MATCH_BOOKED";

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

function existingHumanTitleBookings(state: WorldState, eventId: string) {
  return state.ledger.filter(
    (entry) => entry.type === BOOKING_EVENT_TYPE && entry.payload.eventId === eventId,
  );
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
  if (bookings.some((entry) => entry.payload.matchId === match.id)) {
    throw new Error("match is already assigned to a championship");
  }
  if (bookings.some((entry) => entry.payload.championshipId === championship.id)) {
    throw new Error("championship is already assigned to another match on this event");
  }

  const participants = participantsForMatch(state, match.id);
  if (!reigningHolderIsInMatch(state, championship, match, participants)) {
    throw new Error("reigning champion must participate in a championship defense");
  }

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

export function humanBookedChampionshipMatchId(
  state: WorldState,
  eventId: string,
  championshipId: string,
): string | null {
  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.type !== BOOKING_EVENT_TYPE) continue;
    if (entry.payload.eventId !== eventId || entry.payload.championshipId !== championshipId) continue;
    return typeof entry.payload.matchId === "string" ? entry.payload.matchId : null;
  }
  return null;
}

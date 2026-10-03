import type {
  Match,
  MatchIntent,
  MatchParticipant,
  MatchSide,
  MatchType,
  WorldState,
} from "../../domain/src/types.js";
import { LedgerWriter } from "./ledger.js";

export interface HumanMatchPlan {
  type: MatchType;
  sideAIds: string[];
  sideBIds: string[];
  intendedWinnerSide: MatchSide;
  intent: MatchIntent;
  plannedLengthMinutes: number;
}

function validateSideSize(type: MatchType, sideAIds: string[], sideBIds: string[]): void {
  const expected = type === "SINGLES" ? 1 : 2;
  if (sideAIds.length !== expected || sideBIds.length !== expected) {
    throw new Error(`${type.toLowerCase()} match requires ${expected} wrestler(s) per side`);
  }
}

export function prepareHumanMatchCard(
  state: WorldState,
  eventId: string,
  plans: HumanMatchPlan[],
): Match[] {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`unknown event ${eventId}`);
  if (event.status !== "SCHEDULED") throw new Error("match card can only be prepared for a scheduled event");

  const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN") {
    throw new Error("manual match-card booking requires a human-controlled promotion");
  }
  if (plans.length === 0) throw new Error("match card requires at least one match");
  if (state.matches.some((match) => match.eventId === event.id)) {
    throw new Error("event already has a match card");
  }

  const committedIds = new Set(
    state.scheduledAppearances
      .filter((appearance) => appearance.eventId === event.id && appearance.status === "COMMITTED")
      .map((appearance) => appearance.personId),
  );
  if (committedIds.size < state.ruleset.minEventParticipants) {
    throw new Error("event does not have enough committed wrestlers to build a legal card");
  }

  const used = new Set<string>();
  for (const plan of plans) {
    validateSideSize(plan.type, plan.sideAIds, plan.sideBIds);
    if (!Number.isInteger(plan.plannedLengthMinutes) || plan.plannedLengthMinutes < 3 || plan.plannedLengthMinutes > 60) {
      throw new Error("planned match length must be an integer from 3 to 60 minutes");
    }
    const ids = [...plan.sideAIds, ...plan.sideBIds];
    for (const personId of ids) {
      if (!committedIds.has(personId)) throw new Error(`wrestler ${personId} is not committed to this event`);
      if (used.has(personId)) throw new Error(`wrestler ${personId} is booked more than once on the card`);
      const person = state.people.find((candidate) => candidate.id === personId);
      if (!person || person.status !== "ACTIVE") throw new Error(`wrestler ${personId} is not currently available`);
      used.add(personId);
    }
  }

  if (used.size !== committedIds.size || [...committedIds].some((personId) => !used.has(personId))) {
    throw new Error("manual card must use every wrestler committed to the show exactly once");
  }

  const matches: Match[] = [];
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!;
    const match: Match = {
      id: `match-${String(state.matches.length + 1).padStart(8, "0")}`,
      worldId: state.world.id,
      eventId: event.id,
      promotionId: promotion.id,
      order: index + 1,
      type: plan.type,
      status: "SCHEDULED",
      intent: plan.intent,
      plannedLengthMinutes: plan.plannedLengthMinutes,
      actualLengthMinutes: 0,
      intendedWinnerSide: plan.intendedWinnerSide,
      actualWinnerSide: null,
      finishChangedDueToInjury: false,
      executionQuality: 0,
      criticalRatingStars: 0,
      crowdResponse: 0,
    };
    state.matches.push(match);
    matches.push(match);

    for (const [side, ids] of [["A", plan.sideAIds], ["B", plan.sideBIds]] as const) {
      for (const personId of ids) {
        const participant: MatchParticipant = {
          id: `match-participant-${String(state.matchParticipants.length + 1).padStart(9, "0")}`,
          worldId: state.world.id,
          matchId: match.id,
          eventId: event.id,
          personId,
          side,
          won: false,
        };
        state.matchParticipants.push(participant);
      }
    }
  }

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "HUMAN_MATCH_CARD_PREPARED",
    significance: event.type === "MAJOR" ? "NOTABLE" : "ROUTINE",
    entityIds: [event.id, promotion.id, ...matches.map((match) => match.id)],
    payload: {
      matches: matches.length,
      wrestlers: used.size,
      mainEventMatchId: matches[matches.length - 1]!.id,
    },
  });

  return matches;
}

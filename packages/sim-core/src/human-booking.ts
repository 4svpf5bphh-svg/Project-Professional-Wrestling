import type {
  Match,
  MatchIntent,
  MatchStyleProfile,
  MatchParticipant,
  MatchSide,
  MatchType,
  WorldState,
} from "../../domain/src/types.js";
import { nextEntityId } from "./id-allocator.js";
import { LedgerWriter } from "./ledger.js";
import { normalizeMatchStyle } from "./match-style.js";
import { requireSameWrestlerDivision } from "./wrestler-division.js";
import {
  defaultPlannedFinishForIntent,
  isBookableMatchFinish,
  setPlannedMatchFinish,
  type MatchFinish,
} from "./match-finishes.js";

export interface HumanMatchPlan {
  type: MatchType;
  sideAIds: string[];
  sideBIds: string[];
  intendedWinnerSide: MatchSide;
  intent: MatchIntent;
  style?: MatchStyleProfile;
  plannedLengthMinutes: number;
  plannedFinish?: MatchFinish;
  interfererPersonId?: string | null;
  interferenceSide?: MatchSide | null;
  interferenceOutcome?: "SUCCESS" | "THWARTED" | null;
}

function validateSideSize(type: MatchType, sideAIds: string[], sideBIds: string[]): void {
  const expected = type === "SINGLES" ? 1 : 2;
  if (sideAIds.length !== expected || sideBIds.length !== expected) {
    throw new Error(`${type.toLowerCase()} match requires ${expected} wrestler(s) per side`);
  }
}

export function clearHumanMatchCard(state: WorldState, eventId: string): number {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`unknown event ${eventId}`);
  if (event.status !== "SCHEDULED") throw new Error("match card can only be cleared for a scheduled event");

  const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN") {
    throw new Error("manual match-card clearing requires a human-controlled promotion");
  }

  const eventMatches = state.matches.filter((match) => match.eventId === event.id);
  if (eventMatches.some((match) => match.status !== "SCHEDULED")) {
    throw new Error("resolved or cancelled matches cannot be replaced");
  }
  if ((state.championshipMatchBookings ?? []).some((booking) => booking.eventId === event.id)) {
    throw new Error("championship designations must be unbooked before replacing the card");
  }

  const matchIds = new Set(eventMatches.map((match) => match.id));
  for (let index = state.matchParticipants.length - 1; index >= 0; index -= 1) {
    if (matchIds.has(state.matchParticipants[index]!.matchId)) state.matchParticipants.splice(index, 1);
  }
  for (let index = state.matches.length - 1; index >= 0; index -= 1) {
    if (matchIds.has(state.matches[index]!.id)) state.matches.splice(index, 1);
  }
  return eventMatches.length;
}

export function prepareHumanMatchCard(
  state: WorldState,
  eventId: string,
  plans: HumanMatchPlan[],
  options: { allowSegmentOnlyCommitted?: boolean } = {},
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
  const runInWrestlers = new Set<string>();
  for (const plan of plans) {
    validateSideSize(plan.type, plan.sideAIds, plan.sideBIds);
    if (!Number.isInteger(plan.plannedLengthMinutes) || plan.plannedLengthMinutes < 3 || plan.plannedLengthMinutes > 60) {
      throw new Error("planned match length must be an integer from 3 to 60 minutes");
    }
    if (plan.plannedFinish !== undefined && !isBookableMatchFinish(plan.plannedFinish)) {
      throw new Error("planned match finish must be clean, submission, flash, protected, DQ or foreign-object");
    }
    if (plan.style !== undefined) normalizeMatchStyle(plan.style);
    const ids = [...plan.sideAIds, ...plan.sideBIds];
    const interfererId = plan.interfererPersonId ?? null;
    const aidedSide = plan.interferenceSide ?? null;
    const scriptedOutcome = interfererId ? (plan.interferenceOutcome ?? "SUCCESS") : null;
    if (scriptedOutcome === "SUCCESS"
        && (plan.plannedFinish === "DISQUALIFICATION" || plan.plannedFinish === "FOREIGN_OBJECT")) {
      throw new Error("DQ and foreign-object finishes cannot also book a successful run-in");
    }
    if ((interfererId === null) !== (aidedSide === null) || (aidedSide !== null && aidedSide !== "A" && aidedSide !== "B")) {
      throw new Error("run-in requires an outside wrestler and an aided side");
    }
    if (scriptedOutcome !== null && scriptedOutcome !== "SUCCESS" && scriptedOutcome !== "THWARTED") {
      throw new Error("run-in outcome must be successful or thwarted");
    }
    if (scriptedOutcome === "SUCCESS" && aidedSide !== plan.intendedWinnerSide) {
      throw new Error("successful run-in must aid the booked winning side");
    }
    if (interfererId !== null) {
      if (ids.includes(interfererId)) throw new Error("run-in wrestler cannot compete in the same match");
      if (!committedIds.has(interfererId)) throw new Error("run-in wrestler must be committed to this event");
      const interferencePerson = state.people.find((person) => person.id === interfererId);
      if (!interferencePerson || interferencePerson.status !== "ACTIVE") throw new Error("run-in wrestler is unavailable");
      runInWrestlers.add(interfererId);
    }
    const people = ids.map((personId) => state.people.find((candidate) => candidate.id === personId));
    if (people.some((person) => !person)) throw new Error("match references a missing wrestler");
    requireSameWrestlerDivision(
      people as NonNullable<(typeof people)[number]>[],
      "manual matches cannot mix men's and women's divisions",
    );
    for (const personId of ids) {
      if (!committedIds.has(personId)) throw new Error(`wrestler ${personId} is not committed to this event`);
      if (used.has(personId)) throw new Error(`wrestler ${personId} is booked more than once on the card`);
      const person = state.people.find((candidate) => candidate.id === personId);
      if (!person || person.status !== "ACTIVE") throw new Error(`wrestler ${personId} is not currently available`);
      used.add(personId);
    }
  }

  const usedAnywhere = new Set([...used, ...runInWrestlers]);
  if (
    !options.allowSegmentOnlyCommitted
    && (usedAnywhere.size !== committedIds.size || [...committedIds].some((personId) => !usedAnywhere.has(personId)))
  ) {
    throw new Error("manual card must use every wrestler committed to the show exactly once");
  }

  const matches: Match[] = [];
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!;
    const match: Match = {
      id: nextEntityId(state, "match"),
      worldId: state.world.id,
      eventId: event.id,
      promotionId: promotion.id,
      order: index + 1,
      type: plan.type,
      status: "SCHEDULED",
      intent: plan.intent,
      ...(plan.style === undefined ? {} : { style: normalizeMatchStyle(plan.style) }),
      plannedLengthMinutes: plan.plannedLengthMinutes,
      actualLengthMinutes: 0,
      intendedWinnerSide: plan.intendedWinnerSide,
      actualWinnerSide: null,
      finishChangedDueToInjury: false,
      ...(plan.interfererPersonId && plan.interferenceSide
        ? { interference: { personId: plan.interfererPersonId, aidedSide: plan.interferenceSide,
            plannedOutcome: plan.interferenceOutcome ?? "SUCCESS", outcome: null } } : {}),
      executionQuality: 0,
      criticalRatingStars: 0,
      crowdResponse: 0,
    };
    setPlannedMatchFinish(match, plan.plannedFinish ?? defaultPlannedFinishForIntent(plan.intent));
    state.matches.push(match);
    matches.push(match);

    for (const [side, ids] of [["A", plan.sideAIds], ["B", plan.sideBIds]] as const) {
      for (const personId of ids) {
        const participant: MatchParticipant = {
          id: nextEntityId(state, "matchParticipant"),
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
      wrestlers: usedAnywhere.size,
      mainEventMatchId: matches[matches.length - 1]!.id,
    },
  });

  return matches;
}

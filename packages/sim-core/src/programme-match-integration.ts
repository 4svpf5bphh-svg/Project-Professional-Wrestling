import type {
  Match,
  MatchParticipant,
  MatchSide,
  WorldState,
  WrestlingEvent,
} from "../../domain/src/types.js";
import type { Programme, ProgrammeParticipantRef } from "../../domain/src/programmes.js";
import { activeProgrammesForPromotion, recordProgrammeActivity } from "./programmes.js";

function sameWeek(left: { year: number; week: number }, right: { year: number; week: number }): boolean {
  return left.year === right.year && left.week === right.week;
}

function personIdsForRef(state: WorldState, ref: ProgrammeParticipantRef): Set<string> {
  if (ref.kind === "PERSON") return new Set([ref.entityId]);
  return new Set(
    (state.teamMemberships ?? [])
      .filter((membership) => membership.teamId === ref.entityId && membership.active)
      .map((membership) => membership.personId),
  );
}

function personIdsForProgrammeSide(state: WorldState, refs: ProgrammeParticipantRef[]): Set<string> {
  const ids = new Set<string>();
  for (const ref of refs) {
    for (const personId of personIdsForRef(state, ref)) ids.add(personId);
  }
  return ids;
}

function isSubset(candidate: Set<string>, allowed: Set<string>): boolean {
  return candidate.size > 0 && [...candidate].every((personId) => allowed.has(personId));
}

function participantEntityIdsForMatch(
  state: WorldState,
  programme: Programme,
  matchPersonIds: Set<string>,
): string[] {
  const result: string[] = [];
  for (const ref of [...programme.sideA, ...programme.sideB]) {
    const represented = [...personIdsForRef(state, ref)].some((personId) => matchPersonIds.has(personId));
    if (represented) result.push(ref.entityId);
  }
  return result;
}

function programmeWinnerSide(matchWinnerSide: MatchSide | null, reversed: boolean): MatchSide | null {
  if (matchWinnerSide === null) return null;
  if (!reversed) return matchWinnerSide;
  return matchWinnerSide === "A" ? "B" : "A";
}

function matchFitsProgramme(
  state: WorldState,
  programme: Programme,
  sideAIds: Set<string>,
  sideBIds: Set<string>,
): { matches: boolean; reversed: boolean } {
  const programmeAIds = personIdsForProgrammeSide(state, programme.sideA);
  const programmeBIds = personIdsForProgrammeSide(state, programme.sideB);
  const sameOrientation = isSubset(sideAIds, programmeAIds) && isSubset(sideBIds, programmeBIds);
  const reversedOrientation = isSubset(sideAIds, programmeBIds) && isSubset(sideBIds, programmeAIds);

  // If both orientations fit, the Programme itself is semantically ambiguous (for example,
  // overlapping team/member references across sides). Do not invent a story assignment.
  if (sameOrientation === reversedOrientation) return { matches: false, reversed: false };
  return { matches: true, reversed: reversedOrientation };
}

function recordMatchAgainstActiveProgrammes(
  state: WorldState,
  event: WrestlingEvent,
  match: Match,
  participants: MatchParticipant[],
): number {
  if (match.status !== "COMPLETED" || match.eventId !== event.id || match.promotionId !== event.promotionId) return 0;

  const sideAIds = new Set(participants.filter((participant) => participant.side === "A").map((participant) => participant.personId));
  const sideBIds = new Set(participants.filter((participant) => participant.side === "B").map((participant) => participant.personId));
  if (sideAIds.size === 0 || sideBIds.size === 0) return 0;
  const matchPersonIds = new Set([...sideAIds, ...sideBIds]);

  let recorded = 0;
  for (const programme of activeProgrammesForPromotion(state, event.promotionId)) {
    const fit = matchFitsProgramme(state, programme, sideAIds, sideBIds);
    if (!fit.matches) continue;
    const alreadyRecorded = (state.programmeActivities ?? []).some((activity) => (
      activity.programmeId === programme.id
      && activity.kind === "MATCH"
      && activity.matchId === match.id
    ));
    if (alreadyRecorded) continue;

    const participantEntityIds = participantEntityIdsForMatch(state, programme, matchPersonIds);
    if (participantEntityIds.length < 2) continue;

    recordProgrammeActivity(state, {
      programmeId: programme.id,
      kind: "MATCH",
      date: event.date,
      participantEntityIds,
      eventId: event.id,
      matchId: match.id,
      winnerSide: programmeWinnerSide(match.actualWinnerSide, fit.reversed),
    });
    recorded += 1;
  }
  return recorded;
}

/**
 * Adds factual Programme history for completed matches from the PPW week that is
 * currently resolving. Heat/repetition are deliberately not changed here.
 */
export function recordCurrentWeekProgrammeMatches(state: WorldState): number {
  if (!(state.programmes ?? []).some((programme) => programme.status === "ACTIVE")) return 0;

  const currentEvents = new Map<string, WrestlingEvent>();
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index]!;
    if (!sameWeek(event.date, state.world.currentDate)) {
      if (event.date.year < state.world.currentDate.year || (
        event.date.year === state.world.currentDate.year && event.date.week < state.world.currentDate.week
      )) break;
      continue;
    }
    if (event.status === "COMPLETED") currentEvents.set(event.id, event);
  }
  if (currentEvents.size === 0) return 0;

  const currentMatches: Match[] = [];
  let sawCurrentMatch = false;
  for (let index = state.matches.length - 1; index >= 0; index -= 1) {
    const match = state.matches[index]!;
    if (currentEvents.has(match.eventId)) {
      sawCurrentMatch = true;
      if (match.status === "COMPLETED") currentMatches.push(match);
      continue;
    }
    if (sawCurrentMatch) break;
  }
  if (currentMatches.length === 0) return 0;

  const currentMatchIds = new Set(currentMatches.map((match) => match.id));
  const participantsByMatch = new Map<string, MatchParticipant[]>();
  let sawCurrentParticipant = false;
  for (let index = state.matchParticipants.length - 1; index >= 0; index -= 1) {
    const participant = state.matchParticipants[index]!;
    if (currentMatchIds.has(participant.matchId)) {
      sawCurrentParticipant = true;
      const list = participantsByMatch.get(participant.matchId) ?? [];
      list.push(participant);
      participantsByMatch.set(participant.matchId, list);
      continue;
    }
    if (sawCurrentParticipant) break;
  }

  let recorded = 0;
  for (const match of currentMatches.reverse()) {
    const event = currentEvents.get(match.eventId);
    if (!event) continue;
    recorded += recordMatchAgainstActiveProgrammes(
      state,
      event,
      match,
      participantsByMatch.get(match.id) ?? [],
    );
  }
  return recorded;
}

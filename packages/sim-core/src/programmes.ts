import type { PpwDate, WorldState } from "../../domain/src/types.js";
import type {
  Programme,
  ProgrammeActivity,
  ProgrammeActivityKind,
  ProgrammeParticipantRef,
  ProgrammeSide,
} from "../../domain/src/programmes.js";
import { comparePpwDates } from "./clock.js";
import { currentRosterPersonIds } from "./contracts.js";
import { nextEntityId } from "./id-allocator.js";
import { LedgerWriter } from "./ledger.js";

export interface CreateProgrammeInput {
  promotionId: string;
  sideA: ProgrammeParticipantRef[];
  sideB: ProgrammeParticipantRef[];
  championshipId?: string | null;
}

export interface RecordProgrammeActivityInput {
  programmeId: string;
  kind: ProgrammeActivityKind;
  date?: PpwDate;
  participantEntityIds?: string[];
  eventId?: string | null;
  matchId?: string | null;
  winnerSide?: ProgrammeSide | null;
}

function dateCopy(date: PpwDate): PpwDate {
  return { year: date.year, week: date.week, day: date.day };
}

function refsSignature(refs: ProgrammeParticipantRef[]): string {
  return refs
    .map((ref) => `${ref.kind}:${ref.entityId}`)
    .sort()
    .join("|");
}

function programmeSignature(sideA: ProgrammeParticipantRef[], sideB: ProgrammeParticipantRef[]): string {
  const a = refsSignature(sideA);
  const b = refsSignature(sideB);
  return a < b ? `${a}<>${b}` : `${b}<>${a}`;
}

function programmeCollections(state: WorldState): {
  programmes: Programme[];
  activities: ProgrammeActivity[];
} {
  state.programmes ??= [];
  state.programmeActivities ??= [];
  return { programmes: state.programmes, activities: state.programmeActivities };
}

function participantExists(state: WorldState, ref: ProgrammeParticipantRef): boolean {
  if (ref.kind === "PERSON") {
    const person = state.people.find((candidate) => candidate.id === ref.entityId);
    return Boolean(person && person.status !== "RETIRED");
  }
  const team = (state.teams ?? []).find((candidate) => candidate.id === ref.entityId);
  return Boolean(team && team.status === "ACTIVE");
}

function participantBelongsToPromotion(
  state: WorldState,
  promotionId: string,
  ref: ProgrammeParticipantRef,
  rosterPersonIds: Set<string>,
): boolean {
  if (ref.kind === "PERSON") return rosterPersonIds.has(ref.entityId);
  const activeMembers = (state.teamMemberships ?? [])
    .filter((membership) => membership.teamId === ref.entityId && membership.active)
    .map((membership) => membership.personId);
  return activeMembers.length >= 2 && activeMembers.every((personId) => rosterPersonIds.has(personId));
}

function participantPersonIds(
  state: WorldState,
  ref: ProgrammeParticipantRef,
): string[] {
  if (ref.kind === "PERSON") return [ref.entityId];
  return (state.teamMemberships ?? [])
    .filter((membership) => membership.teamId === ref.entityId && membership.active)
    .map((membership) => membership.personId);
}

function validateSides(
  state: WorldState,
  promotionId: string,
  sideA: ProgrammeParticipantRef[],
  sideB: ProgrammeParticipantRef[],
): void {
  if (sideA.length < 1 || sideB.length < 1) throw new Error("Programme requires at least one participant on each side");
  if (sideA.length > 2 || sideB.length > 2 || sideA.length + sideB.length > 4) {
    throw new Error("Programme supports two to four wrestlers or teams across two sides");
  }

  const seen = new Set<string>();
  const seenPeople = new Set<string>();
  const rosterPersonIds = new Set(currentRosterPersonIds(state, promotionId));
  for (const ref of [...sideA, ...sideB]) {
    const key = `${ref.kind}:${ref.entityId}`;
    if (seen.has(key)) throw new Error("Programme cannot include the same wrestler or team twice");
    seen.add(key);
    if (!participantExists(state, ref)) throw new Error(`Programme participant ${ref.entityId} is not available in this World`);
    if (!participantBelongsToPromotion(state, promotionId, ref, rosterPersonIds)) {
      throw new Error(`Programme participant ${ref.entityId} is not on this promotion's current roster`);
    }
    for (const personId of participantPersonIds(state, ref)) {
      if (seenPeople.has(personId)) {
        throw new Error("Programme cannot include the same wrestler through multiple participant selections");
      }
      seenPeople.add(personId);
    }
  }
}

function validateChampionship(state: WorldState, promotionId: string, championshipId: string | null): void {
  if (!championshipId) return;
  const championship = (state.championships ?? []).find((candidate) => candidate.id === championshipId);
  if (!championship || championship.status !== "ACTIVE") throw new Error("Programme championship must be active");
  if (championship.promotionId !== promotionId) throw new Error("Programme championship belongs to another promotion");
}

export function activeProgrammesForPromotion(state: WorldState, promotionId: string): Programme[] {
  return (state.programmes ?? []).filter((programme) => programme.promotionId === promotionId && programme.status === "ACTIVE");
}

export function programmeActivities(state: WorldState, programmeId: string): ProgrammeActivity[] {
  return (state.programmeActivities ?? [])
    .filter((activity) => activity.programmeId === programmeId)
    .sort((left, right) => comparePpwDates(left.date, right.date, state.ruleset.weeksPerYear));
}

export function createProgramme(state: WorldState, input: CreateProgrammeInput): Programme {
  const promotion = state.promotions.find((candidate) => candidate.id === input.promotionId);
  if (!promotion) throw new Error(`promotion ${input.promotionId} was not found`);
  if (promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") {
    throw new Error("inactive promotion cannot start a Programme");
  }

  validateSides(state, promotion.id, input.sideA, input.sideB);
  const championshipId = input.championshipId ?? null;
  validateChampionship(state, promotion.id, championshipId);

  const { programmes } = programmeCollections(state);
  const signature = programmeSignature(input.sideA, input.sideB);
  const duplicate = programmes.find((programme) => (
    programme.promotionId === promotion.id
    && programme.status === "ACTIVE"
    && programmeSignature(programme.sideA, programme.sideB) === signature
  ));
  if (duplicate) throw new Error("an active Programme already exists for these participants");

  const programme: Programme = {
    id: nextEntityId(state, "programme"),
    worldId: state.world.id,
    promotionId: promotion.id,
    status: "ACTIVE",
    sideA: structuredClone(input.sideA),
    sideB: structuredClone(input.sideB),
    championshipId,
    startedDate: dateCopy(state.world.currentDate),
    endedDate: null,
    heat: null,
    repetition: 0,
    activityCount: 0,
    matchCount: 0,
    segmentCount: 0,
    sideAWins: 0,
    sideBWins: 0,
    draws: 0,
    lastActivityDate: null,
  };
  programmes.push(programme);

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "PROGRAMME_STARTED",
    significance: "NOTABLE",
    entityIds: [programme.id, promotion.id, ...programme.sideA.map((ref) => ref.entityId), ...programme.sideB.map((ref) => ref.entityId)],
    payload: {
      promotionId: promotion.id,
      championshipId,
      participantCount: programme.sideA.length + programme.sideB.length,
    },
  });

  return programme;
}

export function recordProgrammeActivity(state: WorldState, input: RecordProgrammeActivityInput): ProgrammeActivity {
  const { programmes, activities } = programmeCollections(state);
  const programme = programmes.find((candidate) => candidate.id === input.programmeId);
  if (!programme) throw new Error(`Programme ${input.programmeId} was not found`);
  if (programme.status !== "ACTIVE") throw new Error("cannot record activity on an ended Programme");

  const date = dateCopy(input.date ?? state.world.currentDate);
  if (comparePpwDates(date, programme.startedDate, state.ruleset.weeksPerYear) < 0) {
    throw new Error("Programme activity cannot predate the Programme");
  }

  const allowedIds = new Set([...programme.sideA, ...programme.sideB].map((ref) => ref.entityId));
  const participantEntityIds = [...new Set(input.participantEntityIds ?? [...allowedIds])];
  if (participantEntityIds.length === 0 || participantEntityIds.some((entityId) => !allowedIds.has(entityId))) {
    throw new Error("Programme activity participants must belong to the Programme");
  }

  if (input.eventId) {
    const event = state.events.find((candidate) => candidate.id === input.eventId);
    if (!event || event.promotionId !== programme.promotionId) throw new Error("Programme activity event belongs to another promotion or is missing");
  }
  if (input.matchId) {
    const match = state.matches.find((candidate) => candidate.id === input.matchId);
    if (!match || match.promotionId !== programme.promotionId) throw new Error("Programme activity match belongs to another promotion or is missing");
    if (input.eventId && match.eventId !== input.eventId) throw new Error("Programme activity match does not belong to its event");
  }
  if (input.kind === "MATCH" && !input.matchId) throw new Error("MATCH Programme activity requires a matchId");

  const activity: ProgrammeActivity = {
    id: nextEntityId(state, "programmeActivity"),
    worldId: state.world.id,
    promotionId: programme.promotionId,
    programmeId: programme.id,
    date,
    kind: input.kind,
    participantEntityIds,
    eventId: input.eventId ?? null,
    matchId: input.matchId ?? null,
    winnerSide: input.winnerSide ?? null,
  };
  activities.push(activity);

  programme.activityCount += 1;
  if (activity.kind === "MATCH") programme.matchCount += 1;
  if (activity.kind === "SEGMENT") programme.segmentCount += 1;
  if (activity.kind === "MATCH") {
    if (activity.winnerSide === "A") programme.sideAWins += 1;
    else if (activity.winnerSide === "B") programme.sideBWins += 1;
    else programme.draws += 1;
  }
  if (!programme.lastActivityDate || comparePpwDates(date, programme.lastActivityDate, state.ruleset.weeksPerYear) >= 0) {
    programme.lastActivityDate = dateCopy(date);
  }

  return activity;
}

export function setProgrammeSignals(
  state: WorldState,
  programmeId: string,
  signals: { heat?: number | null; repetition?: number },
): Programme {
  const programme = (state.programmes ?? []).find((candidate) => candidate.id === programmeId);
  if (!programme) throw new Error(`Programme ${programmeId} was not found`);
  if (signals.heat !== undefined) {
    if (signals.heat !== null && (!Number.isFinite(signals.heat) || signals.heat < 0 || signals.heat > 100)) {
      throw new Error("Programme heat must be null or between 0 and 100");
    }
    programme.heat = signals.heat === null ? null : Math.round(signals.heat * 100) / 100;
  }
  if (signals.repetition !== undefined) {
    if (!Number.isFinite(signals.repetition) || signals.repetition < 0 || signals.repetition > 100) {
      throw new Error("Programme repetition must be between 0 and 100");
    }
    programme.repetition = Math.round(signals.repetition * 100) / 100;
  }
  return programme;
}

export function endProgramme(state: WorldState, programmeId: string): Programme {
  const programme = (state.programmes ?? []).find((candidate) => candidate.id === programmeId);
  if (!programme) throw new Error(`Programme ${programmeId} was not found`);
  if (programme.status === "ENDED") return programme;

  programme.status = "ENDED";
  programme.endedDate = dateCopy(state.world.currentDate);

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "PROGRAMME_ENDED",
    significance: "NOTABLE",
    entityIds: [programme.id, programme.promotionId],
    payload: {
      promotionId: programme.promotionId,
      activityCount: programme.activityCount,
      matchCount: programme.matchCount,
      segmentCount: programme.segmentCount,
      heat: programme.heat,
      repetition: programme.repetition,
    },
  });

  return programme;
}

export function validateProgrammeState(state: WorldState): string[] {
  const errors: string[] = [];
  const promotionIds = new Set(state.promotions.map((promotion) => promotion.id));
  const programmeIds = new Set<string>();
  const activityIds = new Set<string>();
  const people = new Set(state.people.map((person) => person.id));
  const teams = new Set((state.teams ?? []).map((team) => team.id));
  const championships = new Map((state.championships ?? []).map((championship) => [championship.id, championship]));
  const activitiesByProgramme = new Map<string, ProgrammeActivity[]>();

  for (const programme of state.programmes ?? []) {
    if (programmeIds.has(programme.id)) errors.push(`duplicate Programme id: ${programme.id}`);
    programmeIds.add(programme.id);
    if (programme.worldId !== state.world.id) errors.push(`Programme ${programme.id} crosses World boundary`);
    if (!promotionIds.has(programme.promotionId)) errors.push(`Programme ${programme.id} references missing promotion`);
    const refs = [...programme.sideA, ...programme.sideB];
    if (programme.sideA.length < 1 || programme.sideB.length < 1 || refs.length > 4) errors.push(`Programme ${programme.id} has invalid side sizes`);
    const seen = new Set<string>();
    for (const ref of refs) {
      const key = `${ref.kind}:${ref.entityId}`;
      if (seen.has(key)) errors.push(`Programme ${programme.id} repeats participant ${key}`);
      seen.add(key);
      if (ref.kind === "PERSON" && !people.has(ref.entityId)) errors.push(`Programme ${programme.id} references missing person ${ref.entityId}`);
      if (ref.kind === "TEAM" && !teams.has(ref.entityId)) errors.push(`Programme ${programme.id} references missing team ${ref.entityId}`);
    }
    if (programme.championshipId) {
      const championship = championships.get(programme.championshipId);
      if (!championship || championship.promotionId !== programme.promotionId) errors.push(`Programme ${programme.id} references invalid championship`);
    }
    if (programme.status === "ACTIVE" && programme.endedDate !== null) errors.push(`active Programme ${programme.id} has an end date`);
    if (programme.status === "ENDED" && programme.endedDate === null) errors.push(`ended Programme ${programme.id} has no end date`);
    if (programme.heat !== null && (programme.heat < 0 || programme.heat > 100)) errors.push(`Programme ${programme.id} heat is outside 0-100`);
    if (programme.repetition < 0 || programme.repetition > 100) errors.push(`Programme ${programme.id} repetition is outside 0-100`);
  }

  for (const activity of state.programmeActivities ?? []) {
    if (activityIds.has(activity.id)) errors.push(`duplicate Programme activity id: ${activity.id}`);
    activityIds.add(activity.id);
    if (activity.worldId !== state.world.id) errors.push(`Programme activity ${activity.id} crosses World boundary`);
    const programme = (state.programmes ?? []).find((candidate) => candidate.id === activity.programmeId);
    if (!programme) errors.push(`Programme activity ${activity.id} references missing Programme`);
    else if (programme.promotionId !== activity.promotionId) errors.push(`Programme activity ${activity.id} promotion does not match Programme`);
    const list = activitiesByProgramme.get(activity.programmeId) ?? [];
    list.push(activity);
    activitiesByProgramme.set(activity.programmeId, list);
  }

  for (const programme of state.programmes ?? []) {
    const activities = activitiesByProgramme.get(programme.id) ?? [];
    const matches = activities.filter((activity) => activity.kind === "MATCH");
    const segments = activities.filter((activity) => activity.kind === "SEGMENT");
    const sideAWins = matches.filter((activity) => activity.winnerSide === "A").length;
    const sideBWins = matches.filter((activity) => activity.winnerSide === "B").length;
    const draws = matches.filter((activity) => activity.winnerSide === null).length;
    if (programme.activityCount !== activities.length) errors.push(`Programme ${programme.id} activity count is inconsistent`);
    if (programme.matchCount !== matches.length) errors.push(`Programme ${programme.id} match count is inconsistent`);
    if (programme.segmentCount !== segments.length) errors.push(`Programme ${programme.id} segment count is inconsistent`);
    if (programme.sideAWins !== sideAWins || programme.sideBWins !== sideBWins || programme.draws !== draws) errors.push(`Programme ${programme.id} winner history is inconsistent`);
  }

  return errors;
}

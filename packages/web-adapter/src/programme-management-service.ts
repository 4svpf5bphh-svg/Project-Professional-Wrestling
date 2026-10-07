import type { Id } from "../../domain/src/types.js";
import type { ProgrammeParticipantRef } from "../../domain/src/programmes.js";
import {
  activePromotionControlForPlayer,
  startProgrammeCommand,
  type ApplicationWorldRepository,
} from "../../application/src/index.js";
import { wrestlerAlignmentForPromotion } from "../../sim-core/src/alignment.js";
import { currentRosterPersonIds } from "../../sim-core/src/contracts.js";

export interface AlphaProgrammeRosterPersonView {
  personId: Id;
  name: string;
  alignment: "FACE" | "HEEL" | "TWEENER";
  popularity: number;
}

export interface AlphaManagedProgrammeSideView {
  label: string;
  personIds: Id[];
}

export interface AlphaManagedProgrammeView {
  programmeId: Id;
  sideA: AlphaManagedProgrammeSideView;
  sideB: AlphaManagedProgrammeSideView;
  championshipName: string | null;
  startedYear: number;
  startedWeek: number;
  heat: number | null;
  repetition: number;
  activityCount: number;
  matchCount: number;
  segmentCount: number;
}

export interface AlphaProgrammeManagementView {
  world: {
    worldId: Id;
    year: number;
    week: number;
    phase: "OPEN" | "LOCKING" | "RESOLVING";
    revision: number;
  };
  promotion: {
    promotionId: Id;
    name: string;
  };
  canEdit: boolean;
  roster: AlphaProgrammeRosterPersonView[];
  championships: Array<{
    championshipId: Id;
    name: string;
    division: "SINGLES" | "TAG";
  }>;
  programmes: AlphaManagedProgrammeView[];
}

export interface AlphaManagedStartProgrammeRequest {
  requestId: string;
  expectedRevision: number;
  sideAIds: Id[];
  sideBIds: Id[];
  championshipId?: Id | null;
}

function requiredText(value: string, label: string, maxLength = 220): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function requireRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("expectedRevision must be a non-negative integer");
  return value;
}

function teamPersonIds(
  state: Awaited<ReturnType<ApplicationWorldRepository["load"]>>["state"],
  teamId: Id,
): Id[] {
  return (state.teamMemberships ?? [])
    .filter((membership) => membership.teamId === teamId && membership.active)
    .map((membership) => membership.personId)
    .sort();
}

function participantSide(
  state: Awaited<ReturnType<ApplicationWorldRepository["load"]>>["state"],
  refs: ProgrammeParticipantRef[],
): AlphaManagedProgrammeSideView {
  const labels: string[] = [];
  const personIds: Id[] = [];
  for (const ref of refs) {
    if (ref.kind === "PERSON") {
      const person = state.people.find((candidate) => candidate.id === ref.entityId);
      labels.push(person?.name ?? ref.entityId);
      personIds.push(ref.entityId);
      continue;
    }
    const team = (state.teams ?? []).find((candidate) => candidate.id === ref.entityId);
    const members = teamPersonIds(state, ref.entityId);
    labels.push(team?.name ?? ref.entityId);
    personIds.push(...members);
  }
  return { label: labels.join(" & "), personIds: [...new Set(personIds)] };
}

export async function loadAlphaProgrammeManagement(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<AlphaProgrammeManagementView> {
  const aggregate = await repository.load(worldId);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  if (!control) throw new Error("Take control of a promotion before managing Programmes");
  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} was not found`);

  const rosterIds = new Set(currentRosterPersonIds(aggregate.state, promotion.id));
  const roster = aggregate.state.people
    .filter((person) => rosterIds.has(person.id) && person.status !== "RETIRED")
    .map((person) => ({
      personId: person.id,
      name: person.name,
      alignment: wrestlerAlignmentForPromotion(aggregate.state, promotion.id, person.id),
      popularity: person.popularity,
    } satisfies AlphaProgrammeRosterPersonView))
    .sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));

  const programmes = (aggregate.state.programmes ?? [])
    .filter((programme) => programme.promotionId === promotion.id && programme.status === "ACTIVE")
    .map((programme) => {
      const championship = programme.championshipId
        ? (aggregate.state.championships ?? []).find((candidate) => candidate.id === programme.championshipId)
        : null;
      return {
        programmeId: programme.id,
        sideA: participantSide(aggregate.state, programme.sideA),
        sideB: participantSide(aggregate.state, programme.sideB),
        championshipName: championship?.name ?? null,
        startedYear: programme.startedDate.year,
        startedWeek: programme.startedDate.week,
        heat: programme.heat,
        repetition: programme.repetition,
        activityCount: programme.activityCount,
        matchCount: programme.matchCount,
        segmentCount: programme.segmentCount,
      } satisfies AlphaManagedProgrammeView;
    })
    .sort((left, right) => left.startedYear - right.startedYear || left.startedWeek - right.startedWeek || left.programmeId.localeCompare(right.programmeId));

  const championships = (aggregate.state.championships ?? [])
    .filter((championship) => championship.promotionId === promotion.id && championship.status === "ACTIVE")
    .map((championship) => ({
      championshipId: championship.id,
      name: championship.name,
      division: championship.division,
    }))
    .sort((left, right) => left.division.localeCompare(right.division) || left.name.localeCompare(right.name));

  return {
    world: {
      worldId,
      year: aggregate.state.world.currentDate.year,
      week: aggregate.state.world.currentDate.week,
      phase: aggregate.runtime.phase,
      revision: aggregate.runtime.revision,
    },
    promotion: { promotionId: promotion.id, name: promotion.name },
    canEdit: aggregate.runtime.phase === "OPEN",
    roster,
    championships,
    programmes,
  };
}

export async function startAlphaManagedProgramme(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaManagedStartProgrammeRequest,
): Promise<AlphaProgrammeManagementView> {
  const requestId = requiredText(request.requestId, "requestId");
  requireRevision(request.expectedRevision);
  if (!Array.isArray(request.sideAIds) || !Array.isArray(request.sideBIds)) {
    throw new Error("Programme sides must be arrays");
  }

  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before managing Programmes");
    const receipt = aggregate.commands.receipts.find((candidate) => candidate.requestId === requestId);
    if (!receipt && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }
    startProgrammeCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId,
        worldId,
        playerId,
        commandType: "START_PROGRAMME",
        payload: {
          promotionId: control.promotionId,
          sideA: request.sideAIds.map((entityId) => ({ kind: "PERSON", entityId })),
          sideB: request.sideBIds.map((entityId) => ({ kind: "PERSON", entityId })),
          championshipId: request.championshipId ?? null,
        },
      },
    );
  });

  return loadAlphaProgrammeManagement(repository, worldId, playerId);
}

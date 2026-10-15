import type { Id } from "../../domain/src/types.js";
import type { ProgrammeParticipantRef } from "../../domain/src/programmes.js";
import {
  transactWithReceiptIds,
  activePromotionControlForPlayer,
  alphaCurrentWeekShowDraftId,
  reservationForDraft,
  reserveDetailedShowDraftCommand,
  startProgrammeCommand,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldRepository,
} from "../../application/src/index.js";

export interface AlphaProgrammeSideView {
  label: string;
  personIds: Id[];
}

export interface AlphaProgrammeView {
  programmeId: Id;
  sideA: AlphaProgrammeSideView;
  sideB: AlphaProgrammeSideView;
  championshipName: string | null;
  startedYear: number;
  startedWeek: number;
  heat: number | null;
  repetition: number;
  activityCount: number;
  matchCount: number;
  segmentCount: number;
}

export interface AlphaProgrammeParticipantView {
  personId: Id;
  name: string;
}

export interface AlphaProgrammeChampionshipView {
  championshipId: Id;
  name: string;
  division: "SINGLES" | "TAG";
}

export interface AlphaProgrammeSegmentView {
  draftSegmentId: string;
  programmeId: Id;
  participantIds: Id[];
}

export interface AlphaProgrammeContextView {
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
  draftId: string;
  workspaceVersion: number;
  canEdit: boolean;
  participants: AlphaProgrammeParticipantView[];
  championships: AlphaProgrammeChampionshipView[];
  programmes: AlphaProgrammeView[];
  programmeSegments: AlphaProgrammeSegmentView[];
}

export interface AlphaStartProgrammeRequest {
  requestId: string;
  expectedRevision: number;
  draftId?: string;
  sideAIds: Id[];
  sideBIds: Id[];
  championshipId?: Id | null;
}

export interface AlphaSetProgrammeSegmentRequest {
  requestId: string;
  expectedRevision: number;
  expectedPlanVersion: number;
  draftId?: string;
  programmeId: Id;
  enabled: boolean;
}

function requiredText(value: string, label: string, maxLength = 220): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function requireNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function resolveDraftId(promotionId: Id, year: number, week: number, day: number, requested?: string): string {
  if (requested !== undefined) return requiredText(requested, "draftId", 128);
  return alphaCurrentWeekShowDraftId(promotionId, { year, week, day });
}

function teamPersonIds(state: Awaited<ReturnType<ApplicationWorldRepository["load"]>>["state"], teamId: Id): Id[] {
  return (state.teamMemberships ?? [])
    .filter((membership) => membership.teamId === teamId && membership.active)
    .map((membership) => membership.personId)
    .sort();
}

function participantSide(
  state: Awaited<ReturnType<ApplicationWorldRepository["load"]>>["state"],
  refs: ProgrammeParticipantRef[],
): AlphaProgrammeSideView {
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

function validateSideIds(sideAIds: Id[], sideBIds: Id[], reservedIds: Set<Id>): void {
  if (!Array.isArray(sideAIds) || !Array.isArray(sideBIds) || sideAIds.length < 1 || sideBIds.length < 1) {
    throw new Error("Programme requires at least one wrestler on each side");
  }
  if (sideAIds.length > 2 || sideBIds.length > 2 || sideAIds.length + sideBIds.length > 4) {
    throw new Error("Programme supports two to four wrestlers across two sides");
  }
  const allIds = [...sideAIds, ...sideBIds];
  if (new Set(allIds).size !== allIds.length) throw new Error("Programme cannot include the same wrestler twice");
  if (allIds.some((personId) => !reservedIds.has(personId))) {
    throw new Error("Programme wrestlers must be reserved for this show");
  }
}

export async function loadAlphaProgrammeContext(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  requestedDraftId?: string,
): Promise<AlphaProgrammeContextView> {
  const aggregate = await repository.load(worldId);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  if (!control) throw new Error("Take control of a promotion before managing Programmes");
  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} was not found`);

  const currentDate = aggregate.state.world.currentDate;
  const draftId = resolveDraftId(
    promotion.id,
    currentDate.year,
    currentDate.week,
    currentDate.day,
    requestedDraftId,
  );
  const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id);
  const draft = workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
  const reservation = reservationForDraft(aggregate.planning, promotion.id, draftId);
  if (!workspace || !draft || !reservation) throw new Error("Reserve this show before managing Programmes from its card");

  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const participants = draft.participantIds.map((personId) => ({
    personId,
    name: peopleById.get(personId)?.name ?? personId,
  }));
  const reserved = new Set(draft.participantIds);

  const programmes = (aggregate.state.programmes ?? [])
    .filter((programme) => programme.promotionId === promotion.id && programme.status === "ACTIVE")
    .map((programme) => {
      const sideA = participantSide(aggregate.state, programme.sideA);
      const sideB = participantSide(aggregate.state, programme.sideB);
      const championship = programme.championshipId
        ? (aggregate.state.championships ?? []).find((candidate) => candidate.id === programme.championshipId)
        : null;
      return {
        programmeId: programme.id,
        sideA,
        sideB,
        championshipName: championship?.name ?? null,
        startedYear: programme.startedDate.year,
        startedWeek: programme.startedDate.week,
        heat: programme.heat,
        repetition: programme.repetition,
        activityCount: programme.activityCount,
        matchCount: programme.matchCount,
        segmentCount: programme.segmentCount,
      } satisfies AlphaProgrammeView;
    })
    .filter((programme) => (
      [...programme.sideA.personIds, ...programme.sideB.personIds].some((personId) => reserved.has(personId))
    ))
    .sort((left, right) => left.startedYear - right.startedYear || left.startedWeek - right.startedWeek || left.programmeId.localeCompare(right.programmeId));

  const championships = (aggregate.state.championships ?? [])
    .filter((championship) => championship.promotionId === promotion.id && championship.status === "ACTIVE")
    .map((championship) => ({
      championshipId: championship.id,
      name: championship.name,
      division: championship.division,
    } satisfies AlphaProgrammeChampionshipView))
    .sort((left, right) => left.division.localeCompare(right.division) || left.name.localeCompare(right.name));

  const programmeSegments = (draft.programmeSegments ?? []).map((segment) => ({
    draftSegmentId: segment.draftSegmentId,
    programmeId: segment.programmeId,
    participantIds: [...segment.participantIds],
  } satisfies AlphaProgrammeSegmentView));

  return {
    world: {
      worldId,
      year: currentDate.year,
      week: currentDate.week,
      phase: aggregate.runtime.phase,
      revision: aggregate.runtime.revision,
    },
    promotion: { promotionId: promotion.id, name: promotion.name },
    draftId,
    workspaceVersion: workspace.version,
    canEdit: aggregate.runtime.phase === "OPEN",
    participants,
    championships,
    programmes,
    programmeSegments,
  };
}

export async function startAlphaProgramme(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaStartProgrammeRequest,
): Promise<AlphaProgrammeContextView> {
  const requestId = requiredText(request.requestId, "requestId");
  requireNonNegativeInteger(request.expectedRevision, "expectedRevision");
  const requestedDraftId = request.draftId === undefined
    ? undefined
    : requiredText(request.draftId, "draftId", 128);

  await transactWithReceiptIds(repository, worldId, null, [requestId], (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before managing Programmes");
    const existingReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === requestId);
    if (!existingReceipt && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }

    const currentDate = aggregate.state.world.currentDate;
    const draftId = resolveDraftId(
      control.promotionId,
      currentDate.year,
      currentDate.week,
      currentDate.day,
      requestedDraftId,
    );
    const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === control.promotionId);
    const draft = workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
    const reservation = reservationForDraft(aggregate.planning, control.promotionId, draftId);
    if (!draft || !reservation) throw new Error("Reserve this show before managing Programmes from its card");

    validateSideIds(request.sideAIds, request.sideBIds, new Set(draft.participantIds));
    const championshipId = request.championshipId ?? null;
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
          championshipId,
        },
      },
    );
  });

  return loadAlphaProgrammeContext(repository, worldId, playerId, requestedDraftId);
}

export async function setAlphaProgrammeSegment(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaSetProgrammeSegmentRequest,
): Promise<AlphaProgrammeContextView> {
  const requestId = requiredText(request.requestId, "requestId");
  requireNonNegativeInteger(request.expectedRevision, "expectedRevision");
  requireNonNegativeInteger(request.expectedPlanVersion, "expectedPlanVersion");
  const programmeId = requiredText(request.programmeId, "programmeId", 128);
  const requestedDraftId = request.draftId === undefined
    ? undefined
    : requiredText(request.draftId, "draftId", 128);
  const segmentRequestId = `${requestId}:segment`;
  const reservationRequestId = `${requestId}:reserve`;

  await transactWithReceiptIds(repository, worldId, null, [segmentRequestId, reservationRequestId], (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before managing Programmes");
    const segmentReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === segmentRequestId);
    const reservationReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === reservationRequestId);
    const completeRetry = Boolean(segmentReceipt && reservationReceipt);
    if (!completeRetry && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }

    const currentDate = aggregate.state.world.currentDate;
    const draftId = resolveDraftId(
      control.promotionId,
      currentDate.year,
      currentDate.week,
      currentDate.day,
      requestedDraftId,
    );
    const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === control.promotionId);
    const draft = workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
    const reservation = reservationForDraft(aggregate.planning, control.promotionId, draftId);
    if (!workspace || !draft || !reservation) throw new Error("Reserve this show before managing Programmes from its card");

    const programme = (aggregate.state.programmes ?? []).find((candidate) => (
      candidate.id === programmeId
      && candidate.promotionId === control.promotionId
      && candidate.status === "ACTIVE"
    ));
    if (!programme) throw new Error(`active Programme ${programmeId} was not found`);

    const reservedIds = new Set(draft.participantIds);
    const sideA = participantSide(aggregate.state, programme.sideA);
    const sideB = participantSide(aggregate.state, programme.sideB);
    const participantIds = [...new Set([...sideA.personIds, ...sideB.personIds])]
      .filter((personId) => reservedIds.has(personId));
    if (request.enabled && participantIds.length === 0) {
      throw new Error("Programme has no participants reserved for this show");
    }

    const programmeSegments = (draft.programmeSegments ?? [])
      .filter((segment) => segment.programmeId !== programmeId)
      .map((segment) => structuredClone(segment));
    if (request.enabled) {
      programmeSegments.push({
        draftSegmentId: `segment:${programme.id}`,
        programmeId: programme.id,
        participantIds,
      });
    }
    programmeSegments.sort((left, right) => left.programmeId.localeCompare(right.programmeId));

    const nextWorkspace = upsertDetailedShowDraftCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.planning,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: segmentRequestId,
        worldId,
        playerId,
        commandType: "UPSERT_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: control.promotionId,
          expectedPlanVersion: request.expectedPlanVersion,
          draft: {
            ...structuredClone(draft),
            programmeSegments,
          },
        },
      },
    );

    reserveDetailedShowDraftCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.planning,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: reservationRequestId,
        worldId,
        playerId,
        commandType: "RESERVE_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: control.promotionId,
          expectedPlanVersion: nextWorkspace.version,
          draftId,
        },
      },
    );
  });

  return loadAlphaProgrammeContext(repository, worldId, playerId, requestedDraftId);
}

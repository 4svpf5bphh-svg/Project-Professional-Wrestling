import type {
  Id,
  MatchIntent,
  MatchSide,
  MatchType,
  WorldState,
} from "../../domain/src/types.js";
import {
  activePromotionControlForPlayer,
  alphaCurrentWeekShowDraftId,
  playerShowPlanningStatus,
  reservationForDraft,
  reserveDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldRepository,
  type ChampionshipDraftAssignment,
  type DetailedMatchDraft,
  type PlayerShowPlanningState,
} from "../../application/src/index.js";

export interface AlphaCardParticipantView {
  personId: Id;
  name: string;
  popularity: number;
  momentum: number;
  morale: number;
}

export interface AlphaCardMatchView {
  draftMatchId: string;
  type: MatchType;
  sideAIds: Id[];
  sideBIds: Id[];
  intendedWinnerSide: MatchSide;
  intent: MatchIntent;
  plannedLengthMinutes: number;
}

export interface AlphaCardChampionshipView {
  championshipId: Id;
  name: string;
  division: MatchType;
  prestige: number;
  holderName: string | null;
  holderPersonIds: Id[];
}

export interface AlphaChampionshipAssignmentView {
  draftMatchId: string;
  championshipId: Id;
}

export interface AlphaCurrentWeekCardView {
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
  reservationId: string;
  planningState: PlayerShowPlanningState;
  canEdit: boolean;
  marketName: string;
  venueName: string;
  participants: AlphaCardParticipantView[];
  matches: AlphaCardMatchView[];
  championships: AlphaCardChampionshipView[];
  championshipAssignments: AlphaChampionshipAssignmentView[];
}

export interface AlphaShowCardRequest {
  requestId: string;
  expectedRevision: number;
  expectedPlanVersion: number;
  matches: AlphaCardMatchView[];
  championshipAssignments: AlphaChampionshipAssignmentView[];
}

const MATCH_TYPES = new Set<MatchType>(["SINGLES", "TAG"]);
const MATCH_SIDES = new Set<MatchSide>(["A", "B"]);
const MATCH_INTENTS = new Set<MatchIntent>([
  "COMPETITIVE",
  "SHOWCASE",
  "DOMINANT",
  "TECHNICAL",
  "HIGH_RISK",
  "STORY",
  "PROTECTIVE",
  "EPIC",
]);

function requiredText(value: string, label: string, maxLength = 220): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function requireExpectedRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("expectedRevision must be a non-negative integer");
  return value;
}

function requirePlanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("expectedPlanVersion must be a non-negative integer");
  return value;
}

function normalizeCompleteCard(
  matches: AlphaCardMatchView[],
  participantIds: Id[],
): DetailedMatchDraft[] {
  if (!Array.isArray(matches) || matches.length === 0) throw new Error("match card requires at least one match");

  const selected = new Set(participantIds);
  const used = new Set<Id>();
  const matchIds = new Set<string>();

  const normalized = matches.map((match, index) => {
    const draftMatchId = requiredText(match.draftMatchId, `matches[${index}].draftMatchId`, 128);
    if (matchIds.has(draftMatchId)) throw new Error("match card contains duplicate match IDs");
    matchIds.add(draftMatchId);
    if (!MATCH_TYPES.has(match.type)) throw new Error(`unsupported match type ${String(match.type)}`);
    if (!MATCH_SIDES.has(match.intendedWinnerSide)) throw new Error("intended winner side must be A or B");
    if (!MATCH_INTENTS.has(match.intent)) throw new Error(`unsupported match intent ${String(match.intent)}`);
    if (!Number.isInteger(match.plannedLengthMinutes) || match.plannedLengthMinutes < 3 || match.plannedLengthMinutes > 60) {
      throw new Error("planned match length must be an integer from 3 to 60 minutes");
    }

    const expectedSideSize = match.type === "SINGLES" ? 1 : 2;
    if (match.sideAIds.length !== expectedSideSize || match.sideBIds.length !== expectedSideSize) {
      throw new Error(`${match.type.toLowerCase()} match requires ${expectedSideSize} wrestler(s) per side`);
    }

    const ids = [...match.sideAIds, ...match.sideBIds];
    if (new Set(ids).size !== ids.length) throw new Error("one wrestler cannot occupy multiple positions in a match");
    for (const personId of ids) {
      if (!selected.has(personId)) throw new Error(`${personId} is not reserved for this show`);
      if (used.has(personId)) throw new Error(`${personId} is booked more than once on the card`);
      used.add(personId);
    }

    return {
      draftMatchId,
      type: match.type,
      sideAIds: [...match.sideAIds],
      sideBIds: [...match.sideBIds],
      intendedWinnerSide: match.intendedWinnerSide,
      intent: match.intent,
      plannedLengthMinutes: match.plannedLengthMinutes,
    } satisfies DetailedMatchDraft;
  });

  if (used.size !== selected.size || participantIds.some((personId) => !used.has(personId))) {
    throw new Error("manual card must use every wrestler reserved for the show exactly once");
  }
  return normalized;
}

function activeReign(state: WorldState, championshipId: Id) {
  const championship = state.championships?.find((candidate) => candidate.id === championshipId);
  if (!championship?.currentReignId) return null;
  return state.championshipReigns?.find(
    (reign) => reign.id === championship.currentReignId && reign.status === "ACTIVE",
  ) ?? null;
}

function activeTeamMemberIds(state: WorldState, teamId: Id): Id[] {
  return (state.teamMemberships ?? [])
    .filter((membership) => membership.teamId === teamId && membership.active)
    .map((membership) => membership.personId)
    .sort();
}

function championshipHolder(
  state: WorldState,
  championshipId: Id,
): { holderName: string | null; holderPersonIds: Id[] } {
  const reign = activeReign(state, championshipId);
  if (!reign) return { holderName: null, holderPersonIds: [] };
  if (reign.holderType === "PERSON") {
    const person = state.people.find((candidate) => candidate.id === reign.holderId);
    return { holderName: person?.name ?? reign.holderId, holderPersonIds: [reign.holderId] };
  }
  const holderPersonIds = activeTeamMemberIds(state, reign.holderId);
  const team = state.teams?.find((candidate) => candidate.id === reign.holderId);
  const memberNames = holderPersonIds
    .map((personId) => state.people.find((person) => person.id === personId)?.name ?? personId)
    .join(" & ");
  return {
    holderName: team?.name ?? (memberNames || reign.holderId),
    holderPersonIds,
  };
}

function sameSideContainsHolder(match: DetailedMatchDraft, holderPersonIds: Id[]): boolean {
  if (holderPersonIds.length === 0) return true;
  if (holderPersonIds.length === 1) {
    return [...match.sideAIds, ...match.sideBIds].includes(holderPersonIds[0]!);
  }
  if (match.type !== "TAG" || holderPersonIds.length !== 2) return false;
  const holderKey = [...holderPersonIds].sort().join(":");
  return [match.sideAIds, match.sideBIds].some((side) => [...side].sort().join(":") === holderKey);
}

function normalizeChampionshipAssignments(
  assignments: AlphaChampionshipAssignmentView[],
  matches: DetailedMatchDraft[],
  state: WorldState,
  promotionId: Id,
): ChampionshipDraftAssignment[] {
  if (!Array.isArray(assignments)) throw new Error("championshipAssignments must be an array");
  const usedMatches = new Set<string>();
  const usedChampionships = new Set<Id>();

  return assignments.map((assignment, index) => {
    const draftMatchId = requiredText(
      assignment.draftMatchId,
      `championshipAssignments[${index}].draftMatchId`,
      128,
    );
    const championshipId = requiredText(
      assignment.championshipId,
      `championshipAssignments[${index}].championshipId`,
      128,
    );
    const match = matches.find((candidate) => candidate.draftMatchId === draftMatchId);
    if (!match) throw new Error(`championship assignment references missing match ${draftMatchId}`);
    const championship = state.championships?.find((candidate) => candidate.id === championshipId);
    if (!championship || championship.status !== "ACTIVE") throw new Error(`active championship ${championshipId} was not found`);
    if (championship.promotionId !== promotionId) throw new Error("championship belongs to another promotion");
    if (championship.division !== match.type) throw new Error("championship division does not match match type");
    if (usedMatches.has(draftMatchId)) throw new Error("one match cannot carry multiple championships");
    if (usedChampionships.has(championshipId)) throw new Error("one championship cannot be assigned twice on the card");

    const holder = championshipHolder(state, championshipId);
    if (!sameSideContainsHolder(match, holder.holderPersonIds)) {
      throw new Error("reigning champion must participate in a championship defense");
    }

    usedMatches.add(draftMatchId);
    usedChampionships.add(championshipId);
    return { draftMatchId, championshipId };
  });
}

export async function loadAlphaCurrentWeekCard(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<AlphaCurrentWeekCardView> {
  const aggregate = await repository.load(worldId);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  if (!control) throw new Error("Take control of a promotion before booking a card");

  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} was not found`);

  const currentDate = aggregate.state.world.currentDate;
  const draftId = alphaCurrentWeekShowDraftId(promotion.id, currentDate);
  const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id);
  const draft = workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
  const reservation = reservationForDraft(aggregate.planning, promotion.id, draftId);
  if (!workspace || !draft || !reservation) {
    throw new Error("Reserve this week's show before booking its match card");
  }

  const status = playerShowPlanningStatus(
    aggregate.state,
    aggregate.planning,
    aggregate.runtime,
    promotion.id,
    draftId,
  );
  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const participants = draft.participantIds.map((personId) => {
    const person = peopleById.get(personId);
    if (!person) throw new Error(`reserved wrestler ${personId} was not found`);
    return {
      personId,
      name: person.name,
      popularity: person.popularity,
      momentum: person.momentum,
      morale: person.morale,
    } satisfies AlphaCardParticipantView;
  });

  const market = aggregate.state.markets.find((candidate) => candidate.id === reservation.marketId);
  const venue = aggregate.state.venues.find((candidate) => candidate.id === reservation.venueId);
  const championships = (aggregate.state.championships ?? [])
    .filter((championship) => championship.promotionId === promotion.id && championship.status === "ACTIVE")
    .sort((a, b) => a.division.localeCompare(b.division) || a.name.localeCompare(b.name))
    .map((championship) => {
      const holder = championshipHolder(aggregate.state, championship.id);
      return {
        championshipId: championship.id,
        name: championship.name,
        division: championship.division,
        prestige: championship.prestige,
        holderName: holder.holderName,
        holderPersonIds: holder.holderPersonIds,
      } satisfies AlphaCardChampionshipView;
    });

  return {
    world: {
      worldId,
      year: currentDate.year,
      week: currentDate.week,
      phase: aggregate.runtime.phase,
      revision: aggregate.runtime.revision,
    },
    promotion: {
      promotionId: promotion.id,
      name: promotion.name,
    },
    draftId,
    workspaceVersion: workspace.version,
    reservationId: reservation.reservationId,
    planningState: status.state,
    canEdit: aggregate.runtime.phase === "OPEN" && status.availableActions.includes("EDIT_DRAFT"),
    marketName: market?.name ?? reservation.marketId,
    venueName: venue?.name ?? reservation.venueId,
    participants,
    matches: draft.matches.flatMap((match) => (
      match.intendedWinnerSide !== null && match.intent !== null && match.plannedLengthMinutes !== null
        ? [{
          draftMatchId: match.draftMatchId,
          type: match.type,
          sideAIds: [...match.sideAIds],
          sideBIds: [...match.sideBIds],
          intendedWinnerSide: match.intendedWinnerSide,
          intent: match.intent,
          plannedLengthMinutes: match.plannedLengthMinutes,
        } satisfies AlphaCardMatchView]
        : []
    )),
    championships,
    championshipAssignments: draft.championshipAssignments.map((assignment) => ({ ...assignment })),
  };
}

export async function saveAlphaCurrentWeekCard(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaShowCardRequest,
): Promise<AlphaCurrentWeekCardView> {
  const requestId = requiredText(request.requestId, "requestId");
  const expectedRevision = requireExpectedRevision(request.expectedRevision);
  const expectedPlanVersion = requirePlanVersion(request.expectedPlanVersion);
  const cardRequestId = `${requestId}:card`;
  const reservationRequestId = `${requestId}:reserve`;

  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before booking a card");

    const cardReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === cardRequestId);
    const reservationReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === reservationRequestId);
    const completeRetry = Boolean(cardReceipt && reservationReceipt);
    if (!completeRetry && aggregate.runtime.revision !== expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${expectedRevision}, current ${aggregate.runtime.revision}`);
    }

    const draftId = alphaCurrentWeekShowDraftId(control.promotionId, aggregate.state.world.currentDate);
    const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === control.promotionId);
    const draft = workspace?.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
    if (!workspace || !draft || !reservationForDraft(aggregate.planning, control.promotionId, draftId)) {
      throw new Error("Reserve this week's show before booking its match card");
    }

    const matches = normalizeCompleteCard(request.matches, draft.participantIds);
    const championshipAssignments = normalizeChampionshipAssignments(
      request.championshipAssignments,
      matches,
      aggregate.state,
      control.promotionId,
    );
    const nextWorkspace = upsertDetailedShowDraftCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.planning,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: cardRequestId,
        worldId,
        playerId,
        commandType: "UPSERT_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: control.promotionId,
          expectedPlanVersion,
          draft: {
            ...structuredClone(draft),
            matches,
            championshipAssignments,
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

  return loadAlphaCurrentWeekCard(repository, worldId, playerId);
}

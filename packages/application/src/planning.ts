import type {
  Id,
  MatchIntent,
  MatchSide,
  MatchType,
  PpwDate,
  TicketStrategy,
  WorldState,
} from "../../domain/src/types.js";

export const DETAILED_PLANNING_HORIZON_WEEKS = 6 as const;

export interface DetailedMatchDraft {
  draftMatchId: string;
  type: MatchType;
  sideAIds: Id[];
  sideBIds: Id[];
  intendedWinnerSide: MatchSide | null;
  intent: MatchIntent | null;
  plannedLengthMinutes: number | null;
}

export interface ChampionshipDraftAssignment {
  draftMatchId: string;
  championshipId: Id;
}

export interface DetailedShowDraft {
  draftId: string;
  promotionId: Id;
  targetDate: PpwDate;
  marketId: Id | null;
  venueId: Id | null;
  ticketStrategy: TicketStrategy | null;
  participantIds: Id[];
  matches: DetailedMatchDraft[];
  championshipAssignments: ChampionshipDraftAssignment[];
}

export interface PromotionPlanningWorkspace {
  worldId: Id;
  promotionId: Id;
  version: number;
  detailedShowDrafts: DetailedShowDraft[];
}

export interface WorldPlanningState {
  worldId: Id;
  workspaces: PromotionPlanningWorkspace[];
}

const TICKET_STRATEGIES = new Set<TicketStrategy>(["ACCESSIBLE", "STANDARD", "PREMIUM", "PRESTIGE"]);
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

function normalizedId(value: string, label: string, maxLength = 128): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} must contain at most ${maxLength} characters`);
  return normalized;
}

function weekIndex(date: PpwDate, weeksPerYear: number): number {
  if (!Number.isInteger(date.year) || date.year < 1) throw new Error("planning target year must be a positive integer");
  if (!Number.isInteger(date.week) || date.week < 1 || date.week > weeksPerYear) {
    throw new Error(`planning target week must be between 1 and ${weeksPerYear}`);
  }
  if (!Number.isInteger(date.day) || date.day < 1 || date.day > 7) {
    throw new Error("planning target day must be between 1 and 7");
  }
  return ((date.year - 1) * weeksPerYear) + (date.week - 1);
}

function validateMatchDraft(
  draft: DetailedMatchDraft,
  participantIds: Set<Id>,
  usedParticipantIds: Set<Id>,
): DetailedMatchDraft {
  const draftMatchId = normalizedId(draft.draftMatchId, "draftMatchId");
  if (!MATCH_TYPES.has(draft.type)) throw new Error(`unsupported draft match type ${String(draft.type)}`);

  const expectedSideSize = draft.type === "SINGLES" ? 1 : 2;
  if (!Array.isArray(draft.sideAIds) || !Array.isArray(draft.sideBIds)) {
    throw new Error("draft match sides must be arrays");
  }
  if (draft.sideAIds.length !== expectedSideSize || draft.sideBIds.length !== expectedSideSize) {
    throw new Error(`${draft.type} draft match requires ${expectedSideSize} wrestler(s) per side`);
  }

  const sideIds = [...draft.sideAIds, ...draft.sideBIds];
  if (new Set(sideIds).size !== sideIds.length) throw new Error("one wrestler cannot occupy multiple positions in a draft match");
  for (const personId of sideIds) {
    if (!participantIds.has(personId)) throw new Error(`${personId} is not selected for this show draft`);
    if (usedParticipantIds.has(personId)) throw new Error(`${personId} is booked more than once on this draft card`);
    usedParticipantIds.add(personId);
  }

  if (draft.intendedWinnerSide !== null && !MATCH_SIDES.has(draft.intendedWinnerSide)) {
    throw new Error("draft intended winner side must be A, B or null");
  }
  if (draft.intent !== null && !MATCH_INTENTS.has(draft.intent)) {
    throw new Error(`unsupported draft match intent ${String(draft.intent)}`);
  }
  if (
    draft.plannedLengthMinutes !== null
    && (!Number.isInteger(draft.plannedLengthMinutes) || draft.plannedLengthMinutes < 3 || draft.plannedLengthMinutes > 60)
  ) {
    throw new Error("draft planned match length must be an integer from 3 to 60 minutes or null");
  }

  return {
    draftMatchId,
    type: draft.type,
    sideAIds: [...draft.sideAIds],
    sideBIds: [...draft.sideBIds],
    intendedWinnerSide: draft.intendedWinnerSide,
    intent: draft.intent,
    plannedLengthMinutes: draft.plannedLengthMinutes,
  };
}

export function createWorldPlanningState(worldId: Id): WorldPlanningState {
  return { worldId, workspaces: [] };
}

export function promotionPlanningWorkspace(
  planning: WorldPlanningState,
  promotionId: Id,
): PromotionPlanningWorkspace | null {
  const workspace = planning.workspaces.find((candidate) => candidate.promotionId === promotionId);
  return workspace ? structuredClone(workspace) : null;
}

export function validateWorldPlanningStateShape(state: WorldState, planning: WorldPlanningState): void {
  if (planning.worldId !== state.world.id) throw new Error("planning state crosses World boundary");
  const promotionIds = new Set(state.promotions.map((promotion) => promotion.id));
  const seenPromotions = new Set<Id>();

  for (const workspace of planning.workspaces) {
    if (workspace.worldId !== state.world.id) throw new Error("planning workspace crosses World boundary");
    if (!promotionIds.has(workspace.promotionId)) throw new Error("planning workspace references missing promotion");
    if (seenPromotions.has(workspace.promotionId)) throw new Error("promotion has duplicate planning workspaces");
    seenPromotions.add(workspace.promotionId);
    if (!Number.isSafeInteger(workspace.version) || workspace.version < 0) {
      throw new Error("planning workspace version is invalid");
    }
    const draftIds = new Set<string>();
    for (const draft of workspace.detailedShowDrafts) {
      if (draft.promotionId !== workspace.promotionId) throw new Error("show draft belongs to another promotion workspace");
      const draftId = normalizedId(draft.draftId, "draftId");
      if (draftIds.has(draftId)) throw new Error("planning workspace contains duplicate show draft IDs");
      draftIds.add(draftId);
    }
  }
}

export function validateDetailedShowDraft(state: WorldState, draft: DetailedShowDraft): DetailedShowDraft {
  const promotion = state.promotions.find((candidate) => candidate.id === draft.promotionId);
  if (!promotion) throw new Error(`promotion ${draft.promotionId} was not found`);

  const currentIndex = weekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const targetIndex = weekIndex(draft.targetDate, state.ruleset.weeksPerYear);
  const delta = targetIndex - currentIndex;
  if (delta < 0 || delta >= DETAILED_PLANNING_HORIZON_WEEKS) {
    throw new Error(`detailed show drafts must target the current PPW week or next ${DETAILED_PLANNING_HORIZON_WEEKS - 1} weeks`);
  }

  const draftId = normalizedId(draft.draftId, "draftId");
  if (draft.ticketStrategy !== null && !TICKET_STRATEGIES.has(draft.ticketStrategy)) {
    throw new Error(`unsupported ticket strategy ${String(draft.ticketStrategy)}`);
  }

  if (draft.marketId !== null && !state.markets.some((market) => market.id === draft.marketId)) {
    throw new Error(`market ${draft.marketId} was not found`);
  }
  if (draft.venueId !== null) {
    const venue = state.venues.find((candidate) => candidate.id === draft.venueId);
    if (!venue) throw new Error(`venue ${draft.venueId} was not found`);
    if (draft.marketId === null) throw new Error("a draft venue requires a selected market");
    if (venue.marketId !== draft.marketId) throw new Error("draft venue does not belong to the selected market");
  }

  if (!Array.isArray(draft.participantIds)) throw new Error("draft participantIds must be an array");
  const participantIds = new Set<Id>();
  for (const personId of draft.participantIds) {
    if (participantIds.has(personId)) throw new Error(`${personId} is selected more than once for the show draft`);
    const person = state.people.find((candidate) => candidate.id === personId);
    if (!person) throw new Error(`wrestler ${personId} was not found`);
    if (person.status === "RETIRED") throw new Error(`${personId} is retired and cannot be added to a future show draft`);
    participantIds.add(personId);
  }

  if (!Array.isArray(draft.matches)) throw new Error("draft matches must be an array");
  const usedParticipantIds = new Set<Id>();
  const draftMatchIds = new Set<string>();
  const matches = draft.matches.map((match) => {
    const validated = validateMatchDraft(match, participantIds, usedParticipantIds);
    if (draftMatchIds.has(validated.draftMatchId)) throw new Error("draft card contains duplicate match IDs");
    draftMatchIds.add(validated.draftMatchId);
    return validated;
  });

  if (!Array.isArray(draft.championshipAssignments)) throw new Error("draft championshipAssignments must be an array");
  const assignedMatches = new Set<string>();
  const assignedChampionships = new Set<Id>();
  const championshipAssignments = draft.championshipAssignments.map((assignment) => {
    const draftMatchId = normalizedId(assignment.draftMatchId, "championship draftMatchId");
    const match = matches.find((candidate) => candidate.draftMatchId === draftMatchId);
    if (!match) throw new Error(`championship assignment references missing draft match ${draftMatchId}`);
    const championship = state.championships?.find((candidate) => candidate.id === assignment.championshipId);
    if (!championship || championship.status !== "ACTIVE") throw new Error(`active championship ${assignment.championshipId} was not found`);
    if (championship.promotionId !== draft.promotionId) throw new Error("draft championship belongs to another promotion");
    if (championship.division !== match.type) throw new Error("draft championship division does not match draft match type");
    if (assignedMatches.has(draftMatchId)) throw new Error("one draft match cannot carry multiple championships");
    if (assignedChampionships.has(championship.id)) throw new Error("one championship cannot be assigned twice on a draft card");
    assignedMatches.add(draftMatchId);
    assignedChampionships.add(championship.id);
    return { draftMatchId, championshipId: championship.id };
  });

  return structuredClone({
    draftId,
    promotionId: draft.promotionId,
    targetDate: draft.targetDate,
    marketId: draft.marketId,
    venueId: draft.venueId,
    ticketStrategy: draft.ticketStrategy,
    participantIds: [...draft.participantIds],
    matches,
    championshipAssignments,
  });
}

function requireWorkspaceVersion(workspace: PromotionPlanningWorkspace | null, expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("expected plan version is invalid");
  const currentVersion = workspace?.version ?? 0;
  if (currentVersion !== expectedVersion) {
    throw new Error(`stale plan version: expected ${expectedVersion}, current ${currentVersion}`);
  }
}

export function upsertDetailedShowDraft(
  state: WorldState,
  planning: WorldPlanningState,
  promotionId: Id,
  expectedVersion: number,
  draft: DetailedShowDraft,
): PromotionPlanningWorkspace {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");
  if (draft.promotionId !== promotionId) throw new Error("show draft promotion does not match planning command promotion");

  const existing = planning.workspaces.find((candidate) => candidate.promotionId === promotionId) ?? null;
  requireWorkspaceVersion(existing, expectedVersion);
  const validatedDraft = validateDetailedShowDraft(state, draft);

  let workspace = existing;
  if (!workspace) {
    workspace = { worldId: state.world.id, promotionId, version: 0, detailedShowDrafts: [] };
    planning.workspaces.push(workspace);
  }

  const existingIndex = workspace.detailedShowDrafts.findIndex((candidate) => candidate.draftId === validatedDraft.draftId);
  if (existingIndex >= 0) workspace.detailedShowDrafts[existingIndex] = validatedDraft;
  else workspace.detailedShowDrafts.push(validatedDraft);

  workspace.detailedShowDrafts.sort((a, b) => {
    const aIndex = weekIndex(a.targetDate, state.ruleset.weeksPerYear);
    const bIndex = weekIndex(b.targetDate, state.ruleset.weeksPerYear);
    return aIndex - bIndex || a.targetDate.day - b.targetDate.day || a.draftId.localeCompare(b.draftId);
  });
  workspace.version += 1;
  return structuredClone(workspace);
}

export function removeDetailedShowDraft(
  planning: WorldPlanningState,
  promotionId: Id,
  expectedVersion: number,
  draftIdInput: string,
): PromotionPlanningWorkspace {
  const workspace = planning.workspaces.find((candidate) => candidate.promotionId === promotionId) ?? null;
  requireWorkspaceVersion(workspace, expectedVersion);
  if (!workspace) throw new Error(`promotion ${promotionId} has no planning workspace`);
  const draftId = normalizedId(draftIdInput, "draftId");
  const index = workspace.detailedShowDrafts.findIndex((candidate) => candidate.draftId === draftId);
  if (index < 0) throw new Error(`show draft ${draftId} was not found`);
  workspace.detailedShowDrafts.splice(index, 1);
  workspace.version += 1;
  return structuredClone(workspace);
}

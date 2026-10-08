import {
  activePromotionControlForPlayer,
  buildPlayerTeamHistoryView,
  createTagTeamCommand,
  type ApplicationWorldRepository,
  type PlayerTeamHistoryView,
} from "../../application/src/index.js";

export async function loadAlphaTeamHistory(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerTeamHistoryView> {
  return buildPlayerTeamHistoryView(await repository.load(worldId), playerId);
}


export interface AlphaCreateTagTeamRequest {
  requestId: string;
  expectedRevision: number;
  name: string;
  personIds: [string, string];
}

function requiredText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

export async function createAlphaTagTeam(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaCreateTagTeamRequest,
): Promise<PlayerTeamHistoryView> {
  const requestId = requiredText(request.requestId, "requestId", 220);
  const name = requiredText(request.name, "team name", 60);
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  if (!Array.isArray(request.personIds) || request.personIds.length !== 2) {
    throw new Error("personIds must contain exactly two wrestlers");
  }
  const personIds = request.personIds.map((personId) => requiredText(personId, "wrestler", 128)) as [string, string];

  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before creating tag teams");
    const receipt = aggregate.commands.receipts.find((candidate) => candidate.requestId === requestId);
    if (!receipt && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }
    createTagTeamCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId,
        worldId,
        playerId,
        commandType: "CREATE_TAG_TEAM",
        payload: { promotionId: control.promotionId, name, personIds },
      },
    );
  });

  return loadAlphaTeamHistory(repository, worldId, playerId);
}

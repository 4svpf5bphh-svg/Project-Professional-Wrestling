import {
  buildPlayerTeamHistoryView,
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

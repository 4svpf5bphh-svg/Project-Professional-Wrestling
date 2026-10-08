import {
  buildPlayerWorldResultsView,
  type ApplicationWorldRepository,
  type PlayerWorldResultsView,
} from "../../application/src/index.js";

export async function loadAlphaWorldResults(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  limit?: number,
): Promise<PlayerWorldResultsView> {
  return buildPlayerWorldResultsView(await repository.load(worldId), playerId, limit);
}

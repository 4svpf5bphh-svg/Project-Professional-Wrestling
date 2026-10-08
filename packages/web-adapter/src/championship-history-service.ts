import {
  buildPlayerChampionshipHistoryView,
  type ApplicationWorldRepository,
  type PlayerChampionshipHistoryView,
} from "../../application/src/index.js";

export async function loadAlphaChampionshipHistory(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerChampionshipHistoryView> {
  return buildPlayerChampionshipHistoryView(await repository.load(worldId), playerId);
}

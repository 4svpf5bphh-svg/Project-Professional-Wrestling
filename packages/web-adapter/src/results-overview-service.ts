import {
  buildPlayerShowHistory,
  buildPlayerWorldResultsView,
  type ApplicationWorldRepository,
  type PlayerShowHistoryView,
  type PlayerWorldResultsView,
} from "../../application/src/index.js";

export interface AlphaResultsOverviewView {
  promotion: PlayerShowHistoryView;
  world: PlayerWorldResultsView;
}

export async function loadAlphaResultsOverview(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  worldLimit?: number,
): Promise<AlphaResultsOverviewView> {
  const aggregate = await repository.load(worldId);
  return {
    promotion: buildPlayerShowHistory(aggregate, playerId),
    world: buildPlayerWorldResultsView(aggregate, playerId, worldLimit),
  };
}

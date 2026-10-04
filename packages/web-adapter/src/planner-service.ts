import {
  buildPlayerSixWeekPlannerView,
  type ApplicationWorldRepository,
  type PlayerSixWeekPlannerView,
} from "../../application/src/index.js";

export async function loadAlphaPlayerPlanner(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerSixWeekPlannerView> {
  return buildPlayerSixWeekPlannerView(await repository.load(worldId), playerId);
}

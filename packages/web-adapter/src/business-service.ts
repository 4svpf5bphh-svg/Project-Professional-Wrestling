import {
  buildPlayerBusinessView,
  type ApplicationWorldRepository,
  type PlayerBusinessView,
} from "../../application/src/index.js";

export async function loadAlphaPlayerBusiness(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerBusinessView> {
  return buildPlayerBusinessView(await repository.load(worldId), playerId);
}

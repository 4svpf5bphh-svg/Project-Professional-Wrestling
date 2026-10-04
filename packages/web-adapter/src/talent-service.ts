import {
  buildPlayerTalentManagementView,
  type ApplicationWorldRepository,
  type PlayerTalentManagementView,
} from "../../application/src/index.js";

export async function loadAlphaTalentSession(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerTalentManagementView> {
  return buildPlayerTalentManagementView(await repository.load(worldId), playerId);
}

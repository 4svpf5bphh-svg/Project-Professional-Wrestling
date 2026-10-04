import {
  buildPlayerIndustryView,
  type ApplicationWorldRepository,
  type PlayerIndustryView,
} from "../../application/src/index.js";

export async function loadAlphaIndustry(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerIndustryView> {
  return buildPlayerIndustryView(await repository.load(worldId), playerId);
}

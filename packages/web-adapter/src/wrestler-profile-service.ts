import {
  buildPlayerWrestlerProfileView,
  type ApplicationWorldRepository,
  type PlayerWrestlerProfileView,
} from "../../application/src/index.js";

export async function loadAlphaWrestlerProfile(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  personId: string,
): Promise<PlayerWrestlerProfileView> {
  const normalizedPersonId = personId.trim();
  if (!normalizedPersonId) throw new Error("personId must not be empty");
  if (normalizedPersonId.length > 256) throw new Error("personId is too long");
  return buildPlayerWrestlerProfileView(await repository.load(worldId), playerId, normalizedPersonId);
}

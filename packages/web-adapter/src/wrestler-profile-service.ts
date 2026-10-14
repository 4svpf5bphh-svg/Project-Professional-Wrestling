import {
  transactWithReceiptIds,
  activePromotionControlForPlayer,
  buildPlayerWrestlerProfileView,
  createWorldEngagementState,
  setWrestlerCreativeProfileCommand,
  type ApplicationWorldRepository,
  type PlayerWrestlerProfileView,
  type WrestlerCreativeFields,
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

export interface SaveAlphaWrestlerCreativeRequest {
  requestId: string;
  expectedRevision: number;
  personId: string;
  fields: WrestlerCreativeFields;
}

/** One promotion-specific, server-authoritative edit with optimistic revision and retry safety. */
export async function saveAlphaWrestlerCreative(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: SaveAlphaWrestlerCreativeRequest,
): Promise<PlayerWrestlerProfileView> {
  if (typeof request.requestId !== "string" || !request.requestId.trim()
    || request.requestId.length > 220) throw new Error("invalid creative save requestId");
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  if (typeof request.personId !== "string" || !request.personId.trim()
    || request.personId.length > 128) throw new Error("invalid wrestler ID");

  await transactWithReceiptIds(repository, worldId, null, [request.requestId], (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("take control of a promotion to edit presentation");
    const receipt = aggregate.commands.receipts.find((entry) => entry.requestId === request.requestId);
    if (!receipt && request.expectedRevision !== aggregate.runtime.revision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }
    aggregate.engagement ??= createWorldEngagementState(worldId);
    setWrestlerCreativeProfileCommand(
      aggregate.state,aggregate.engagement,aggregate.ownership,aggregate.commands,aggregate.runtime,{
        requestId:request.requestId,worldId,playerId,
        commandType:"SET_WRESTLER_CREATIVE_PROFILE",
        payload:{
          promotionId:control.promotionId,
          personId:request.personId.trim(),
          fields:request.fields,
        },
      },
    );
  });
  return loadAlphaWrestlerProfile(repository,worldId,playerId,request.personId.trim());
}

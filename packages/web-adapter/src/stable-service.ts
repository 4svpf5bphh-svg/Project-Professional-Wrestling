import {
  activePromotionControlForPlayer,
  addStableMemberCommand,
  buildPlayerStableRosterView,
  createStableCommand,
  disbandStableCommand,
  removeStableMemberCommand,
  type ApplicationWorldRepository,
  type PlayerStableRosterView,
} from "../../application/src/index.js";

type BaseRequest = { requestId: string; expectedRevision: number };
export type AlphaStableMutationRequest =
  | (BaseRequest & { action: "CREATE"; name: string; personIds: string[] })
  | (BaseRequest & { action: "ADD" | "REMOVE"; stableId: string; personId: string })
  | (BaseRequest & { action: "DISBAND"; stableId: string });

function textField(value: string, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(`${label} must contain 1–${maxLength} characters`);
  return text;
}
export async function loadAlphaStableRoster(
  repository: ApplicationWorldRepository, worldId: string, playerId: string,
): Promise<PlayerStableRosterView> {
  return buildPlayerStableRosterView(await repository.load(worldId), playerId);
}
export async function mutateAlphaStable(
  repository: ApplicationWorldRepository, worldId: string, playerId: string,
  request: AlphaStableMutationRequest,
): Promise<PlayerStableRosterView> {
  if (!["CREATE", "ADD", "REMOVE", "DISBAND"].includes(request.action)) {
    throw new Error("unsupported stable management action");
  }
  const requestId = textField(request.requestId, "requestId", 220);
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  const payload = request.action === "CREATE"
    ? {
        action: request.action,
        name: textField(request.name, "stable name", 60),
        personIds: Array.isArray(request.personIds)
          ? request.personIds.map((id) => textField(id, "personId", 128))
          : [] as string[],
      }
    : request.action === "ADD" || request.action === "REMOVE"
      ? {
          action: request.action,
          stableId: textField(request.stableId, "stableId", 128),
          personId: textField(request.personId, "personId", 128),
        }
      : {
          action: request.action,
          stableId: textField(request.stableId, "stableId", 128),
        };

  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before managing stables");
    const receipt = aggregate.commands.receipts.find((r) => r.requestId === requestId);
    if (!receipt && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }
    const base = { requestId, worldId, playerId };
    const args = [aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime] as const;
    if (payload.action === "CREATE") {
      createStableCommand(...args, {
        ...base, commandType: "CREATE_STABLE",
        payload: { promotionId: control.promotionId, name: payload.name, personIds: payload.personIds },
      });
    } else if (payload.action === "ADD") {
      addStableMemberCommand(...args, {
        ...base, commandType: "ADD_STABLE_MEMBER",
        payload: { promotionId: control.promotionId, stableId: payload.stableId, personId: payload.personId },
      });
    } else if (payload.action === "REMOVE") {
      removeStableMemberCommand(...args, {
        ...base, commandType: "REMOVE_STABLE_MEMBER",
        payload: { promotionId: control.promotionId, stableId: payload.stableId, personId: payload.personId },
      });
    } else {
      disbandStableCommand(...args, {
        ...base, commandType: "DISBAND_STABLE",
        payload: { promotionId: control.promotionId, stableId: payload.stableId },
      });
    }
  });
  return loadAlphaStableRoster(repository, worldId, playerId);
}

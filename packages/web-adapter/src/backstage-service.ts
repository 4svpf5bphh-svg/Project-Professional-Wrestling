import {
  buildPlayerBackstageView,
  respondBackstageConversationCommand,
  type PlayerBackstageView,
  type RespondBackstagePayload,
} from "../../application/src/backstage.js";
import type { ApplicationWorldRepository } from "../../application/src/world-aggregate.js";

export interface AlphaBackstageResponseRequest extends RespondBackstagePayload {
  requestId: string;
}

export async function loadAlphaBackstage(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerBackstageView> {
  return buildPlayerBackstageView(await repository.load(worldId), playerId);
}

export async function respondAlphaBackstage(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaBackstageResponseRequest,
): Promise<PlayerBackstageView> {
  await repository.transact(worldId, null, (aggregate) => {
    respondBackstageConversationCommand(aggregate, {
      worldId,
      playerId,
      requestId: request.requestId,
      commandType: "RESPOND_BACKSTAGE_CONVERSATION",
      payload: { conversationId: request.conversationId, response: request.response },
    });
  });
  return loadAlphaBackstage(repository, worldId, playerId);
}

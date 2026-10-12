import {
  buildPlayerBackstageView,
  respondBackstageConversationCommand,
  discussBackstageProgrammeCreativeCommand,
  type BackstageProgrammeCreativePayload,
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

export interface AlphaBackstageProgrammeCreativeRequest extends BackstageProgrammeCreativePayload {
  requestId: string;
}

/** Respond using existing Backstage storage and the command receipt.
 * The player never supplies a promotionId; it comes from authenticated ownership.
 */
export async function discussAlphaBackstageProgrammeCreative(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaBackstageProgrammeCreativeRequest,
): Promise<PlayerBackstageView> {
  await repository.transact(worldId, null, (aggregate) => {
    discussBackstageProgrammeCreativeCommand(aggregate, {
      worldId, playerId, requestId: request.requestId,
      commandType: "REQUEST_STANDING_PROGRAMME_CREATIVE_AGREEMENT",
      payload: {
        programmeId: request.programmeId,
        personId: request.personId,
        matchType: request.matchType,
        permittedOutcome: request.permittedOutcome,
        termWeeks: request.termWeeks,
      },
    });
  });
  return loadAlphaBackstage(repository, worldId, playerId);
}

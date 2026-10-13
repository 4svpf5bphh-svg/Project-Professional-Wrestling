import {
  buildPlayerShowHistory,
  buildPlayerWorldResultsView,
  type ApplicationWorldRepository,
  type PlayerShowHistoryView,
  type PlayerWorldResultsView,
  setPostShowFollowUpCommand,
  type SetPostShowFollowUpPayload,
} from "../../application/src/index.js";

export interface AlphaResultsOverviewView {
  promotion: PlayerShowHistoryView;
  world: PlayerWorldResultsView;
  revision: number;
  canChooseFollowUp: boolean;
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
    revision: aggregate.runtime.revision,
    canChooseFollowUp: aggregate.runtime.phase === "OPEN",
  };
}

// A post-show choice is a planning note, not a booked show or simulated result.
export async function saveAlphaPostShowFollowUp(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: { requestId: string; expectedRevision: number } & SetPostShowFollowUpPayload,
): Promise<AlphaResultsOverviewView> {
  if (!request.requestId || request.requestId.length > 220) throw new Error("invalid follow-up requestId");
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new Error("expectedRevision must be non-negative");
  }
  await repository.transact(worldId, null, (aggregate) => {
    const previous = aggregate.commands.receipts.find((item) => item.requestId === request.requestId);
    if (!previous && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error("World revision changed. Refresh Results and retry your decision.");
    }
    setPostShowFollowUpCommand(
      aggregate.state, aggregate.ownership, aggregate.planning,
      aggregate.commands, aggregate.runtime,
      {
        requestId: request.requestId, worldId, playerId,
        commandType: "SET_POST_SHOW_FOLLOW_UP",
        payload: {
          promotionId: request.promotionId, eventId: request.eventId, matchId: request.matchId,
          programmeId: request.programmeId, choice: request.choice,
        },
      },
    );
  });
  return loadAlphaResultsOverview(repository, worldId, playerId);
}

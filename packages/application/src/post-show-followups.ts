import type { Id, WorldState } from "../../domain/src/types.js";
import { actualMatchFinish } from "../../sim-core/src/match-finishes.js";
import { activeWorldMembership, playerControlsPromotion, type WorldOwnershipState } from "./ownership.js";
import { executeIdempotentCommand, type ApplicationCommandEnvelope, type WorldCommandState } from "./commands.js";
import type { PostShowFollowUp, PostShowFollowUpChoice, WorldPlanningState } from "./planning.js";
import type { WorldRuntimeState } from "./runtime.js";

export interface SetPostShowFollowUpPayload {
  promotionId: Id;
  eventId: Id;
  matchId: Id;
  programmeId: Id;
  choice: PostShowFollowUpChoice;
}

/** Only actual completed controversy linked unambiguously to a running
 * Programme can receive a follow-up. Never infer a rivalry from participants. */
export function eligiblePostShowProgrammeIds(state: WorldState, promotionId: Id, eventId: Id, matchId: Id): Id[] {
  const match = state.matches.find((candidate) =>
    candidate.id === matchId && candidate.eventId === eventId
    && candidate.promotionId === promotionId && candidate.status === "COMPLETED");
  const event = state.events.find((candidate) => candidate.id === eventId
    && candidate.promotionId === promotionId && candidate.status === "COMPLETED");
  if (!match || !event) return [];
  const current = state.world.currentDate;
  if (event.date.year > current.year
    || (event.date.year === current.year && event.date.week > current.week)
    || (event.date.year === current.year && event.date.week === current.week && event.date.day > current.day)) {
    return [];
  }
  const finish = actualMatchFinish(match);
  const isControversial = finish === "DISQUALIFICATION" || finish === "FOREIGN_OBJECT"
    || (finish === "PROTECTED_FINISH" && match.interference?.outcome === "SUCCESS");
  if (!isControversial) return [];
  const activities = state.programmeActivities ?? [];
  const programmes = state.programmes ?? [];
  return [...new Set(activities.filter((activity) =>
    activity.kind === "MATCH" && activity.matchId === matchId
    && activity.eventId === eventId && activity.promotionId === promotionId
    && programmes.some((programme) => programme.id === activity.programmeId
      && programme.status === "ACTIVE" && programme.promotionId === promotionId)
  ).map((activity) => activity.programmeId))].sort();
}

/** No match scheduling, storyline simulation or power advantage; this is an
 * owner-authored planning choice visible whenever the player returns. */
export function setPostShowFollowUpCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  commands: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<SetPostShowFollowUpPayload>,
): PostShowFollowUp {
  if (envelope.commandType !== "SET_POST_SHOW_FOLLOW_UP") throw new Error("unsupported follow-up command");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    const { promotionId, eventId, matchId, programmeId, choice } = envelope.payload;
    if (planning.worldId !== state.world.id || ownership.worldId !== state.world.id
      || !activeWorldMembership(ownership, envelope.playerId)
      || !playerControlsPromotion(ownership, envelope.playerId, promotionId)) {
      throw new Error("only the controlling promotion can plan this post-show follow-up");
    }
    if (choice !== "PURSUE_REMATCH" && choice !== "PLAN_RETALIATION" && choice !== "LET_STAND") {
      throw new Error("unsupported post-show follow-up choice");
    }
    const eligible = eligiblePostShowProgrammeIds(state, promotionId, eventId, matchId);
    if (eligible.length !== 1 || eligible[0] !== programmeId) {
      throw new Error("post-show follow-up requires one unambiguous active Programme linked to the completed controversial match");
    }
    planning.postShowFollowUps ??= [];
    const existing = planning.postShowFollowUps.find((candidate) =>
      candidate.promotionId === promotionId && candidate.matchId === matchId);
    const record: PostShowFollowUp = {
      promotionId, eventId, matchId, programmeId, choice, chosenAt: { ...state.world.currentDate },
    };
    if (existing) Object.assign(existing, record);
    else planning.postShowFollowUps.push(record);
    return structuredClone(record);
  });
}

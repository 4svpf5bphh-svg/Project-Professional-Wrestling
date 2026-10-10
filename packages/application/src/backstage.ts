import type { Id, PpwDate } from "../../domain/src/types.js";
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { comparePpwDates } from "../../sim-core/src/clock.js";
import {
  answerBackstageConversation,
  createWorldEngagementState,
  openBackstageConversation,
  type BackstageConversation,
  type BackstageResponse,
} from "./engagement.js";
import { talentExpectationEvidenceForContract } from "./talent-expectations.js";
import { executeIdempotentCommand, type ApplicationCommandEnvelope } from "./commands.js";
import { activePromotionControlForPlayer, activePromotionControls, activeWorldMembership } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK = 1;
export const BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION = 3;

/**
 * Conservative first trigger: four completed in-ring appearances under the same
 * contract, but zero appropriate featured slots within the recent 12-week view.
 * Does not confuse unused finite dates with a failed booking promise.
 *
 * Generation happens only in the persisted World resolution transaction and
 * may create at most one immutable concern per contract (no weekly repeats).
 * This is a conversation, not a morale modifier or scripted angle.
 */
export function generateBackstageConversations(aggregate: ApplicationWorldAggregate): number {
  const controls = activePromotionControls(aggregate.ownership);
  if (controls.length === 0) return 0;
  const engagement = aggregate.engagement ?? createWorldEngagementState(aggregate.state.world.id);
  aggregate.engagement = engagement;
  let created = 0;

  for (const control of controls) {
    const prior = engagement.backstageConversations.filter(
      (conversation) => conversation.promotionId === control.promotionId,
    );
    const unanswered = prior.filter((conversation) => conversation.status === "OPEN").length;
    const thisWeek = prior.filter((conversation) => (
      conversation.createdDate.year === aggregate.state.world.currentDate.year
      && conversation.createdDate.week === aggregate.state.world.currentDate.week
    )).length;
    const available = Math.min(
      BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK - thisWeek,
      BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION - unanswered,
    );
    if (available <= 0) continue;

    // Deterministic ordering prevents whatever order the contract array happens
    // to be stored in from deciding who gets the one weekly conversation slot.
    const candidates: BackstageConversation[] = [];
    for (const contract of activeContractsForPromotion(aggregate.state, control.promotionId)) {
      if (contract.roleExpectation !== "MAIN_EVENT" && contract.roleExpectation !== "UPPER_CARD") continue;
      const id = `backstage:role-usage:${contract.id}`;
      if (engagement.backstageConversations.some((conversation) => conversation.conversationId === id)) continue;
      const evidence = talentExpectationEvidenceForContract(aggregate.state, contract.id);
      if (!evidence || evidence.inRingShows < 4) continue;
      const featured = evidence.mainEventShows
        + (contract.roleExpectation === "UPPER_CARD" ? evidence.upperCardShows : 0);
      if (featured > 0) continue;
      candidates.push({
        conversationId: id,
        worldId: aggregate.state.world.id,
        promotionId: contract.promotionId,
        wrestlerId: contract.personId,
        sourceContractId: contract.id,
        kind: "ROLE_USAGE_CONCERN",
        createdDate: { ...aggregate.state.world.currentDate },
        status: "OPEN",
        response: null,
        responseDate: null,
        promisedRole: contract.roleExpectation,
        observedMatchShows: evidence.inRingShows,
        observedFeaturedShows: featured,
      });
    }
    candidates.sort((a, b) => (
      b.observedMatchShows - a.observedMatchShows
      || (a.promisedRole === "MAIN_EVENT" ? 0 : 1) - (b.promisedRole === "MAIN_EVENT" ? 0 : 1)
      || a.sourceContractId.localeCompare(b.sourceContractId)
    ));
    for (const candidate of candidates.slice(0, available)) {
      openBackstageConversation(engagement, candidate);
      created += 1;
    }
  }
  return created;
}

export interface PlayerBackstageConversation {
  conversationId: Id;
  wrestlerId: Id;
  wrestlerName: string;
  createdDate: PpwDate;
  status: "OPEN" | "ANSWERED";
  kind: "ROLE_USAGE_CONCERN";
  promisedRole: "MAIN_EVENT" | "UPPER_CARD";
  observedMatchShows: number;
  response: BackstageResponse | null;
  responseDate: PpwDate | null;
}

export interface PlayerBackstageView {
  worldId: Id;
  promotionId: Id | null;
  canRespond: boolean;
  openCount: number;
  conversations: PlayerBackstageConversation[];
}

export function buildPlayerBackstageView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerBackstageView {
  if (!activeWorldMembership(aggregate.ownership, playerId)) {
    throw new Error("player is not an active World member");
  }
  const promotionId = activePromotionControlForPlayer(aggregate.ownership, playerId)?.promotionId ?? null;
  const entries = (aggregate.engagement?.backstageConversations ?? [])
    .filter((entry) => entry.promotionId === promotionId && promotionId !== null)
    .sort((a, b) => (
      (a.status === "OPEN" ? 0 : 1) - (b.status === "OPEN" ? 0 : 1)
      || comparePpwDates(b.createdDate, a.createdDate, aggregate.state.ruleset.weeksPerYear)
      || b.conversationId.localeCompare(a.conversationId)
    ));
  const names = new Map(aggregate.state.people.map((person) => [person.id, person.name]));
  return {
    worldId: aggregate.state.world.id,
    promotionId,
    canRespond: aggregate.runtime.phase === "OPEN" && promotionId !== null,
    openCount: entries.filter((entry) => entry.status === "OPEN").length,
    conversations: entries.slice(0, 30).map((entry) => ({
      conversationId: entry.conversationId,
      wrestlerId: entry.wrestlerId,
      wrestlerName: names.get(entry.wrestlerId) ?? "Former roster member",
      createdDate: { ...entry.createdDate },
      status: entry.status,
      kind: entry.kind,
      promisedRole: entry.promisedRole,
      observedMatchShows: entry.observedMatchShows,
      response: entry.response,
      responseDate: entry.responseDate ? { ...entry.responseDate } : null,
    })),
  };
}

export interface RespondBackstagePayload {
  conversationId: string;
  response: BackstageResponse;
}

export function respondBackstageConversationCommand(
  aggregate: ApplicationWorldAggregate,
  envelope: ApplicationCommandEnvelope<RespondBackstagePayload>,
): BackstageConversation {
  if (envelope.commandType !== "RESPOND_BACKSTAGE_CONVERSATION") {
    throw new Error("expected RESPOND_BACKSTAGE_CONVERSATION");
  }
  if (envelope.worldId !== aggregate.state.world.id) throw new Error("Backstage command crosses World boundary");
  return executeIdempotentCommand(
    aggregate.commands,
    aggregate.runtime,
    envelope,
    aggregate.state.world.currentDate,
    () => {
      if (!activeWorldMembership(aggregate.ownership, envelope.playerId)) {
        throw new Error("player is not an active World member");
      }
      const control = activePromotionControlForPlayer(aggregate.ownership, envelope.playerId);
      if (!control) throw new Error("player does not control a promotion");
      const engagement = aggregate.engagement;
      const conversation = engagement?.backstageConversations.find((entry) => (
        entry.conversationId === envelope.payload.conversationId
      ));
      if (!conversation || conversation.promotionId !== control.promotionId) {
        throw new Error("Backstage conversation does not belong to your promotion");
      }
      return { ...answerBackstageConversation(
        engagement!,
        conversation.conversationId,
        envelope.payload.response,
        aggregate.state.world.currentDate,
      ) };
    },
  );
}

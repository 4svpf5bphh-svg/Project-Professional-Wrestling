import type { Id, PpwDate } from "../../domain/src/types.js";
import { activeContractsForPromotion, contractIsActive } from "../../sim-core/src/contracts.js";
import { addPpwWeeks, comparePpwDates } from "../../sim-core/src/clock.js";
import {
  answerBackstageConversation,
  createWorldEngagementState,
  openBackstageConversation,
  type BackstageConversation,
  type BackstageResponse,
  type BackstageBookingPromise,
} from "./engagement.js";
import { talentExpectationEvidenceForContract } from "./talent-expectations.js";
import { executeIdempotentCommand, type ApplicationCommandEnvelope } from "./commands.js";
import { activePromotionControlForPlayer, activePromotionControls, activeWorldMembership } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";
import type { GimmickArchetype } from "./wrestler-creative.js";
import { buildBackstageDialogue, type BackstageDialogue } from "./backstage-dialogue.js";

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
  /** Factual, non-authoritative line in a fictional voice; not an event or a booking decision. */
  dialogue: BackstageDialogue;
  createdDate: PpwDate;
  status: "OPEN" | "ANSWERED" | "NOTED";
  kind: "ROLE_USAGE_CONCERN" | "TAG_TEAM_PITCH" | "RIVALRY_PITCH" | "TEAM_MOMENT" | "GIMMICK_CHANGE_PITCH";
  promisedRole: "MAIN_EVENT" | "UPPER_CARD" | null;
  observedMatchShows: number;
  partnerPersonId: Id | null;
  partnerName: string | null;
  sharedTagMatches: number;
  averageCrowdResponse: number | null;
  rivalPersonId: Id | null;
  rivalName: string | null;
  sharedSinglesMatches: number;
  professionalTrustAtPitch: number | null;
  currentGimmickArchetype: GimmickArchetype | null;
  suggestedGimmickArchetype: GimmickArchetype | null;
  observedCrowdResponse: number | null;
  response: BackstageResponse | null;
  responseDate: PpwDate | null;
  canPromiseFeaturedBooking: boolean;
  promise: BackstageBookingPromise | null;
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
  const persons = new Map(aggregate.state.people.map((person) => [person.id, person]));
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
      dialogue: buildBackstageDialogue(entry, persons.get(entry.wrestlerId), names),
      createdDate: { ...entry.createdDate },
      status: entry.status,
      kind: entry.kind,
      promisedRole: entry.promisedRole,
      observedMatchShows: entry.observedMatchShows,
      partnerPersonId: entry.partnerPersonId ?? null,
      partnerName: entry.partnerPersonId ? names.get(entry.partnerPersonId) ?? null : null,
      sharedTagMatches: entry.sharedTagMatches ?? 0,
      averageCrowdResponse: entry.averageCrowdResponse ?? null,
      rivalPersonId: entry.rivalPersonId ?? null,
      rivalName: entry.rivalPersonId ? names.get(entry.rivalPersonId) ?? null : null,
      sharedSinglesMatches: entry.sharedSinglesMatches ?? 0,
      professionalTrustAtPitch: entry.professionalTrustAtPitch ?? null,
      currentGimmickArchetype: entry.currentGimmickArchetype ?? null,
      suggestedGimmickArchetype: entry.suggestedGimmickArchetype ?? null,
      observedCrowdResponse: entry.observedCrowdResponse ?? null,
      response: entry.response,
      responseDate: entry.responseDate ? { ...entry.responseDate } : null,
      canPromiseFeaturedBooking: entry.status === "OPEN"
        && canMakeFeaturedPromise(aggregate, entry),
      promise: entry.promise ? {
        ...entry.promise,
        madeDate: { ...entry.promise.madeDate },
        dueDate: { ...entry.promise.dueDate },
        resolvedDate: entry.promise.resolvedDate ? { ...entry.promise.resolvedDate } : null,
      } : null,
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
      let promise: BackstageBookingPromise | null = null;
      if (envelope.payload.response === "PROMISE_FEATURED_BOOKING") {
        if (conversation.kind !== "ROLE_USAGE_CONCERN" || !canMakeFeaturedPromise(aggregate, conversation)) {
          throw new Error("cannot promise a featured match without active dates and time to book");
        }
        if (conversation.promisedRole !== "MAIN_EVENT" && conversation.promisedRole !== "UPPER_CARD") {
          throw new Error("cannot promise a match without an agreed role");
        }
        const endDate = aggregate.state.contracts.find((entry) => entry.id === conversation.sourceContractId)!.endDate;
        const fourWeeks = addPpwWeeks(aggregate.state.world.currentDate, 4, aggregate.state.ruleset.weeksPerYear);
        fourWeeks.day = 7; // Promise covers all show days in the fourth PPW week.
        const dueDate = comparePpwDates(endDate, fourWeeks, aggregate.state.ruleset.weeksPerYear) < 0
          ? endDate : fourWeeks;
        promise = {
          kind: "FEATURED_MATCH",
          madeDate: { ...aggregate.state.world.currentDate },
          dueDate: { ...dueDate },
          expectedPosition: conversation.promisedRole,
          status: "PENDING",
          resolvedDate: null,
          fulfilledEventId: null,
        };
      }
      return { ...answerBackstageConversation(
        engagement!,
        conversation.conversationId,
        envelope.payload.response,
        aggregate.state.world.currentDate,
        promise,
      ) };
    },
  );
}


/**
 * The player must have at least one unused booked date and a full next PPW
 * week in which to fulfil their word. Neither an expired contract nor a
 * wrestler on another promotion's deal may be promised an automatic push.
 */
function canMakeFeaturedPromise(
  aggregate: ApplicationWorldAggregate,
  conversation: BackstageConversation,
): boolean {
  if (conversation.kind !== "ROLE_USAGE_CONCERN") return false;
  const state = aggregate.state;
  const contract = state.contracts.find((entry) => entry.id === conversation.sourceContractId);
  if (!contract || contract.promotionId !== conversation.promotionId
    || contract.personId !== conversation.wrestlerId
    || !contractIsActive(state, contract)
    || contract.dateEntitlement - contract.datesUsed < 1) return false;
  const nextWeek = addPpwWeeks(state.world.currentDate, 1, state.ruleset.weeksPerYear);
  return comparePpwDates(contract.endDate, nextWeek, state.ruleset.weeksPerYear) >= 0;
}

/**
 * Factual follow-through only. The player scripts the matches; World resolution
 * checks whether the promised placement actually took place under the correct
 * contract. No morale/trust, money, match finish, or stable membership changes.
 *
 * PENDING -> FULFILLED happens for a completed featured match. The deadline
 * resolves to NOT_DELIVERED only if there was a completed promotion show in
 * the window; with no opportunity it is NO_OPPORTUNITY. A completed result
 * is immutable and the pass is idempotent.
 */
export function evaluateBackstagePromises(aggregate: ApplicationWorldAggregate): number {
  const state = aggregate.state;
  const weeksPerYear = state.ruleset.weeksPerYear;
  let resolved = 0;
  for (const conversation of aggregate.engagement?.backstageConversations ?? []) {
    const promise = conversation.promise;
    if (!promise || promise.status !== "PENDING") continue;
    const shows = state.events
      .filter((event) => (
        event.promotionId === conversation.promotionId
        && event.status === "COMPLETED"
        && comparePpwDates(event.date, promise.madeDate, weeksPerYear) > 0
        && comparePpwDates(event.date, promise.dueDate, weeksPerYear) <= 0
      )).sort((a, b) => comparePpwDates(a.date, b.date, weeksPerYear) || a.id.localeCompare(b.id));
    let fulfilledId: Id | null = null;
    for (const event of shows) {
      // Contract-specific date usage prevents outside appearances, loans,
      // or another deal from satisfying a private booking commitment.
      if (!state.scheduledAppearances.some((entry) => entry.eventId === event.id
        && entry.personId === conversation.wrestlerId
        && entry.contractId === conversation.sourceContractId
        && entry.status === "COMPLETED")) continue;
      const card = state.matches
        .filter((match) => match.eventId === event.id && match.status === "COMPLETED")
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      if (card.length === 0) continue;
      const ownMatchIds = new Set(state.matchParticipants
        .filter((participant) => participant.eventId === event.id && participant.personId === conversation.wrestlerId)
        .map((participant) => participant.matchId));
      const bestIndex = card.reduce((best, match, idx) => ownMatchIds.has(match.id) ? idx : best, -1);
      if (bestIndex < 0) continue;
      const delivered = promise.expectedPosition === "MAIN_EVENT"
        ? bestIndex === card.length - 1
        : bestIndex >= Math.floor(card.length / 2);
      if (delivered) { fulfilledId = event.id; break; }
    }

    if (fulfilledId) {
      promise.status = "FULFILLED";
      promise.fulfilledEventId = fulfilledId;
      promise.resolvedDate = { ...state.world.currentDate };
      resolved += 1;
      continue;
    }
    if (comparePpwDates(state.world.currentDate, promise.dueDate, weeksPerYear) > 0) {
      promise.status = shows.length > 0 ? "NOT_DELIVERED" : "NO_OPPORTUNITY";
      promise.resolvedDate = { ...state.world.currentDate };
      resolved += 1;
    }
  }
  return resolved;
}

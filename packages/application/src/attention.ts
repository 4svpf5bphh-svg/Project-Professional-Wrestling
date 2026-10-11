import type { Id, PpwDate } from "../../domain/src/types.js";
import {
  activeContractsForPromotion,
  currentRosterPersonIds,
} from "../../sim-core/src/contracts.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { minimumViableRoster } from "../../sim-core/src/lifecycle.js";
import {
  activityForPlayer,
  attentionIsDismissed,
  opportunityVisibleToPlayer,
  type OpportunityCategory,
} from "./engagement.js";
import { activePromotionControlForPlayer } from "./ownership.js";
import { playerCurrentWeekPreparation, playerShowPlanningStatus } from "./planning-status.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export type AttentionCategory = "ACTION_REQUIRED" | "IMPORTANT" | "OPPORTUNITY" | "WATCHING" | "WORLD_NEWS";

export interface PlayerAttentionItem {
  attentionId: string;
  category: AttentionCategory;
  title: string;
  summary: string;
  deadline: PpwDate | null;
  deepLink: string | null;
  dismissible: boolean;
  sourceOpportunityCategory: OpportunityCategory | null;
}

function sameWeek(left: PpwDate, right: PpwDate): boolean {
  return left.year === right.year && left.week === right.week;
}

function weekIndex(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return ppwDateToWeekIndex(date, aggregate.state.ruleset.weeksPerYear);
}

function dateOrder(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return weekIndex(aggregate, date) * 7 + Math.max(1, Math.min(7, date.day));
}

function opportunityIsOpen(aggregate: ApplicationWorldAggregate, opensDate: PpwDate, closesDate: PpwDate): boolean {
  const current = weekIndex(aggregate, aggregate.state.world.currentDate);
  return current >= weekIndex(aggregate, opensDate) && current <= weekIndex(aggregate, closesDate);
}

function categoryRank(category: AttentionCategory): number {
  switch (category) {
    case "ACTION_REQUIRED": return 0;
    case "IMPORTANT": return 1;
    case "OPPORTUNITY": return 2;
    case "WATCHING": return 3;
    case "WORLD_NEWS": return 4;
  }
}

function pushIfVisible(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
  items: PlayerAttentionItem[],
  item: PlayerAttentionItem,
): void {
  if (item.dismissible && aggregate.engagement && attentionIsDismissed(aggregate.engagement, playerId, item.attentionId)) return;
  items.push(item);
}

function personName(aggregate: ApplicationWorldAggregate, personId: Id): string {
  return aggregate.state.people.find((person) => person.id === personId)?.name ?? "A roster member";
}

function contractFamilyLabel(family: string): string {
  return family.replaceAll("_", " ").toLowerCase();
}

function contractOfferRejectionSummary(reason: string | null): string {
  switch (reason) {
    case "offer utility below acceptance threshold":
      return "The proposed terms did not meet the wrestler’s expectations.";
    case "exclusive offer overlaps another signed contract":
    case "existing exclusive contract blocks outside work":
      return "An existing exclusive commitment prevented the deal.";
    case "service capacity exceeded":
      return "The wrestler’s existing schedule could not accommodate the proposed dates.";
    case "stronger exclusive offer accepted":
    case "overlaps accepted exclusive offer":
      return "The wrestler accepted a conflicting exclusive offer elsewhere.";
    default:
      return "The wrestler declined the proposed terms.";
  }
}

export function buildPlayerAttention(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerAttentionItem[] {
  const items: PlayerAttentionItem[] = [];
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const promotion = control
    ? aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId) ?? null
    : null;
  const currentDate = aggregate.state.world.currentDate;
  const activity = aggregate.engagement ? activityForPlayer(aggregate.engagement, playerId) : null;

  if (promotion) {
    const readiness = playerCurrentWeekPreparation(
      aggregate.state,
      aggregate.planning,
      aggregate.runtime,
      promotion.id,
    );
    if (readiness.status === "SHOW_REQUIRED") {
      items.push({
        attentionId: `required-show:${promotion.id}:Y${currentDate.year}:W${currentDate.week}`,
        category: "ACTION_REQUIRED",
        title: "This week’s show needs planning",
        summary: "No mandatory show is committed yet. Complete the show plan before the weekly lock or Routine Continuity will step in.",
        deadline: { ...currentDate, day: 7 },
        deepLink: "/planner",
        dismissible: false,
        sourceOpportunityCategory: null,
      });
    } else if (readiness.status === "CARD_REQUIRED") {
      items.push({
        attentionId: `required-card:${readiness.eventId ?? promotion.id}:Y${currentDate.year}:W${currentDate.week}`,
        category: "ACTION_REQUIRED",
        title: "This week’s card is incomplete",
        summary: "The show is committed but the match card still needs finishing before the weekly lock.",
        deadline: { ...currentDate, day: 7 },
        deepLink: "/card",
        dismissible: false,
        sourceOpportunityCategory: null,
      });
    }

    for (const conversation of aggregate.engagement?.backstageConversations ?? []) {
      if (conversation.promotionId !== promotion.id) continue;
      if (conversation.kind === "TEAM_MOMENT" && conversation.status === "NOTED") {
        const name = personName(aggregate, conversation.wrestlerId);
        const partner = conversation.partnerPersonId
          ? personName(aggregate, conversation.partnerPersonId) : "their partner";
        pushIfVisible(aggregate, playerId, items, {
          attentionId: `backstage-moment:${conversation.conversationId}`,
          category: "WATCHING",
          title: `${name} and ${partner} are clicking`,
          summary: `Their ${conversation.sharedTagMatches ?? 0} recent tag matches have gone over well. A positive locker-room development; no action required.`,
          deadline: null,
          deepLink: "/backstage",
          dismissible: true,
          sourceOpportunityCategory: null,
        });
        continue;
      }
      if (conversation.status !== "OPEN") continue;
      const name = personName(aggregate, conversation.wrestlerId);
      const isPitch = conversation.kind === "TAG_TEAM_PITCH";
      const isRivalry = conversation.kind === "RIVALRY_PITCH";
      const isGimmick = conversation.kind === "GIMMICK_CHANGE_PITCH";
      const isWorking = conversation.kind === "WORKING_PARTNERSHIP_CONCERN";
      const partner = conversation.partnerPersonId ? personName(aggregate, conversation.partnerPersonId) : "";
      const rival = conversation.rivalPersonId ? personName(aggregate, conversation.rivalPersonId) : "";
      items.push({
        attentionId: `backstage:${conversation.conversationId}`,
        category: "IMPORTANT",
        title: isPitch ? `${name} has a tag-team idea`
          : isRivalry ? `${name} pitches an on-screen rivalry`
          : isGimmick ? `${name} wants to refresh their gimmick`
          : isWorking ? `${name} wants to review a difficult tag partnership` : `${name} wants a word`,
        summary: isPitch
          ? `${name} suggests teaming with ${partner} after ${conversation.sharedTagMatches ?? 0} promising tag matches. You decide whether to explore it.`
          : isRivalry
            ? `${name} suggests a scripted feud with ${rival} after ${conversation.sharedSinglesMatches ?? 0} hot singles matches. You decide whether it happens.`
            : isGimmick
              ? `${name} wants to revisit their on-screen character after ${conversation.observedMatchShows} completed matches with modest crowd response. Any gimmick change is yours to make.`
              : isWorking
                ? `${name} has concerns after ${conversation.observedMatchShows} difficult completed tag shows with ${partner}. Discuss plans or consider a different pairing; nothing changes automatically.`
              : `${name} is questioning their ${conversation.promisedRole === "MAIN_EVENT" ? "main-event" : "upper-card"} booking. ${conversation.observedMatchShows} completed matches have not delivered a promised featured position. You can hear them out in Backstage.`,
        deadline: null,
        deepLink: "/backstage",
        dismissible: false,
        sourceOpportunityCategory: null,
      });
    }

    for (const conversation of aggregate.engagement?.backstageConversations ?? []) {
      if (conversation.promotionId !== promotion.id || !conversation.promise
        || conversation.promise.status === "PENDING") continue;
      const status = conversation.promise.status;
      const name = personName(aggregate, conversation.wrestlerId);
      const reason = conversation.promise.consequence?.reason ?? null;
      pushIfVisible(aggregate, playerId, items, {
        attentionId: `backstage-promise:${conversation.conversationId}:${status}`,
        category: "IMPORTANT",
        title: status === "FULFILLED"
          ? `You delivered on your word to ${name}`
          : status === "EXCUSED"
            ? `${name}'s booking promise was excused`
            : status === "NOT_DELIVERED"
              ? `Your booking promise to ${name} wasn't delivered`
              : `No eligible show took place for ${name}'s booking promise`,
        summary: status === "FULFILLED"
          ? "The promised featured match took place. Your commitment is recorded in Backstage."
          : status === "EXCUSED"
            ? reason === "WRESTLER_INJURED"
              ? "Injury affected the promise window. No booking breach or trust penalty was applied."
              : reason === "OWNER_STEWARDED"
                ? "AI stewardship covered the promotion. Your absence did not count as a broken promise."
                : "Contract or roster circumstances prevented a fair booking expectation. No penalty was applied."
            : status === "NOT_DELIVERED"
              ? "The player-authored featured match was not delivered despite completed shows. The small trust impact is recorded in Backstage."
              : "No completed show took place in the promise window; no breach or trust penalty was applied.",
        deadline: null,
        deepLink: "/backstage",
        dismissible: true,
        sourceOpportunityCategory: null,
      });
    }

    const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id);
    for (const draft of workspace?.detailedShowDrafts ?? []) {
      const status = playerShowPlanningStatus(aggregate.state, aggregate.planning, aggregate.runtime, promotion.id, draft.draftId);
      if (status.state === "AT_RISK") {
        items.push({
          attentionId: `at-risk-show:${promotion.id}:${draft.draftId}`,
          category: "ACTION_REQUIRED",
          title: "A reserved show is at risk",
          summary: status.riskReasons.length > 0
            ? status.riskReasons.join(" · ")
            : "A future committed show no longer passes live availability checks.",
          deadline: { ...draft.targetDate },
          deepLink: "/planner",
          dismissible: false,
          sourceOpportunityCategory: null,
        });
      } else if (status.state === "RESERVED" && weekIndex(aggregate, draft.targetDate) > weekIndex(aggregate, currentDate)) {
        pushIfVisible(aggregate, playerId, items, {
          attentionId: `watching-show:${promotion.id}:${draft.draftId}`,
          category: "WATCHING",
          title: `Future show reserved for Year ${draft.targetDate.year}, Week ${draft.targetDate.week}`,
          summary: "Venue and selected wrestler dates are currently reserved. PPW will keep revalidating the plan as the World changes.",
          deadline: { ...draft.targetDate },
          deepLink: "/planner",
          dismissible: true,
          sourceOpportunityCategory: null,
        });
      }
    }

    const activeContracts = activeContractsForPromotion(aggregate.state, promotion.id);
    const rosterPersonIds = new Set(currentRosterPersonIds(aggregate.state, promotion.id));
    const rosterFloor = minimumViableRoster(aggregate.state, promotion);
    if (rosterPersonIds.size < rosterFloor) {
      items.push({
        attentionId: `roster-shortage:${promotion.id}`,
        category: "ACTION_REQUIRED",
        title: "Roster is below minimum viability",
        summary: `${promotion.name} has ${rosterPersonIds.size} available contracted roster members against a minimum viable roster of ${rosterFloor}.`,
        deadline: null,
        deepLink: null,
        dismissible: false,
        sourceOpportunityCategory: null,
      });
    }

    const resolvedDate = aggregate.runtime.lastResolvedPpwDate;
    if (resolvedDate) {
      for (const offer of aggregate.state.contractOffers) {
        if (offer.promotionId !== promotion.id || offer.status === "PENDING") continue;
        if (!sameWeek(offer.submittedDate, resolvedDate)) continue;
        const name = personName(aggregate, offer.personId);
        const accepted = offer.status === "ACCEPTED";
        pushIfVisible(aggregate, playerId, items, {
          attentionId: `contract-offer-result:${offer.id}`,
          category: "IMPORTANT",
          title: accepted
            ? (offer.offerKind === "DATES_ADDENDUM" ? `${name} agreed to extra dates` : `${name} accepted your contract offer`)
            : (offer.offerKind === "DATES_ADDENDUM" ? `${name} declined extra dates` : `${name} rejected your contract offer`),
          summary: accepted
            ? `${offer.offerKind === "DATES_ADDENDUM"
              ? `${name} agreed to additional appearances under the existing non-exclusive contract. No renewal was required.`
              : `${name} accepted your ${contractFamilyLabel(offer.family)} offer for ${offer.family === "EXCLUSIVE" ? "unlimited appearances" : `${offer.dateEntitlement} dates`}. The contract is now signed.`}`
            : contractOfferRejectionSummary(offer.rejectionReason),
          deadline: null,
          deepLink: "/business",
          dismissible: true,
          sourceOpportunityCategory: null,
        });
      }
    }

    for (const contract of activeContracts) {
      if (contract.family === "ONE_OFF") continue;
      const datesRemaining = Math.max(0, contract.dateEntitlement - contract.datesUsed);
      if (contract.family === "LIMITED_NON_EXCLUSIVE" && datesRemaining === 0) {
        const name = personName(aggregate, contract.personId);
        items.push({
          attentionId: `contract-dates-exhausted:${contract.id}`,
          category: "ACTION_REQUIRED",
          title: `${name} has no contracted dates remaining`,
          summary: `${name}'s calendar contract is still active, but every purchased appearance has been used. Renegotiate now to buy more dates; an accepted addendum adds dates to the existing deal.`,
          deadline: null,
          deepLink: "/talent",
          dismissible: false,
          sourceOpportunityCategory: null,
        });
        continue;
      }
      const weeksRemaining = weekIndex(aggregate, contract.endDate) - weekIndex(aggregate, currentDate);
      if (weeksRemaining < 0 || weeksRemaining > aggregate.state.ruleset.renewalWindowWeeks) continue;
      const urgent = weeksRemaining <= 1;
      const name = personName(aggregate, contract.personId);
      pushIfVisible(aggregate, playerId, items, {
        attentionId: `contract-expiry:${contract.id}`,
        category: urgent ? "ACTION_REQUIRED" : "IMPORTANT",
        title: urgent ? `${name}’s contract decision is due` : `${name} is entering the renewal window`,
        summary: `${name}’s ${contractFamilyLabel(contract.family)} contract expires ${weeksRemaining === 0 ? "this PPW week" : `in ${weeksRemaining} PPW week${weeksRemaining === 1 ? "" : "s"}`}.`,
        deadline: { ...contract.endDate },
        deepLink: null,
        dismissible: !urgent,
        sourceOpportunityCategory: null,
      });
    }

    for (const injury of aggregate.state.injuries) {
      if (injury.status !== "ACTIVE" || !rosterPersonIds.has(injury.personId)) continue;
      const name = personName(aggregate, injury.personId);
      pushIfVisible(aggregate, playerId, items, {
        attentionId: `injury:${injury.id}`,
        category: "IMPORTANT",
        title: `${name} is injured`,
        summary: `${injury.severity.toLowerCase()} injury — ${injury.weeksRemaining} PPW week${injury.weeksRemaining === 1 ? "" : "s"} of recovery currently remain.`,
        deadline: null,
        deepLink: null,
        dismissible: true,
        sourceOpportunityCategory: null,
      });
    }

    if (aggregate.engagement) {
      for (const request of aggregate.engagement.stewardshipExitRequests) {
        if (request.promotionId !== promotion.id) continue;
        const contract = aggregate.state.contracts.find((candidate) => candidate.id === request.contractId);
        if (!contract || contract.status !== "SIGNED") continue;
        const name = personName(aggregate, request.personId);
        if (request.status === "OPEN") {
          items.push({
            attentionId: `release-request:${request.requestId}`,
            category: "ACTION_REQUIRED",
            title: `${name} has requested an early release`,
            summary: `Prolonged Stewardship and damaged Trust triggered a formal release request. Trust was ${request.trustAtRequest} when the request was raised.`,
            deadline: null,
            deepLink: null,
            dismissible: false,
            sourceOpportunityCategory: null,
          });
        } else if (request.status === "SETTLED") {
          items.push({
            attentionId: `release-agreed:${request.requestId}`,
            category: "ACTION_REQUIRED",
            title: `${name}’s agreed release is awaiting execution`,
            summary: "The release request has been agreed but the underlying contract is still signed. Complete the release before making conflicting plans.",
            deadline: null,
            deepLink: null,
            dismissible: false,
            sourceOpportunityCategory: null,
          });
        }
      }
    }

    if (promotion.financialDistress !== "HEALTHY") {
      pushIfVisible(aggregate, playerId, items, {
        attentionId: `financial-distress:${promotion.id}:${promotion.financialDistress}`,
        category: promotion.financialDistress === "CRISIS" ? "ACTION_REQUIRED" : "IMPORTANT",
        title: `Promotion finances are ${promotion.financialDistress.toLowerCase()}`,
        summary: promotion.runwayWeeks === null
          ? "The promotion is under financial pressure. Review costs and upcoming commitments."
          : `Current estimated runway is ${promotion.runwayWeeks.toFixed(1)} weeks.`,
        deadline: null,
        deepLink: null,
        dismissible: promotion.financialDistress !== "CRISIS",
        sourceOpportunityCategory: null,
      });
    }
  }

  if (activity?.status === "WARNING") {
    items.push({
      attentionId: `inactivity-warning:${playerId}`,
      category: "IMPORTANT",
      title: "Promotion stewardship warning",
      summary: "PPW has not seen recent player activity. Continued absence will move routine company operation into Stewardship so scarce talent cannot be warehoused.",
      deadline: null,
      deepLink: null,
      dismissible: false,
      sourceOpportunityCategory: null,
    });
  } else if (activity?.status === "STEWARDED") {
    items.push({
      attentionId: `stewarded:${playerId}`,
      category: "ACTION_REQUIRED",
      title: "Your promotion is under Stewardship",
      summary: "Staff are maintaining minimum continuity while the owner is inactive. Returning activity restores normal player status; competitive protection is not granted.",
      deadline: null,
      deepLink: null,
      dismissible: false,
      sourceOpportunityCategory: null,
    });
  }

  if (aggregate.engagement) {
    for (const opportunity of aggregate.engagement.opportunities) {
      if (!opportunityIsOpen(aggregate, opportunity.opensDate, opportunity.closesDate)) continue;
      if (!opportunityVisibleToPlayer(opportunity, playerId, control?.promotionId ?? null)) continue;
      pushIfVisible(aggregate, playerId, items, {
        attentionId: `opportunity:${opportunity.opportunityId}`,
        category: "OPPORTUNITY",
        title: opportunity.title,
        summary: opportunity.summary,
        deadline: { ...opportunity.closesDate },
        deepLink: opportunity.deepLink,
        dismissible: true,
        sourceOpportunityCategory: opportunity.category,
      });
    }
  }

  const resolvedDate = aggregate.runtime.lastResolvedPpwDate;
  if (promotion && resolvedDate) {
    const latestEvent = aggregate.state.events
      .filter((event) => event.promotionId === promotion.id && event.status === "COMPLETED" && sameWeek(event.date, resolvedDate))
      .sort((left, right) => right.date.day - left.date.day || right.id.localeCompare(left.id))[0];
    if (latestEvent) {
      pushIfVisible(aggregate, playerId, items, {
        attentionId: `show-resolved:${latestEvent.id}`,
        category: "WORLD_NEWS",
        title: "Your latest show has resolved",
        summary: `${latestEvent.attendance.toLocaleString("en-GB")} attended; the show finished ${latestEvent.netResult >= 0 ? "profitable" : "at a loss"}.`,
        deadline: null,
        deepLink: null,
        dismissible: true,
        sourceOpportunityCategory: null,
      });
    }
  }

  return items.sort((left, right) => {
    const category = categoryRank(left.category) - categoryRank(right.category);
    if (category !== 0) return category;
    if (left.deadline && right.deadline) return dateOrder(aggregate, left.deadline) - dateOrder(aggregate, right.deadline);
    if (left.deadline) return -1;
    if (right.deadline) return 1;
    return left.attentionId.localeCompare(right.attentionId);
  });
}

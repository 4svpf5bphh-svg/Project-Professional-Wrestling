import type { Id, PpwDate } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { humanWeekReadiness } from "../../sim-core/src/human-routine.js";
import {
  activityForPlayer,
  attentionIsDismissed,
  opportunityVisibleToPlayer,
  type OpportunityCategory,
} from "./engagement.js";
import { activePromotionControlForPlayer } from "./ownership.js";
import { playerShowPlanningStatus } from "./planning-status.js";
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

  if (promotion) {
    const readiness = humanWeekReadiness(aggregate.state, promotion.id);
    if (readiness.status === "SHOW_REQUIRED") {
      items.push({
        attentionId: `required-show:${promotion.id}:Y${currentDate.year}:W${currentDate.week}`,
        category: "ACTION_REQUIRED",
        title: "This week’s show needs planning",
        summary: "No mandatory show is committed yet. Complete the show plan before the weekly lock or Routine Continuity will step in.",
        deadline: { ...currentDate, day: 7 },
        deepLink: "#show-plan",
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
          deepLink: "#show-plan",
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
          deepLink: "#show-plan",
          dismissible: true,
          sourceOpportunityCategory: null,
        });
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

  const activity = aggregate.engagement ? activityForPlayer(aggregate.engagement, playerId) : null;
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
    if (left.deadline && right.deadline) return weekIndex(aggregate, left.deadline) - weekIndex(aggregate, right.deadline);
    if (left.deadline) return -1;
    if (right.deadline) return 1;
    return left.attentionId.localeCompare(right.attentionId);
  });
}

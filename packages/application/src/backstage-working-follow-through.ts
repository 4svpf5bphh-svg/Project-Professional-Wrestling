/**
 * Observe what the booker actually did after a private professional-working
 * concern. The recorded match is a fact, never acceptance, a promise, a trust
 * bonus/penalty, a morale change or an automatic team edit.
 */
import type { Id, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { eventsForWeek, matchesForEvent, participantsForMatch } from "../../sim-core/src/indexes.js";
import { activePromotionControlForPromotion } from "./ownership.js";
import type { BackstageConversation } from "./engagement.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

type FollowThrough = NonNullable<BackstageConversation["workingFollowThrough"]>;
const MAX_OBSERVATION_WEEKS = 26;

function isLaterThanReply(
  conversation: BackstageConversation, eventDate: PpwDate, matchId: Id, weeksPerYear: number,
): boolean {
  const answered = conversation.responseDate;
  if (!answered) return false;
  const comparison = comparePpwDates(eventDate, answered, weeksPerYear);
  // A same-date completed match may have existed before the conversation.
  // A recorded response baseline disambiguates it; for old saves, require later.
  return comparison > 0 || (comparison === 0
    && !!conversation.creativeBaseline
    && !conversation.creativeBaseline.existingCompletedMatchIds.includes(matchId));
}

function firstVerifiedNextMatch(
  state: WorldState, conversation: BackstageConversation,
): FollowThrough | null {
  const reply = conversation.response;
  const partner = conversation.partnerPersonId;
  if (!partner || !conversation.responseDate
    || (reply !== "DISCUSS_WORKING_PLAN" && reply !== "KEEP_WORKING_PAIR"
      && reply !== "CONSIDER_PARTNER_CHANGE")) return null;

  const weeksPerYear = state.ruleset.weeksPerYear;
  const from = ppwDateToWeekIndex(conversation.responseDate, weeksPerYear);
  const now = ppwDateToWeekIndex(state.world.currentDate, weeksPerYear);
  if (from > now || now - from > MAX_OBSERVATION_WEEKS) return null;
  // Single pass for eligible completed appearances. Do not rescan the entire
  // historical array for each match or each member of a century-old World.
  const relevantEvents = new Set<Id>();
  for (let week = from; week <= now; week++) {
    const date = { year: Math.floor(week / weeksPerYear) + 1, week: week % weeksPerYear + 1, day: 1 };
    for (const event of eventsForWeek(state, date)) {
      if (event.status === "COMPLETED" && event.promotionId === conversation.promotionId
        && comparePpwDates(event.date, state.world.currentDate, weeksPerYear) <= 0) {
        relevantEvents.add(event.id);
      }
    }
  }
  const appearances = new Map<Id, Set<string>>();
  for (const appearance of state.scheduledAppearances) {
    if (appearance.status !== "COMPLETED"
      || appearance.promotionId !== conversation.promotionId
      || !relevantEvents.has(appearance.eventId)) continue;
    const group = appearances.get(appearance.eventId) ?? new Set<string>();
    group.add(appearance.personId + "|" + appearance.contractId);
    appearances.set(appearance.eventId, group);
  }
  const possible: FollowThrough[] = [];
  for (let week = from; week <= now; week++) {
    const date = { year: Math.floor(week / weeksPerYear) + 1, week: week % weeksPerYear + 1, day: 1 };
    for (const event of eventsForWeek(state, date)) {
      if (event.status !== "COMPLETED" || event.promotionId !== conversation.promotionId
        || comparePpwDates(event.date, state.world.currentDate, weeksPerYear) > 0) continue;
      const contractedAppearance = appearances.get(event.id)?.has(
        conversation.wrestlerId + "|" + conversation.sourceContractId,
      );
      if (!contractedAppearance) continue;
      for (const match of matchesForEvent(state, event.id)) {
        if (match.status !== "COMPLETED" || match.type !== "TAG"
          || match.promotionId !== event.promotionId || match.eventId !== event.id
          || !Number.isFinite(match.executionQuality)
          || !isLaterThanReply(conversation, event.date, match.id, weeksPerYear)) continue;
        const people = participantsForMatch(state, match.id);
        if (people.length !== 4 || new Set(people.map(p => p.personId)).size !== 4
          || people.some(p => p.matchId !== match.id || p.eventId !== event.id)) continue;
        const ours = people.find(p => p.personId === conversation.wrestlerId);
        if (!ours) continue;
        const ourSide = people.filter(p => p.side === ours.side);
        const opponents = people.filter(p => p.side !== ours.side);
        if (ourSide.length !== 2 || opponents.length !== 2) continue;
        const otherId = ourSide.find(p => p.personId !== conversation.wrestlerId)?.personId;
        if (!otherId || (reply === "CONSIDER_PARTNER_CHANGE" ? otherId === partner : otherId !== partner)) continue;
        if (![...(appearances.get(event.id) ?? new Set<string>())].some(
          key => key.startsWith(otherId + "|"),
        )) continue;
        possible.push({
          kind: reply === "CONSIDER_PARTNER_CHANGE" ? "ALTERNATE_PARTNER_APPEARED" : "PARTNERS_REBOOKED",
          evidenceMatchId: match.id, counterpartPersonId: otherId,
          executionQuality: Math.round(match.executionQuality * 10) / 10,
          happenedDate: { ...event.date },
          recordedDate: { ...state.world.currentDate },
        });
      }
    }
  }
  return possible.sort((a,b) =>
    comparePpwDates(a.happenedDate,b.happenedDate,weeksPerYear)
    || a.evidenceMatchId.localeCompare(b.evidenceMatchId))[0] ?? null;
}

/** One immutable factual result per answered concern, inside persisted World Lock. */
export function assessWorkingConcernFollowThrough(aggregate: ApplicationWorldAggregate): number {
  let recorded = 0;
  for (const conversation of aggregate.engagement?.backstageConversations ?? []) {
    if (conversation.kind !== "WORKING_PARTNERSHIP_CONCERN"
      || conversation.status !== "ANSWERED" || conversation.workingFollowThrough
      || !conversation.responseDate) continue;
    // Never imply a player took authorship after their promotion lost control.
    if (!activePromotionControlForPromotion(aggregate.ownership, conversation.promotionId)) continue;
    const result = firstVerifiedNextMatch(aggregate.state, conversation);
    if (!result) continue;
    conversation.workingFollowThrough = result;
    recorded++;
  }
  return recorded;
}

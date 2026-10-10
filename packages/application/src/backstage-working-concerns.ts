/**
 * Evidence-based private conversation after a genuine, World-locked tag-work
 * confidence decline. No wrestler can automatically demand a breakup or rewrite
 * a player's scripted show. Speaking is not assigning blame to either partner.
 */
import type { Id } from "../../domain/src/types.js";
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import {
  WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE,
} from "./working-relationship-evolution.js";
import {
  createWorldEngagementState, openBackstageConversation, type BackstageConversation,
} from "./engagement.js";
import {
  BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION, BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK,
} from "./backstage.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export function generateWorkingPartnershipConcerns(aggregate: ApplicationWorldAggregate): number {
  const state = aggregate.state;
  const controls = activePromotionControls(aggregate.ownership);
  if (controls.length === 0) return 0;
  const currentWeek = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  // The ledger entry is written in the resolved week; World resolution has
  // already advanced to the following week before this generator executes.
  const justResolvedWeek = currentWeek - 1;
  if (justResolvedWeek < 0) return 0;
  const events = new Map(state.events.map(e => [e.id, e]));
  const matches = new Map(state.matches.map(m => [m.id, m]));
  const participants = new Map<Id, typeof state.matchParticipants>();
  let created = 0;
  const engagement = aggregate.engagement ?? createWorldEngagementState(state.world.id);

  for (const control of controls) {
    const promotionId = control.promotionId;
    const existing = engagement.backstageConversations.filter(c => c.promotionId === promotionId);
    const openedThisWeek = existing.filter(c =>
      ppwDateToWeekIndex(c.createdDate, state.ruleset.weeksPerYear) === currentWeek).length;
    const open = existing.filter(c => c.status === "OPEN").length;
    const remaining = Math.min(
      BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION - open,
      BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK - openedThisWeek,
    );
    if (remaining <= 0) continue;
    const eligible = new Map(activeContractsForPromotion(state, promotionId)
      .filter(c => c.datesUsed < c.dateEntitlement)
      .filter(c => state.people.some(p => p.id === c.personId && p.status === "ACTIVE"))
      .map(c => [c.personId, c]));
    const candidates: Array<{ ledgerId: Id; conversation: BackstageConversation }> = [];

    for (let i = state.ledger.length - 1; i >= 0; i--) {
      const entry = state.ledger[i]!;
      const age = currentWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
      if (age > 1) break;
      if (age !== 1 || entry.type !== WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE) continue;
      const [a, b] = entry.entityIds;
      if (!a || !b || a === b || !eligible.has(a) || !eligible.has(b)) continue;
      const sourceMatchId = entry.payload.sourceMatchId;
      const loss = entry.payload.trustDelta;
      const shows = entry.payload.verifiedShows;
      if (typeof sourceMatchId !== "string" || typeof loss !== "number" || loss >= 0
        || typeof shows !== "number" || !Number.isSafeInteger(shows) || shows < 3) continue;
      const match = matches.get(sourceMatchId);
      const event = match ? events.get(match.eventId) : undefined;
      if (!match || !event || match.promotionId !== promotionId || event.promotionId !== promotionId
        || event.status !== "COMPLETED" || match.status !== "COMPLETED" || match.type !== "TAG"
        || match.executionQuality > 40
        || ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) !== justResolvedWeek) continue;
      let people = participants.get(match.id);
      if (!people) {
        people = state.matchParticipants.filter(p => p.matchId === match.id);
        participants.set(match.id, people);
      }
      if (people.length !== 4 || new Set(people.map(p => p.personId)).size !== 4
        || people.some(p => p.eventId !== event.id)) continue;
      const sameSide = ["A", "B"].some(side => {
        const sidePeople = people!.filter(p => p.side === side);
        return sidePeople.length === 2 && sidePeople.some(p => p.personId === a)
          && sidePeople.some(p => p.personId === b);
      });
      if (!sameSide) continue;
      const [first, second] = [a, b].sort();
      const id = `backstage:working-strain:${promotionId}:${first}:${second}:year${entry.date.year}`;
      if (existing.some(c => c.conversationId === id)) continue;
      const relationship = (state.wrestlerRelationships ?? []).find(r =>
        r.personAId === first && r.personBId === second);
      candidates.push({
        ledgerId: entry.id,
        conversation: {
          conversationId: id, worldId: state.world.id, promotionId,
          wrestlerId: first!, partnerPersonId: second!,
          sourceContractId: eligible.get(first!)!.id,
          kind: "WORKING_PARTNERSHIP_CONCERN",
          createdDate: { ...state.world.currentDate },
          status: "OPEN", response: null, responseDate: null,
          promisedRole: null, observedMatchShows: shows, observedFeaturedShows: 0,
          professionalTrustAtPitch: relationship?.professionalTrust ?? null,
          tagFamiliarityAtPitch: relationship?.familiarity ?? null,
          workingSourceLedgerId: entry.id,
          workingTrustDelta: loss,
        },
      });
    }
    candidates.sort((x, y) => x.conversation.conversationId.localeCompare(y.conversation.conversationId));
    for (const { conversation } of candidates.slice(0, remaining)) {
      openBackstageConversation(engagement, conversation);
      created++;
    }
  }
  if (created > 0) aggregate.engagement = engagement;
  return created;
}

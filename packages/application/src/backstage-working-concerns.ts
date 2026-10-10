/**
 * Evidence-based private conversation after a genuine, World-locked tag-work
 * confidence decline. No wrestler can automatically demand a breakup or rewrite
 * a player's scripted show. Speaking is not assigning blame to either partner.
 */
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { addPpwWeeks, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { eventsForWeek, matchesForEvent, participantsForMatch } from "../../sim-core/src/indexes.js";
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
import { chooseCreativePitchSpeaker } from "./wrestler-creative-interests.js";
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
  // The only eligible source match is from the previous resolved World week.
  // Indexed bounded retrieval keeps Backstage efficient in century-long Worlds.
  const previous = addPpwWeeks(state.world.currentDate, -1, state.ruleset.weeksPerYear);
  const resolvedEvents = eventsForWeek(state, previous).filter(event =>
    event.status === "COMPLETED"
    && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) === justResolvedWeek,
  );
  const events = new Map(resolvedEvents.map(event => [event.id, event]));
  const matches = new Map(resolvedEvents.flatMap(event =>
    [...matchesForEvent(state, event.id)].map(match => [match.id, match] as const)));
  const byPerson = new Map(state.people.map(person => [person.id, person]));
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
    const candidates: Array<{
      conversation: BackstageConversation;
      /** Credible renewed requests take precedence when weekly capacity is tight. */
      priority: number;
    }> = [];

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
      const people = participantsForMatch(state, match.id);
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
      // An outstanding discussion should not become a second demand a year
      // later. If a prior discussion was answered, remember the *same pair*
      // regardless of which wrestler originally did the talking.
      const priorPair = existing.filter(c =>
        c.kind === "WORKING_PARTNERSHIP_CONCERN"
        && [c.wrestlerId, c.partnerPersonId].includes(first)
        && [c.wrestlerId, c.partnerPersonId].includes(second)
      ).sort((left, right) =>
        ppwDateToWeekIndex(right.createdDate, state.ruleset.weeksPerYear)
        - ppwDateToWeekIndex(left.createdDate, state.ruleset.weeksPerYear)
        || right.conversationId.localeCompare(left.conversationId));
      if (priorPair.some(c => c.status === "OPEN")) continue;
      const lastAnswered = priorPair.find(c => c.status === "ANSWERED") ?? null;
      // For an original concern, fictional team-oriented motivation determines
      // who asks for a conversation; not the alphabetical wrestler ID.
      // Keep the historical speaker for a repeat to preserve a natural voice.
      const firstPerson = byPerson.get(first!);
      const secondPerson = byPerson.get(second!);
      if (!firstPerson || !secondPerson) continue;
      const speaker = lastAnswered
        ? (lastAnswered.wrestlerId === first ? first! : second!)
        : chooseCreativePitchSpeaker(firstPerson, secondPerson, "TEAM_PARTNERSHIPS").id;
      const partner = speaker === first ? second! : first!;
      const relationship = (state.wrestlerRelationships ?? []).find(r =>
        r.personAId === first && r.personBId === second);
      if (!relationship) continue; // No invented interpersonal state for an orphaned ledger record.
      candidates.push({
        // Concrete repeated poor match evidence plus verified history, not
        // speculative personal grudges or a booker's optional conversation.
        priority: lastAnswered
          ? lastAnswered.workingFollowThrough ? 2 : 1
          : 0,
        conversation: {
          conversationId: id, worldId: state.world.id, promotionId,
          wrestlerId: speaker, partnerPersonId: partner,
          sourceContractId: eligible.get(speaker)!.id,
          kind: "WORKING_PARTNERSHIP_CONCERN",
          createdDate: { ...state.world.currentDate },
          status: "OPEN", response: null, responseDate: null,
          promisedRole: null, observedMatchShows: shows, observedFeaturedShows: 0,
          professionalTrustAtPitch: relationship.professionalTrust,
          tagFamiliarityAtPitch: relationship.familiarity,
          workingSourceLedgerId: entry.id,
          workingTrustDelta: loss,
        },
      });
    }
    candidates.sort((x, y) => y.priority - x.priority
      || (x.conversation.professionalTrustAtPitch ?? 100)
        - (y.conversation.professionalTrustAtPitch ?? 100)
      || x.conversation.conversationId.localeCompare(y.conversation.conversationId));
    for (const { conversation } of candidates.slice(0, remaining)) {
      openBackstageConversation(engagement, conversation);
      created++;
    }
  }
  if (created > 0) aggregate.engagement = engagement;
  return created;
}

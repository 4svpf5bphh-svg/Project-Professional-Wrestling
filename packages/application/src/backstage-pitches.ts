/**
 * Positive Backstage pitch based on real completed tag matches. There are no
 * invented acceptance rolls: a booker must create any team independently.
 */
import type { Id } from "../../domain/src/types.js";
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { createWorldEngagementState, openBackstageConversation, type BackstageConversation } from "./engagement.js";
import { BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION, BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK } from "./backstage.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export function generateTagTeamPitches(aggregate: ApplicationWorldAggregate): number {
  const state = aggregate.state;
  const controls = activePromotionControls(aggregate.ownership);
  if (controls.length === 0) return 0;
  const engagement = aggregate.engagement ?? createWorldEngagementState(state.world.id);
  aggregate.engagement = engagement;
  const currentWeek = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const events = new Map(state.events.filter((event) => (
    event.status === "COMPLETED"
    && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) >= currentWeek - 12
    && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) <= currentWeek
  )).map((event) => [event.id, event]));
  const participants = new Map<Id, typeof state.matchParticipants>();
  for (const entry of state.matchParticipants) {
    if (!events.has(entry.eventId)) continue;
    const group = participants.get(entry.matchId) ?? [];
    group.push(entry);
    participants.set(entry.matchId, group);
  }

  let created = 0;
  for (const control of controls) {
    const previous = engagement.backstageConversations.filter((c) => c.promotionId === control.promotionId);
    const unanswered = previous.filter((c) => c.status === "OPEN").length;
    const thisWeek = previous.filter((c) => (
      c.createdDate.year === state.world.currentDate.year && c.createdDate.week === state.world.currentDate.week
    )).length;
    const capacity = Math.min(
      BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION - unanswered,
      BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK - thisWeek,
    );
    if (capacity <= 0) continue;

    const eligible = new Map(activeContractsForPromotion(state, control.promotionId)
      .filter((contract) => contract.datesUsed < contract.dateEntitlement)
      .map((contract) => [contract.personId, contract]));
    const pairStats = new Map<string, { people: [Id, Id]; count: number; crowd: number }>();
    for (const match of state.matches) {
      if (match.type !== "TAG" || match.status !== "COMPLETED"
        || match.promotionId !== control.promotionId || !events.has(match.eventId)
        || !Number.isFinite(match.crowdResponse)) continue;
      const sides = new Map<string, Id[]>();
      for (const participant of participants.get(match.id) ?? []) {
        if (!eligible.has(participant.personId)) continue;
        const side = sides.get(participant.side) ?? [];
        side.push(participant.personId);
        sides.set(participant.side, side);
      }
      for (const side of sides.values()) {
        if (side.length !== 2 || side[0] === side[1]) continue;
        const people = [...side].sort() as [Id, Id];
        const key = people.join("|");
        const stats = pairStats.get(key) ?? { people, count: 0, crowd: 0 };
        stats.count++;
        stats.crowd += match.crowdResponse;
        pairStats.set(key, stats);
      }
    }

    const candidates: Array<{ record: BackstageConversation; crowd: number }> = [];
    for (const stats of pairStats.values()) {
      const [a,b] = stats.people;
      const average = Math.round((stats.crowd / stats.count) * 10) / 10;
      if (stats.count < 2 || average < 65) continue;
      const existingTeam = (state.teams ?? []).some((team) => {
        if (team.status !== "ACTIVE") return false;
        const ids = new Set((state.teamMemberships ?? []).filter((membership) => (
          membership.teamId === team.id && membership.active && membership.leftDate === null
        )).map((membership) => membership.personId));
        return ids.has(a) && ids.has(b);
      });
      if (existingTeam) continue;
      const id = `backstage:tag-pitch:${control.promotionId}:${a}:${b}`;
      if (previous.some((conversation) => conversation.conversationId === id)) continue;
      candidates.push({ crowd: average, record: {
        conversationId: id, worldId: state.world.id, promotionId: control.promotionId,
        wrestlerId: a, sourceContractId: eligible.get(a)!.id,
        partnerPersonId: b, sharedTagMatches: stats.count, averageCrowdResponse: average,
        kind: "TAG_TEAM_PITCH", createdDate: { ...state.world.currentDate },
        status: "OPEN", response: null, responseDate: null,
        promisedRole: null, observedMatchShows: 0, observedFeaturedShows: 0,
      } });
    }
    candidates.sort((a,b) => b.crowd - a.crowd
      || (b.record.sharedTagMatches ?? 0) - (a.record.sharedTagMatches ?? 0)
      || a.record.conversationId.localeCompare(b.record.conversationId));
    for (const candidate of candidates.slice(0, capacity)) {
      openBackstageConversation(engagement, candidate.record);
      created++;
    }
  }
  return created;
}

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
import { chooseCreativePitchSpeaker, wrestlerCreativeInterestScores } from "./wrestler-creative-interests.js";

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
  const validAppearances = new Map<Id, Set<string>>();
  for (const appearance of state.scheduledAppearances) {
    if (appearance.status !== "COMPLETED" || !events.has(appearance.eventId)) continue;
    const present = validAppearances.get(appearance.eventId) ?? new Set<string>();
    present.add(appearance.personId + "|" + appearance.contractId);
    validAppearances.set(appearance.eventId, present);
  }
  const people = new Map(state.people.map(person=>[person.id,person]));
  const keyForPair = (a: Id, b: Id): string => [a,b].sort().join("|");
  const relations = new Map((state.wrestlerRelationships ?? [])
    .map(r=>[keyForPair(r.personAId,r.personBId),r]));
  const familiarity = new Map(state.workingChemistry.filter(r=>r.context==="TAG")
    .map(r=>[keyForPair(r.personAId,r.personBId),r]));
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
      .filter((contract) => contract.datesUsed < contract.dateEntitlement
        && people.get(contract.personId)?.status === "ACTIVE")
      .map((contract) => [contract.personId, contract]));
    const pairStats = new Map<string, { people: [Id, Id]; count: number; crowd: number }>();
    for (const match of state.matches) {
      if (match.type !== "TAG" || match.status !== "COMPLETED"
        || match.promotionId !== control.promotionId || !events.has(match.eventId)
        || !Number.isFinite(match.crowdResponse)) continue;
      const sides = new Map<string, Id[]>();
      // Count the *entire recorded side*, not merely the subset still eligible.
      // In particular, two roster wrestlers among three participants must not
      // become a fictional two-person team just because the third is unavailable.
      for (const participant of participants.get(match.id) ?? []) {
        const side = sides.get(participant.side) ?? [];
        side.push(participant.personId);
        sides.set(participant.side, side);
      }
      for (const side of sides.values()) {
        if (side.length !== 2 || side[0] === side[1]) continue;
        if (!side.every(personId=>{
          const contract=eligible.get(personId);
          return contract && validAppearances.get(match.eventId)?.has(personId + "|" + contract.id);
        })) continue;
        const people = [...side].sort() as [Id, Id];
        const key = people.join("|");
        const stats = pairStats.get(key) ?? { people, count: 0, crowd: 0 };
        stats.count++;
        stats.crowd += match.crowdResponse;
        pairStats.set(key, stats);
      }
    }

    const candidates: Array<{ record: BackstageConversation; crowd: number; pitchPriority: number }> = [];
    for (const stats of pairStats.values()) {
      const [a,b] = stats.people;
      const key=keyForPair(a,b);
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
      const wrestlerA=people.get(a)!;
      const wrestlerB=people.get(b)!;
      const proposer=chooseCreativePitchSpeaker(wrestlerA,wrestlerB,"TEAM_PARTNERSHIPS");
      const otherId=proposer.id===a?b:a;
      const relation=relations.get(key);
      const tagChemistry=familiarity.get(key);
      const interest=wrestlerCreativeInterestScores(proposer).TEAM_PARTNERSHIPS;
      // Actual chemistry/trust only supplies evidence and priority. A missing
      // relationship is unknown, not a fabricated low or high relationship.
      const priority=average + interest*.12
        + (relation?.professionalTrust ?? 0)*.075
        + (tagChemistry?.familiarity ?? 0)*.04;
      candidates.push({ crowd: average, pitchPriority:priority, record: {
        conversationId: id, worldId: state.world.id, promotionId: control.promotionId,
        wrestlerId: proposer.id, sourceContractId: eligible.get(proposer.id)!.id,
        partnerPersonId: otherId, sharedTagMatches: stats.count, averageCrowdResponse: average,
        creativeInterestAtPitch:"TEAM_PARTNERSHIPS",
        ...(relation ? {professionalTrustAtPitch: Math.round(relation.professionalTrust*10)/10} : {}),
        ...(tagChemistry ? {tagFamiliarityAtPitch: Math.round(tagChemistry.familiarity*10)/10} : {}),
        kind: "TAG_TEAM_PITCH", createdDate: { ...state.world.currentDate },
        status: "OPEN", response: null, responseDate: null,
        promisedRole: null, observedMatchShows: 0, observedFeaturedShows: 0,
      } });
    }
    candidates.sort((a,b) => b.pitchPriority - a.pitchPriority
      || b.crowd - a.crowd
      || (b.record.sharedTagMatches ?? 0) - (a.record.sharedTagMatches ?? 0)
      || a.record.conversationId.localeCompare(b.record.conversationId));
    for (const candidate of candidates.slice(0, capacity)) {
      openBackstageConversation(engagement, candidate.record);
      created++;
    }
  }
  return created;
}

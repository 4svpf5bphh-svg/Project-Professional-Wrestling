/**
 * Optional good news, not a demand. Only an established active team with
 * positive professional trust, existing tag familiarity, and two verified
 * recent high-response matches can produce one note per PPW year.
 */
import type { Id } from "../../domain/src/types.js";
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { createWorldEngagementState, openBackstageConversation, type BackstageConversation } from "./engagement.js";
import { BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION, BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK } from "./backstage.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export function generateTeamMoments(aggregate: ApplicationWorldAggregate): number {
  const state = aggregate.state;
  const controls = activePromotionControls(aggregate.ownership);
  if (controls.length === 0) return 0;
  const engagement = aggregate.engagement ?? createWorldEngagementState(state.world.id);
  aggregate.engagement = engagement;
  const week = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const recent = new Set(state.events.filter((event) => event.status === "COMPLETED"
    && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) >= week - 12
    && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) <= week
  ).map((event) => event.id));
  const appearances = new Map<Id, Set<string>>();
  for (const entry of state.scheduledAppearances) {
    if (!recent.has(entry.eventId) || entry.status !== "COMPLETED") continue;
    const pairs = appearances.get(entry.eventId) ?? new Set<string>();
    pairs.add(entry.personId + "|" + entry.contractId);
    appearances.set(entry.eventId, pairs);
  }
  const matchPeople = new Map<Id, typeof state.matchParticipants>();
  for (const entry of state.matchParticipants) {
    if (!recent.has(entry.eventId)) continue;
    const list = matchPeople.get(entry.matchId) ?? [];
    list.push(entry);
    matchPeople.set(entry.matchId, list);
  }
  const pairKey = (a: Id, b: Id) => [a,b].sort().join("|");
  const relationships = new Map((state.wrestlerRelationships ?? [])
    .map((relation) => [pairKey(relation.personAId, relation.personBId), relation]));
  const chemistry = new Map(state.workingChemistry.filter((item) => item.context === "TAG")
    .map((item) => [pairKey(item.personAId, item.personBId), item]));
  let created = 0;
  for (const control of controls) {
    const prior = engagement.backstageConversations.filter((entry) => entry.promotionId === control.promotionId && entry.kind !== "PROGRAMME_CREATIVE_AGREEMENT");
    const openCount = prior.filter((entry) => entry.status === "OPEN").length;
    const weekCount = prior.filter((entry) => entry.createdDate.year === state.world.currentDate.year
      && entry.createdDate.week === state.world.currentDate.week).length;
    const capacity = Math.min(BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION - openCount,
      BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK - weekCount);
    if (capacity <= 0) continue;
    const contracts = new Map(activeContractsForPromotion(state, control.promotionId)
      .filter((contract) => contract.datesUsed < contract.dateEntitlement)
      .map((contract) => [contract.personId, contract]));
    const candidates: Array<{ record: BackstageConversation; crowd: number }> = [];
    for (const team of state.teams ?? []) {
      if (team.status !== "ACTIVE") continue;
      const members = (state.teamMemberships ?? []).filter((record) => record.teamId === team.id
        && record.active && record.leftDate === null).map((record) => record.personId);
      if (members.length !== 2 || members[0] === members[1]) continue;
      const [a, b] = members.sort();
      if (!contracts.has(a!) || !contracts.has(b!)) continue;
      const key = pairKey(a!, b!);
      const relationTrust = relationships.get(key)?.professionalTrust ?? -1;
      const working = chemistry.get(key);
      if (relationTrust < 60 || !working || working.matchesTogether < 3 || working.familiarity < 40) continue;
      const id = `backstage:team-moment:${control.promotionId}:${team.id}:Y${state.world.currentDate.year}`;
      if (prior.some((entry) => entry.conversationId === id)) continue;

      let count = 0, response = 0;
      for (const match of state.matches) {
        if (match.type !== "TAG" || match.status !== "COMPLETED"
          || match.promotionId !== control.promotionId || !recent.has(match.eventId)
          || !Number.isFinite(match.crowdResponse)) continue;
        const record = matchPeople.get(match.id) ?? [];
        const pa = record.find((entry) => entry.personId === a);
        const pb = record.find((entry) => entry.personId === b);
        if (!pa || !pb || pa.side !== pb.side) continue;
        const committed = appearances.get(match.eventId);
        if (!committed?.has(a + "|" + contracts.get(a!)!.id)
          || !committed.has(b + "|" + contracts.get(b!)!.id)) continue;
        count++;
        response += match.crowdResponse;
      }
      const average = count ? Math.round(response / count * 10) / 10 : 0;
      if (count < 2 || average < 70) continue;
      candidates.push({crowd:average, record:{
        conversationId:id,worldId:state.world.id,promotionId:control.promotionId,
        wrestlerId:a!,sourceContractId:contracts.get(a!)!.id,
        partnerPersonId:b,sharedTagMatches:count,averageCrowdResponse:average,
        professionalTrustAtPitch:Math.round(relationTrust*10)/10,
        kind:"TEAM_MOMENT",createdDate:{...state.world.currentDate},status:"NOTED",
        response:null,responseDate:null,promisedRole:null,observedMatchShows:0,observedFeaturedShows:0,
      }});
    }
    candidates.sort((a,b) => b.crowd-a.crowd || a.record.conversationId.localeCompare(b.record.conversationId));
    for (const candidate of candidates.slice(0,capacity)) {
      openBackstageConversation(engagement,candidate.record);
      created++;
    }
  }
  return created;
}

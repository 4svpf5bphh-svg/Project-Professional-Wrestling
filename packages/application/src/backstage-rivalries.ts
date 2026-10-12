/**
 * A wrestler can pitch a scripted rivalry when there is real evidence of
 * successful work with a professionally trusted opponent. Rivalry heat is an
 * on-screen property; backstage professional trust is not real hostility.
 * This system suggests only: the player authors the actual Programme.
 */
import type { Id } from "../../domain/src/types.js";
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { createWorldEngagementState, openBackstageConversation, type BackstageConversation } from "./engagement.js";
import { BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION, BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK } from "./backstage.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";
import { chooseCreativePitchSpeaker, wrestlerCreativeInterestScores } from "./wrestler-creative-interests.js";

export function generateRivalryPitches(aggregate: ApplicationWorldAggregate): number {
  const state = aggregate.state;
  const controllers = activePromotionControls(aggregate.ownership);
  if (controllers.length === 0) return 0;
  const engagement = aggregate.engagement ?? createWorldEngagementState(state.world.id);
  aggregate.engagement = engagement;
  const week = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const completed = new Map(state.events.filter((event) =>
    event.status === "COMPLETED"
      && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) >= week - 12
      && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) <= week
  ).map((event) => [event.id, event]));
  const peopleById = new Map(state.people.map(person=>[person.id,person]));
  const participants = new Map<Id, typeof state.matchParticipants>();
  for (const entry of state.matchParticipants) {
    if (!completed.has(entry.eventId)) continue;
    const list = participants.get(entry.matchId) ?? [];
    list.push(entry);
    participants.set(entry.matchId, list);
  }
  const usedContracts = new Map<Id, Set<string>>();
  for (const appearance of state.scheduledAppearances) {
    if (appearance.status !== "COMPLETED" || !completed.has(appearance.eventId)) continue;
    const used = usedContracts.get(appearance.eventId) ?? new Set<string>();
    used.add(appearance.personId + "|" + appearance.contractId);
    usedContracts.set(appearance.eventId, used);
  }
  const pairKey = (a: Id, b: Id) => [a, b].sort().join("|");
  const relationships = new Map((state.wrestlerRelationships ?? []).map((record) => [
    pairKey(record.personAId, record.personBId), record,
  ]));
  let added = 0;
  for (const controller of controllers) {
    const promotionId = controller.promotionId;
    const previous = engagement.backstageConversations.filter((entry) => entry.promotionId === promotionId && entry.kind !== "PROGRAMME_CREATIVE_AGREEMENT");
    const inWeek = previous.filter((entry) => entry.createdDate.year === state.world.currentDate.year
      && entry.createdDate.week === state.world.currentDate.week).length;
    const open = previous.filter((entry) => entry.status === "OPEN").length;
    const capacity = Math.min(BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK - inWeek,
      BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION - open);
    if (capacity <= 0) continue;
    const contracts = new Map(activeContractsForPromotion(state, promotionId)
      .filter((contract) => contract.datesUsed < contract.dateEntitlement)
      .filter((contract) => {
        const person = state.people.find((candidate) => candidate.id === contract.personId);
        return person && person.status !== "RETIRED" && person.status !== "INJURED";
      })
      .map((contract) => [contract.personId, contract]));
    const evidence = new Map<string, { a: Id; b: Id; matches: number; responseTotal: number }>();
    for (const match of state.matches) {
      if (match.type !== "SINGLES" || match.status !== "COMPLETED"
        || match.promotionId !== promotionId || !completed.has(match.eventId)
        || !Number.isFinite(match.crowdResponse)) continue;
      const people = participants.get(match.id) ?? [];
      if (people.length !== 2 || people[0]!.side === people[1]!.side) continue;
      const a = people[0]!.personId, b = people[1]!.personId;
      if (a === b) continue;
      if (![a, b].every((id) => {
        const contract = contracts.get(id);
        return contract && usedContracts.get(match.eventId)?.has(id + "|" + contract.id);
      })) continue;
      const key = pairKey(a, b);
      const item = evidence.get(key) ?? { a: [a,b].sort()[0]!, b: [a,b].sort()[1]!, matches: 0, responseTotal: 0 };
      item.matches++;
      item.responseTotal += match.crowdResponse;
      evidence.set(key, item);
    }
    const candidates: Array<{ record: BackstageConversation; crowd: number; pitchPriority: number }> = [];
    for (const [key, item] of evidence) {
      const average = Math.round((item.responseTotal / item.matches) * 10) / 10;
      const trust = relationships.get(key)?.professionalTrust ?? -1;
      if (item.matches < 2 || average < 70 || trust < 60) continue;
      const activeProgramme = (state.programmes ?? []).some((programme) =>
        programme.status === "ACTIVE" && programme.promotionId === promotionId
        && ((programme.sideA.some((ref) => ref.kind === "PERSON" && ref.entityId === item.a)
          && programme.sideB.some((ref) => ref.kind === "PERSON" && ref.entityId === item.b))
          || (programme.sideA.some((ref) => ref.kind === "PERSON" && ref.entityId === item.b)
            && programme.sideB.some((ref) => ref.kind === "PERSON" && ref.entityId === item.a)))
      );
      if (activeProgramme) continue;
      const id = `backstage:rivalry-pitch:${promotionId}:${item.a}:${item.b}`;
      if (previous.some((entry) => entry.conversationId === id)) continue;
      const wrestlerA=peopleById.get(item.a)!;
      const wrestlerB=peopleById.get(item.b)!;
      const proposer=chooseCreativePitchSpeaker(wrestlerA,wrestlerB,"STORY_RIVALRIES");
      const rivalPersonId=proposer.id===item.a?item.b:item.a;
      const interest=wrestlerCreativeInterestScores(proposer).STORY_RIVALRIES;
      const priority=average + interest*.14 + trust*.07;
      candidates.push({ crowd: average, pitchPriority:priority, record: {
        conversationId: id, worldId: state.world.id, promotionId,
        wrestlerId: proposer.id, sourceContractId: contracts.get(proposer.id)!.id,
        rivalPersonId, sharedSinglesMatches: item.matches,
        creativeInterestAtPitch:"STORY_RIVALRIES",
        averageCrowdResponse: average, professionalTrustAtPitch: Math.round(trust * 10) / 10,
        kind: "RIVALRY_PITCH", createdDate: { ...state.world.currentDate },
        status: "OPEN", response: null, responseDate: null,
        promisedRole: null, observedMatchShows: 0, observedFeaturedShows: 0,
      } });
    }
    candidates.sort((a, b) => b.pitchPriority - a.pitchPriority
      || b.crowd - a.crowd
      || (b.record.sharedSinglesMatches ?? 0) - (a.record.sharedSinglesMatches ?? 0)
      || a.record.conversationId.localeCompare(b.record.conversationId));
    for (const candidate of candidates.slice(0, capacity)) {
      openBackstageConversation(engagement, candidate.record);
      added++;
    }
  }
  return added;
}

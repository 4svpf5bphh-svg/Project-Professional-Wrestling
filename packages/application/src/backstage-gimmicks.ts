/**
 * A struggling wrestler can ask about repackaging their on-screen character,
 * based only on recorded match response under their *current promotion contract*.
 * This is a pitch, not a diagnosis: a poor match is not proof of a bad gimmick.
 * All creative changes remain booker-authored in wrestler-profile editing.
 */
import type { Id } from "../../domain/src/types.js";
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import {
  createWorldEngagementState, openBackstageConversation,
  type BackstageConversation,
} from "./engagement.js";
import { BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION, BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK } from "./backstage.js";
import { activePromotionControls } from "./ownership.js";
import {
  wrestlerCreativeProfileFor, type GimmickArchetype, type WrestlerCreativeFields,
} from "./wrestler-creative.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";
import { wrestlerCreativeInterestScores } from "./wrestler-creative-interests.js";
import { wrestlerPersonalityFor } from "./wrestler-personality.js";
import type { Person } from "../../domain/src/types.js";

const EVIDENCE_WEEKS = 12;
const MIN_CHARACTER_WEEKS = 6;
const MIN_MATCHES = 4;
const MAX_CROWD_RESPONSE = 55;

function proposedArchetype(fields: WrestlerCreativeFields, person: Person): GimmickArchetype {
  // A suggested fictional direction reflects character interest and style,
  // NOT a claim that this gimmick caused past poor responses or will improve results.
  const disposition=wrestlerPersonalityFor(person).temperament;
  const scores=wrestlerCreativeInterestScores(person);
  const technical=["TECHNICAL","SUBMISSION","STRONG_STYLE"].includes(fields.primaryStyle);
  const preferences: GimmickArchetype[] = [
    ...(scores.PROMO_SPOTLIGHT > scores.CHARACTER_REINVENTION ? ["SHOWMAN" as const] : []),
    ...(disposition==="INDEPENDENT" ? ["REBEL" as const] : []),
    ...(disposition==="SHOWMAN" ? ["SHOWMAN" as const] : []),
    ...(technical ? ["SPORTING" as const] : ["REBEL" as const]),
    "MYSTERY", "SPORTING", "SHOWMAN", "AUTHENTIC",
  ];
  return preferences.find(candidate=>candidate !== fields.gimmickArchetype)!;
}

export function generateGimmickChangePitches(aggregate: ApplicationWorldAggregate): number {
  const state = aggregate.state;
  const controls = activePromotionControls(aggregate.ownership);
  if (controls.length === 0) return 0;
  const engagement = aggregate.engagement ?? createWorldEngagementState(state.world.id);
  aggregate.engagement = engagement;
  const now = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const eligibleEvents = new Set(state.events.filter((event) =>
    event.status === "COMPLETED"
    && now - ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) >= 0
    && now - ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) <= EVIDENCE_WEEKS
  ).map((event) => event.id));
  const byEventAndPerson = new Map<string, Set<Id>>();
  for (const appearance of state.scheduledAppearances) {
    if (!eligibleEvents.has(appearance.eventId) || appearance.status !== "COMPLETED") continue;
    const key = appearance.eventId + "|" + appearance.personId;
    const contracts = byEventAndPerson.get(key) ?? new Set<Id>();
    contracts.add(appearance.contractId);
    byEventAndPerson.set(key, contracts);
  }
  const involved = new Map<Id, Set<Id>>();
  for (const entry of state.matchParticipants) {
    if (!eligibleEvents.has(entry.eventId)) continue;
    const people = involved.get(entry.matchId) ?? new Set<Id>();
    people.add(entry.personId);
    involved.set(entry.matchId, people);
  }

  let created = 0;
  for (const control of controls) {
    const promotionId = control.promotionId;
    const existing = engagement.backstageConversations.filter((item) => item.promotionId === promotionId && item.kind !== "PROGRAMME_CREATIVE_AGREEMENT");
    const newThisWeek = existing.filter((item) =>
      item.createdDate.year === state.world.currentDate.year
      && item.createdDate.week === state.world.currentDate.week
    ).length;
    const unanswered = existing.filter((item) => item.status === "OPEN").length;
    const capacity = Math.min(
      BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK - newThisWeek,
      BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION - unanswered,
    );
    if (capacity <= 0) continue;
    const candidates: Array<{ pitch: BackstageConversation; response: number; priority: number }> = [];
    for (const contract of activeContractsForPromotion(state, promotionId)) {
      if (contract.datesUsed >= contract.dateEntitlement) continue;
      const person = state.people.find((entry) => entry.id === contract.personId);
      if (!person || person.status !== "ACTIVE") continue;
      const id = "backstage:gimmick-pitch:" + contract.id;
      if (existing.some((entry) => entry.conversationId === id)) continue;
      const lastChange = engagement.wrestlerCreativeProfiles?.find(
        (entry) => entry.promotionId === promotionId && entry.personId === person.id
      )?.changedDate ?? contract.startDate;
      if (now - ppwDateToWeekIndex(lastChange, state.ruleset.weeksPerYear) < MIN_CHARACTER_WEEKS) continue;

      let matches = 0;
      let totalCrowd = 0;
      const countedMatches = new Set<Id>();
      for (const match of state.matches) {
        if (match.promotionId !== promotionId || match.status !== "COMPLETED"
          || !eligibleEvents.has(match.eventId) || !Number.isFinite(match.crowdResponse)
          || !involved.get(match.id)?.has(person.id)
          || !byEventAndPerson.get(match.eventId + "|" + person.id)?.has(contract.id)
          || countedMatches.has(match.id)) continue;
        countedMatches.add(match.id);
        matches++;
        totalCrowd += match.crowdResponse;
      }
      if (matches < MIN_MATCHES) continue;
      const average = Math.round(totalCrowd / matches * 10) / 10;
      if (average > MAX_CROWD_RESPONSE || average < 0) continue;
      const fields = wrestlerCreativeProfileFor(engagement, promotionId, person);
      const personalInterest=wrestlerCreativeInterestScores(person).CHARACTER_REINVENTION;
      candidates.push({ response: average, priority: (MAX_CROWD_RESPONSE-average)+personalInterest*.15, pitch: {
        conversationId: id, worldId: state.world.id, promotionId,
        wrestlerId: person.id, sourceContractId: contract.id,
        kind: "GIMMICK_CHANGE_PITCH",
        createdDate: { ...state.world.currentDate },
        status: "OPEN", response: null, responseDate: null,
        promisedRole: null, observedMatchShows: matches, observedFeaturedShows: 0,
        observedCrowdResponse: average,
        currentGimmickArchetype: fields.gimmickArchetype,
        suggestedGimmickArchetype: proposedArchetype(fields, person),
        creativeInterestAtPitch:"CHARACTER_REINVENTION",
      } });
    }
    candidates.sort((a,b) => b.priority - a.priority
      || a.response - b.response
      || b.pitch.observedMatchShows - a.pitch.observedMatchShows
      || a.pitch.sourceContractId.localeCompare(b.pitch.sourceContractId));
    for (const candidate of candidates.slice(0, capacity)) {
      openBackstageConversation(engagement, candidate.pitch);
      created++;
    }
  }
  return created;
}

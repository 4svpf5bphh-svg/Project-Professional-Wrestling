/**
 * The first conservative WORLD-authoritative interpersonal relationship change.
 *
 * Two verified, well-executed tag appearances on separate completed shows
 * within twelve PPW weeks establish credible evidence of working cooperation.
 * A small rise in fictional professional respect/familiarity is permitted at
 * most once per pair per eight PPW weeks, across ALL promotions.
 *
 * This is not a morale or promotion-trust system, is unrelated to winning,
 * and never treats a booked attack, betrayal, rivalry or loss as real animosity.
 * Poor execution only affects *established professional confidence*, with no
 * inferred personal hatred, individual blame, alignment change or team break.
 * No screen/read action may invoke this mutating pass.
 */
import type { Id, Match, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { eventsForWeek, matchesForEvent, participantsForMatch } from "./indexes.js";
import { LedgerWriter } from "./ledger.js";
import { upsertWrestlerRelationship } from "./relationships.js";

export const WORKING_PARTNERSHIP_LEDGER_TYPE = "WRESTLER_WORKING_PARTNERSHIP_DEVELOPED";
export const WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE = "WRESTLER_WORKING_PARTNERSHIP_STRAINED";
const LOOKBACK_WEEKS = 12;
const COOLDOWN_WEEKS = 8;
const MIN_EXECUTION = 68;
const TRUST_GAIN = 0.8;
const TRUST_CEILING = 75;
const FAMILIARITY_GAIN = 2;
// Repeated *poor execution* can lower working confidence, not personal affinity.
// Three distinct poor shows with no good execution in the same recent window.
const STRAIN_LOOKBACK_WEEKS = 10;
const STRAIN_COOLDOWN_WEEKS = 12;
const STRAIN_MAX_EXECUTION = 40;
const STRAIN_TRUST_LOSS = 0.6;
const STRAIN_TRUST_FLOOR = 35;
const ESTABLISHED_FAMILIARITY = 12;

interface PairEvidence {
  a: Id;
  b: Id;
  showIds: Set<Id>;
  currentMatchIds: Id[];
  poorShowIds: Set<Id>;
  currentPoorMatchIds: Id[];
  hasGoodExecution: boolean;
}

function tagPairForMatch(state: WorldState, match: Match): [Id, Id][] {
  if (match.type !== "TAG" || match.status !== "COMPLETED"
    || !Number.isFinite(match.executionQuality)) return [];
  const entrants = participantsForMatch(state, match.id);
  if (entrants.length !== 4 || entrants.some(p => p.matchId !== match.id || p.eventId !== match.eventId)
    || new Set(entrants.map(p => p.personId)).size !== 4) return [];
  const sides = ["A", "B"].map(side => entrants.filter(p => p.side === side));
  if (sides.some(side => side.length !== 2)) return [];
  return sides.map(side => {
    const ids = side.map(p => p.personId).sort();
    return [ids[0]!, ids[1]!] as [Id, Id];
  });
}

function recentChangeKeys(
  state: WorldState, currentWeek: number, type: string, windowWeeks: number,
): Set<string> {
  const keys = new Set<string>();
  // Chronological ledger append order is a World invariant. Read just the
  // short recent suffix, never rescan a century of historical match events.
  for (let i = state.ledger.length - 1; i >= 0; i--) {
    const entry = state.ledger[i]!;
    const age = currentWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
    if (age >= windowWeeks) break;
    if (age < 0 || entry.type !== type) continue;
    const [a, b] = entry.entityIds;
    if (a && b) keys.add(a + "|" + b);
  }
  return keys;
}

/** Invoke exactly once during the persisted World resolution after shows. */
export function evolveCompletedWorkingPartnerships(state: WorldState): number {
  const weeksPerYear = state.ruleset.weeksPerYear;
  const todayWeek = ppwDateToWeekIndex(state.world.currentDate, weeksPerYear);
  const people = new Set(state.people.map(p => p.id));
  const pairs = new Map<string, PairEvidence>();

  for (let week = Math.max(0, todayWeek - LOOKBACK_WEEKS + 1); week <= todayWeek; week++) {
    const date = { year: Math.floor(week / weeksPerYear) + 1, week: week % weeksPerYear + 1, day: 1 };
    for (const event of eventsForWeek(state, date)) {
      if (event.status !== "COMPLETED" || ppwDateToWeekIndex(event.date, weeksPerYear) !== week
        || event.date.year > state.world.currentDate.year) continue;
      for (const match of matchesForEvent(state, event.id)) {
        if (match.eventId !== event.id || match.promotionId !== event.promotionId) continue;
        for (const [a, b] of tagPairForMatch(state, match)) {
          if (!people.has(a) || !people.has(b)) continue;
          const key = a + "|" + b;
          const existing = pairs.get(key) ?? {
            a, b, showIds: new Set<Id>(), currentMatchIds: [],
            poorShowIds: new Set<Id>(), currentPoorMatchIds: [],
            hasGoodExecution: false,
          };
          if (match.executionQuality >= MIN_EXECUTION) {
            existing.showIds.add(event.id);
            existing.hasGoodExecution = true;
            if (week === todayWeek) existing.currentMatchIds.push(match.id);
          }
          if (week >= todayWeek - STRAIN_LOOKBACK_WEEKS + 1
            && match.executionQuality <= STRAIN_MAX_EXECUTION) {
            existing.poorShowIds.add(event.id);
            if (week === todayWeek) existing.currentPoorMatchIds.push(match.id);
          }
          pairs.set(key, existing);
        }
      }
    }
  }

  const recent = recentChangeKeys(state, todayWeek, WORKING_PARTNERSHIP_LEDGER_TYPE, COOLDOWN_WEEKS);
  const recentStrain = recentChangeKeys(
    state, todayWeek, WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE, STRAIN_COOLDOWN_WEEKS,
  );
  const relationships = new Map((state.wrestlerRelationships ?? []).map(
    relation => [relation.personAId + "|" + relation.personBId, relation],
  ));
  const writer = new LedgerWriter(state.world.id, state.ledger);
  let updated = 0;
  for (const [key, evidence] of [...pairs].sort(([a], [b]) => a.localeCompare(b))) {
    const previous = relationships.get(key);
    // A poor show proves neither an unsafe colleague nor a personal dispute.
    // Only an established working pair with three independently poor, *completed*
    // shows and no good result in the recent window loses a little confidence.
    if (previous && previous.familiarity >= ESTABLISHED_FAMILIARITY
      && previous.professionalTrust > STRAIN_TRUST_FLOOR
      && evidence.poorShowIds.size >= 3 && evidence.currentPoorMatchIds.length > 0
      && !evidence.hasGoodExecution && !recentStrain.has(key) && !recent.has(key)) {
      const beforeTrust = previous.professionalTrust;
      previous.professionalTrust = Math.round(
        Math.max(STRAIN_TRUST_FLOOR, beforeTrust - STRAIN_TRUST_LOSS) * 10,
      ) / 10;
      const trustDelta = Math.round((previous.professionalTrust - beforeTrust) * 10) / 10;
      if (trustDelta < 0) {
        writer.append({
          date: state.world.currentDate,
          type: WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE,
          entityIds: [evidence.a, evidence.b],
          significance: "ROUTINE",
          payload: {
            sourceMatchId: evidence.currentPoorMatchIds.sort()[0]!,
            verifiedShows: evidence.poorShowIds.size,
            trustDelta,
            familiarityDelta: 0,
            reason: "REPEATED_POOR_TAG_EXECUTION",
          },
        });
        recentStrain.add(key);
        updated++;
      }
      continue;
    }
    // No retrospective backfill: a real qualifying collaboration this week is required.
    if (evidence.showIds.size < 2 || !evidence.currentMatchIds.length || recent.has(key)) continue;
    if (previous && previous.professionalTrust >= TRUST_CEILING && previous.familiarity >= 100) continue;
    const relationship = previous ?? upsertWrestlerRelationship(state, {
      personAId: evidence.a, personBId: evidence.b,
      professionalTrust: 50, familiarity: 0,
    });
    if (!previous) relationships.set(key, relationship);
    const beforeTrust = relationship.professionalTrust;
    const beforeFamiliarity = relationship.familiarity;
    relationship.professionalTrust = Math.round(
      Math.min(TRUST_CEILING, beforeTrust + TRUST_GAIN) * 10,
    ) / 10;
    // Preserve any curated high trust rather than reducing it to the growth ceiling.
    relationship.professionalTrust = Math.max(beforeTrust, relationship.professionalTrust);
    relationship.familiarity = Math.min(100, beforeFamiliarity + FAMILIARITY_GAIN);
    const trustDelta = Math.round((relationship.professionalTrust - beforeTrust) * 10) / 10;
    const familiarityDelta = relationship.familiarity - beforeFamiliarity;
    if (trustDelta === 0 && familiarityDelta === 0) continue;
    writer.append({
      date: state.world.currentDate,
      type: WORKING_PARTNERSHIP_LEDGER_TYPE,
      entityIds: [evidence.a, evidence.b],
      significance: "ROUTINE",
      payload: {
        sourceMatchId: evidence.currentMatchIds.sort()[0]!,
        verifiedShows: evidence.showIds.size,
        trustDelta,
        familiarityDelta,
        reason: "REPEATED_WELL_EXECUTED_TAG_WORK",
      },
    });
    recent.add(key);
    updated++;
  }
  return updated;
}

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
 * No screen/read action may invoke this mutating pass.
 */
import type { Id, Match, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { eventsForWeek, matchesForEvent, participantsForMatch } from "../../sim-core/src/indexes.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import { upsertWrestlerRelationship, wrestlerRelationshipBetween } from "../../sim-core/src/relationships.js";

export const WORKING_PARTNERSHIP_LEDGER_TYPE = "WRESTLER_WORKING_PARTNERSHIP_DEVELOPED";
const LOOKBACK_WEEKS = 12;
const COOLDOWN_WEEKS = 8;
const MIN_EXECUTION = 68;
const TRUST_GAIN = 0.8;
const TRUST_CEILING = 75;
const FAMILIARITY_GAIN = 2;

interface PairEvidence {
  a: Id;
  b: Id;
  showIds: Set<Id>;
  currentMatchIds: Id[];
}

function tagPairForMatch(state: WorldState, match: Match): [Id, Id][] {
  if (match.type !== "TAG" || match.status !== "COMPLETED"
    || !Number.isFinite(match.executionQuality) || match.executionQuality < MIN_EXECUTION) return [];
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

function recentGrowthKeys(state: WorldState, currentWeek: number): Set<string> {
  const keys = new Set<string>();
  // Chronological ledger append order is a World invariant. Read just the
  // short recent suffix, never rescan a century of historical match events.
  for (let i = state.ledger.length - 1; i >= 0; i--) {
    const entry = state.ledger[i]!;
    const age = currentWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
    if (age >= COOLDOWN_WEEKS) break;
    if (age < 0 || entry.type !== WORKING_PARTNERSHIP_LEDGER_TYPE) continue;
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
          const existing = pairs.get(key) ?? { a, b, showIds: new Set<Id>(), currentMatchIds: [] };
          existing.showIds.add(event.id);
          if (week === todayWeek) existing.currentMatchIds.push(match.id);
          pairs.set(key, existing);
        }
      }
    }
  }

  const recent = recentGrowthKeys(state, todayWeek);
  const writer = new LedgerWriter(state.world.id, state.ledger);
  let updated = 0;
  for (const [key, evidence] of [...pairs].sort(([a], [b]) => a.localeCompare(b))) {
    // No retrospective backfill: a real qualifying collaboration this week is required.
    if (evidence.showIds.size < 2 || !evidence.currentMatchIds.length || recent.has(key)) continue;
    const previous = wrestlerRelationshipBetween(state, evidence.a, evidence.b);
    if (previous && previous.professionalTrust >= TRUST_CEILING && previous.familiarity >= 100) continue;
    const relationship = previous ?? upsertWrestlerRelationship(state, {
      personAId: evidence.a, personBId: evidence.b,
      professionalTrust: 50, familiarity: 0,
    });
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

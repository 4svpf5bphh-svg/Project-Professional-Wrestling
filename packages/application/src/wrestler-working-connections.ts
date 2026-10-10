/**
 * A bounded, read-only World history of a wrestler's actual working connections.
 *
 * Scripted opposition and betrayals are NOT evidence of personal hostility.
 * Shared-ring chemistry is distinct from the wrestler/promotion trust economy
 * and from seeded, fictional wrestler-to-wrestler professional trust.
 */
import type { Id, PpwDate, WrestlerRelationship, WorkingChemistry, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { eventsForWeek, matchesForEvent, participantsForMatch } from "../../sim-core/src/indexes.js";
import { WORKING_PARTNERSHIP_LEDGER_TYPE } from "./working-relationship-evolution.js";

export interface WrestlerWorkingConnectionView {
  personId: Id;
  name: string;
  /** Curated fictional World backstory. Null means no established relationship. */
  relationship: {
    tags: WrestlerRelationship["tags"];
    professionalTrust: number;
    affinity: number;
    rivalryHeat: number;
    familiarity: number;
  } | null;
  /** Verified match chemistry, not interpersonal sentiment. */
  tagChemistry: { familiarity: number; matchesTogether: number } | null;
  singlesChemistry: { familiarity: number; matchesTogether: number } | null;
  recentTagMatchesTogether: number;
  recentSinglesOppositions: number;
  latestSharedMatchDate: PpwDate | null;
  /** Most recent proven collaboration improvement, not an asserted friendship. */
  lastDevelopment: { date: PpwDate; trustDelta: number; familiarityDelta: number } | null;
}

interface ConnectionDraft {
  relationship?: WrestlerRelationship;
  tagChemistry?: WorkingChemistry;
  singlesChemistry?: WorkingChemistry;
  recentTagMatchesTogether: number;
  recentSinglesOppositions: number;
  latestSharedMatchDate: PpwDate | null;
  lastDevelopment: { date: PpwDate; trustDelta: number; familiarityDelta: number } | null;
}

const LOOKBACK_WEEKS = 12;
const MAX_CONNECTIONS = 8;

export function workingConnectionsForWrestler(
  state: WorldState,
  personId: Id,
): WrestlerWorkingConnectionView[] {
  const names = new Map(state.people.map(person => [person.id, person.name]));
  if (!names.has(personId)) return [];
  const drafts = new Map<Id, ConnectionDraft>();
  const get = (otherId: Id): ConnectionDraft | null => {
    if (otherId === personId || !names.has(otherId)) return null;
    let draft = drafts.get(otherId);
    if (!draft) {
      draft = { recentTagMatchesTogether: 0, recentSinglesOppositions: 0, latestSharedMatchDate: null, lastDevelopment: null };
      drafts.set(otherId, draft);
    }
    return draft;
  };

  for (const record of state.wrestlerRelationships ?? []) {
    if (record.personAId !== personId && record.personBId !== personId) continue;
    const other = record.personAId === personId ? record.personBId : record.personAId;
    const draft = get(other);
    if (draft) draft.relationship = record;
  }
  for (const record of state.workingChemistry) {
    if (record.personAId !== personId && record.personBId !== personId) continue;
    const other = record.personAId === personId ? record.personBId : record.personAId;
    const draft = get(other);
    if (!draft) continue;
    if (record.context === "TAG") draft.tagChemistry = record;
    else if (record.context === "SINGLES") draft.singlesChemistry = record;
  }

  // Historical reasons are frozen with the authoritative change; newest first.
  // This short ledger suffix is enough to explain the latest recent change.
  const nowForLedger = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  for (let i = state.ledger.length - 1; i >= 0; i--) {
    const entry = state.ledger[i]!;
    const age = nowForLedger - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
    if (age >= 26) break;
    if (age < 0 || entry.type !== WORKING_PARTNERSHIP_LEDGER_TYPE) continue;
    const [a, b] = entry.entityIds;
    const other = a === personId ? b : b === personId ? a : null;
    if (!other || !names.has(other)) continue;
    const draft = get(other)!;
    if (draft.lastDevelopment) continue;
    const trustDelta = entry.payload.trustDelta;
    const familiarityDelta = entry.payload.familiarityDelta;
    if (typeof trustDelta !== "number" || typeof familiarityDelta !== "number") continue;
    draft.lastDevelopment = { date: { ...entry.date }, trustDelta, familiarityDelta };
  }

  // The index only visits the last 12 PPW weeks; no unbounded ledger scan.
  const weeksPerYear = state.ruleset.weeksPerYear;
  const nowWeek = ppwDateToWeekIndex(state.world.currentDate, weeksPerYear);
  for (let index = Math.max(0, nowWeek - LOOKBACK_WEEKS + 1); index <= nowWeek; index++) {
    const date = { year: Math.floor(index / weeksPerYear) + 1, week: index % weeksPerYear + 1, day: 1 };
    for (const event of eventsForWeek(state, date)) {
      if (event.status !== "COMPLETED") continue;
      for (const match of matchesForEvent(state, event.id)) {
        if (match.status !== "COMPLETED" || match.eventId !== event.id
          || match.promotionId !== event.promotionId) continue;
        const participants = participantsForMatch(state, match.id);
        const expected = match.type === "TAG" ? 4 : match.type === "SINGLES" ? 2 : 0;
        if (!expected || participants.length !== expected
          || new Set(participants.map(p => p.personId)).size !== expected
          || participants.some(p => p.eventId !== event.id)) continue;
        const ours = participants.find(p => p.personId === personId);
        if (!ours) continue;
        const allies = participants.filter(p => p.side === ours.side);
        const opposition = participants.filter(p => p.side !== ours.side);
        if (allies.length !== expected / 2 || opposition.length !== expected / 2) continue;
        const otherId = match.type === "TAG"
          ? allies.find(p => p.personId !== personId)?.personId
          : opposition[0]?.personId;
        if (!otherId) continue;
        const draft = get(otherId);
        if (!draft) continue;
        if (match.type === "TAG") draft.recentTagMatchesTogether++;
        else draft.recentSinglesOppositions++;
        if (!draft.latestSharedMatchDate
          || comparePpwDates(event.date, draft.latestSharedMatchDate, weeksPerYear) > 0) {
          draft.latestSharedMatchDate = { ...event.date };
        }
      }
    }
  }

  return [...drafts.entries()]
    .map(([otherId, draft]): WrestlerWorkingConnectionView => ({
      personId: otherId,
      name: names.get(otherId)!,
      relationship: draft.relationship ? {
        tags: [...draft.relationship.tags],
        professionalTrust: draft.relationship.professionalTrust,
        affinity: draft.relationship.affinity,
        rivalryHeat: draft.relationship.rivalryHeat,
        familiarity: draft.relationship.familiarity,
      } : null,
      tagChemistry: draft.tagChemistry ? {
        familiarity: draft.tagChemistry.familiarity,
        matchesTogether: draft.tagChemistry.matchesTogether,
      } : null,
      singlesChemistry: draft.singlesChemistry ? {
        familiarity: draft.singlesChemistry.familiarity,
        matchesTogether: draft.singlesChemistry.matchesTogether,
      } : null,
      recentTagMatchesTogether: draft.recentTagMatchesTogether,
      recentSinglesOppositions: draft.recentSinglesOppositions,
      latestSharedMatchDate: draft.latestSharedMatchDate,
      lastDevelopment: draft.lastDevelopment,
    }))
    .sort((a, b) =>
      b.recentTagMatchesTogether - a.recentTagMatchesTogether
      || b.recentSinglesOppositions - a.recentSinglesOppositions
      || (b.tagChemistry?.matchesTogether ?? 0) - (a.tagChemistry?.matchesTogether ?? 0)
      || (b.singlesChemistry?.matchesTogether ?? 0) - (a.singlesChemistry?.matchesTogether ?? 0)
      || (b.relationship?.familiarity ?? 0) - (a.relationship?.familiarity ?? 0)
      || a.personId.localeCompare(b.personId))
    .slice(0, MAX_CONNECTIONS);
}

import type { LedgerEvent, WorldState } from "../../domain/src/types.js";

export type EntityIdKind =
  | "market"
  | "venue"
  | "promotion"
  | "person"
  | "contract"
  | "contractOffer"
  | "event"
  | "scheduledAppearance"
  | "match"
  | "matchParticipant"
  | "injury"
  | "workingChemistry"
  | "team"
  | "teamMembership"
  | "championship"
  | "championshipReign"
  | "championshipContest"
  | "financialTransaction"
  | "ledger";

export type EntityIdCounters = Record<EntityIdKind, number>;

interface EntityIdSpec {
  prefix: string;
  width: number;
  ids: (state: WorldState) => readonly string[];
}

const ENTITY_ID_SPECS: Record<EntityIdKind, EntityIdSpec> = {
  market: { prefix: "market-", width: 3, ids: (state) => state.markets.map((entry) => entry.id) },
  venue: { prefix: "venue-", width: 4, ids: (state) => state.venues.map((entry) => entry.id) },
  promotion: { prefix: "promotion-", width: 3, ids: (state) => state.promotions.map((entry) => entry.id) },
  person: { prefix: "person-", width: 4, ids: (state) => state.people.map((entry) => entry.id) },
  contract: { prefix: "contract-", width: 6, ids: (state) => state.contracts.map((entry) => entry.id) },
  contractOffer: { prefix: "offer-", width: 7, ids: (state) => state.contractOffers.map((entry) => entry.id) },
  event: { prefix: "event-", width: 7, ids: (state) => state.events.map((entry) => entry.id) },
  scheduledAppearance: { prefix: "appearance-", width: 8, ids: (state) => state.scheduledAppearances.map((entry) => entry.id) },
  match: { prefix: "match-", width: 8, ids: (state) => state.matches.map((entry) => entry.id) },
  matchParticipant: { prefix: "match-participant-", width: 9, ids: (state) => state.matchParticipants.map((entry) => entry.id) },
  injury: { prefix: "injury-", width: 7, ids: (state) => state.injuries.map((entry) => entry.id) },
  workingChemistry: { prefix: "chemistry-", width: 7, ids: (state) => state.workingChemistry.map((entry) => entry.id) },
  team: { prefix: "team-", width: 7, ids: (state) => (state.teams ?? []).map((entry) => entry.id) },
  teamMembership: { prefix: "team-membership-", width: 8, ids: (state) => (state.teamMemberships ?? []).map((entry) => entry.id) },
  championship: { prefix: "championship-", width: 6, ids: (state) => (state.championships ?? []).map((entry) => entry.id) },
  championshipReign: { prefix: "championship-reign-", width: 7, ids: (state) => (state.championshipReigns ?? []).map((entry) => entry.id) },
  championshipContest: { prefix: "championship-contest-", width: 8, ids: (state) => (state.championshipContests ?? []).map((entry) => entry.id) },
  financialTransaction: { prefix: "finance-", width: 8, ids: (state) => state.financialTransactions.map((entry) => entry.id) },
  ledger: { prefix: "ledger-", width: 6, ids: (state) => state.ledger.map((entry) => entry.id) },
};

export const ENTITY_ID_KINDS = Object.keys(ENTITY_ID_SPECS) as EntityIdKind[];

const countersByState = new WeakMap<WorldState, EntityIdCounters>();
const countersByLedger = new WeakMap<LedgerEvent[], EntityIdCounters>();

function maxSequence(ids: readonly string[], prefix: string): number {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const suffix = id.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    const value = Number(suffix);
    if (Number.isSafeInteger(value) && value > max) max = value;
  }
  return max;
}

export function deriveEntityIdCounters(state: WorldState): EntityIdCounters {
  const counters = {} as EntityIdCounters;
  for (const kind of ENTITY_ID_KINDS) {
    const spec = ENTITY_ID_SPECS[kind];
    counters[kind] = maxSequence(spec.ids(state), spec.prefix);
  }
  return counters;
}

export function snapshotEntityIdCounters(state: WorldState): EntityIdCounters {
  const registered = countersByState.get(state);
  if (!registered) return deriveEntityIdCounters(state);
  return { ...registered };
}

export function registerEntityIdCounters(state: WorldState, counters?: EntityIdCounters): EntityIdCounters {
  const observed = deriveEntityIdCounters(state);
  const registered = counters ? { ...counters } : observed;
  for (const kind of ENTITY_ID_KINDS) {
    registered[kind] = Math.max(registered[kind], observed[kind]);
  }
  countersByState.set(state, registered);
  countersByLedger.set(state.ledger, registered);
  return registered;
}

function countersForState(state: WorldState): EntityIdCounters {
  return countersByState.get(state) ?? registerEntityIdCounters(state);
}

export function formatEntityId(kind: EntityIdKind, sequence: number): string {
  const spec = ENTITY_ID_SPECS[kind];
  return `${spec.prefix}${String(sequence).padStart(spec.width, "0")}`;
}

export function allocateEntityId(state: WorldState, kind: EntityIdKind): { id: string; sequence: number } {
  const counters = countersForState(state);
  const sequence = counters[kind] + 1;
  counters[kind] = sequence;
  return { id: formatEntityId(kind, sequence), sequence };
}

export function nextEntityId(state: WorldState, kind: EntityIdKind): string {
  return allocateEntityId(state, kind).id;
}

/**
 * LedgerWriter historically receives only the World ID and target array. Keep
 * that API stable while binding the array to the same persisted counter object
 * whenever a World is registered. The unregistered fallback exists only for
 * legacy/test state and is caught up when that World is later registered.
 */
export function nextLedgerSequence(target: LedgerEvent[]): number {
  let counters = countersByLedger.get(target);
  if (!counters) {
    counters = Object.fromEntries(ENTITY_ID_KINDS.map((kind) => [kind, 0])) as EntityIdCounters;
    counters.ledger = maxSequence(target.map((entry) => entry.id), ENTITY_ID_SPECS.ledger.prefix);
    countersByLedger.set(target, counters);
  }
  counters.ledger += 1;
  return counters.ledger;
}

export function validateEntityIdCounters(counters: unknown, state: WorldState): EntityIdCounters {
  if (typeof counters !== "object" || counters === null || Array.isArray(counters)) {
    throw new Error("persisted entity ID counters must be an object");
  }
  const record = counters as Record<string, unknown>;
  const observed = deriveEntityIdCounters(state);
  const validated = {} as EntityIdCounters;
  for (const kind of ENTITY_ID_KINDS) {
    const value = record[kind];
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new Error(`persisted entity ID counter ${kind} must be a non-negative safe integer`);
    }
    if ((value as number) < observed[kind]) {
      throw new Error(`persisted entity ID counter ${kind} is behind loaded World state`);
    }
    validated[kind] = value as number;
  }
  return validated;
}

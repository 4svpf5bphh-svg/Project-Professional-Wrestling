import type { ChampionshipMatchBooking, WorldState } from "../../domain/src/types.js";
import type { PromotionTalentTrust } from "../../domain/src/talent-trust.js";
import {
  deriveEntityIdCounters,
  registerEntityIdCounters,
  snapshotEntityIdCounters,
  validateEntityIdCounters,
  type EntityIdCounters,
} from "./id-allocator.js";

export const CURRENT_WORLD_STATE_SCHEMA_VERSION = 3 as const;
export type WorldStateSchemaVersion = 1 | 2 | typeof CURRENT_WORLD_STATE_SCHEMA_VERSION;

/**
 * Schema v1 was the first explicit persistence contract. Human championship
 * booking intent was still represented only indirectly by Ledger history.
 */
export interface PersistedWorldStateV1 {
  stateSchemaVersion: 1;
  world: WorldState["world"];
  ruleset: WorldState["ruleset"];
  markets: WorldState["markets"];
  venues: WorldState["venues"];
  promotions: WorldState["promotions"];
  promotionMarketStates: WorldState["promotionMarketStates"];
  promotionStandings: NonNullable<WorldState["promotionStandings"]>;
  promotionTalentTrust: PromotionTalentTrust[];
  promotionSurvivalStates: NonNullable<WorldState["promotionSurvivalStates"]>;
  people: WorldState["people"];
  contracts: WorldState["contracts"];
  contractOffers: WorldState["contractOffers"];
  events: WorldState["events"];
  scheduledAppearances: WorldState["scheduledAppearances"];
  matches: WorldState["matches"];
  matchParticipants: WorldState["matchParticipants"];
  injuries: WorldState["injuries"];
  workingChemistry: WorldState["workingChemistry"];
  teams: NonNullable<WorldState["teams"]>;
  teamMemberships: NonNullable<WorldState["teamMemberships"]>;
  championships: NonNullable<WorldState["championships"]>;
  championshipReigns: NonNullable<WorldState["championshipReigns"]>;
  championshipContests: NonNullable<WorldState["championshipContests"]>;
  financialTransactions: WorldState["financialTransactions"];
  ledger: WorldState["ledger"];
}

/**
 * Schema v2 makes unresolved championship booking intent explicit current
 * state. The Ledger remains historical/audit output and is no longer queried
 * as the source of truth for an unresolved title booking.
 */
export interface PersistedWorldStateV2 extends Omit<PersistedWorldStateV1, "stateSchemaVersion"> {
  stateSchemaVersion: 2;
  championshipMatchBookings: ChampionshipMatchBooking[];
}

/**
 * Schema v3 persists per-World entity allocation counters. Counters may be
 * ahead of the currently loaded hot collections after historical rows are
 * archived, but may never fall behind an ID still present in loaded state.
 */
export interface PersistedWorldStateV3 extends Omit<PersistedWorldStateV2, "stateSchemaVersion"> {
  stateSchemaVersion: 3;
  entityIdCounters: EntityIdCounters;
}

export type PersistedWorldState = PersistedWorldStateV3;

const REQUIRED_ARRAY_FIELDS_V1 = [
  "markets",
  "venues",
  "promotions",
  "promotionMarketStates",
  "promotionStandings",
  "promotionTalentTrust",
  "promotionSurvivalStates",
  "people",
  "contracts",
  "contractOffers",
  "events",
  "scheduledAppearances",
  "matches",
  "matchParticipants",
  "injuries",
  "workingChemistry",
  "teams",
  "teamMemberships",
  "championships",
  "championshipReigns",
  "championshipContests",
  "financialTransactions",
  "ledger",
] as const satisfies readonly (keyof PersistedWorldStateV1)[];

const REQUIRED_ARRAY_FIELDS_V2 = [
  ...REQUIRED_ARRAY_FIELDS_V1,
  "championshipMatchBookings",
] as const satisfies readonly (keyof PersistedWorldStateV2)[];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateMetadata(input: Record<string, unknown>): void {
  if (!isRecord(input.world)) throw new Error("persisted World state is missing world metadata");
  if (!isRecord(input.ruleset)) throw new Error("persisted World state is missing ruleset metadata");
  const world = input.world as unknown as PersistedWorldStateV1["world"];
  const ruleset = input.ruleset as unknown as PersistedWorldStateV1["ruleset"];
  if (world.rulesetVersion !== ruleset.version) {
    throw new Error(`persisted World ruleset mismatch: world=${world.rulesetVersion}, state=${ruleset.version}`);
  }
}

function validateArrayFields(
  input: Record<string, unknown>,
  fields: readonly string[],
): void {
  for (const field of fields) {
    if (!Array.isArray(input[field])) {
      throw new Error(`persisted World state field ${field} must be an array`);
    }
  }
}

function migrateV1TitleBookings(snapshot: PersistedWorldStateV1): ChampionshipMatchBooking[] {
  const scheduledEvents = new Map(
    snapshot.events.filter((event) => event.status === "SCHEDULED").map((event) => [event.id, event]),
  );
  const matchesById = new Map(snapshot.matches.map((match) => [match.id, match]));
  const championshipsById = new Map(snapshot.championships.map((championship) => [championship.id, championship]));
  const live = new Map<string, ChampionshipMatchBooking>();

  for (const entry of snapshot.ledger) {
    if (entry.type !== "HUMAN_CHAMPIONSHIP_MATCH_BOOKED" && entry.type !== "HUMAN_CHAMPIONSHIP_MATCH_UNBOOKED") continue;
    const eventId = typeof entry.payload.eventId === "string" ? entry.payload.eventId : null;
    const championshipId = typeof entry.payload.championshipId === "string" ? entry.payload.championshipId : null;
    if (!eventId || !championshipId) continue;
    const key = `${eventId}:${championshipId}`;

    if (entry.type === "HUMAN_CHAMPIONSHIP_MATCH_UNBOOKED") {
      live.delete(key);
      continue;
    }

    const matchId = typeof entry.payload.matchId === "string" ? entry.payload.matchId : null;
    if (!matchId) continue;
    const event = scheduledEvents.get(eventId);
    const match = matchesById.get(matchId);
    const championship = championshipsById.get(championshipId);
    if (!event || !match || !championship) continue;
    if (match.eventId !== event.id || match.promotionId !== event.promotionId) continue;
    if (championship.promotionId !== event.promotionId) continue;

    live.set(key, {
      worldId: snapshot.world.id,
      promotionId: event.promotionId,
      eventId,
      matchId,
      championshipId,
    });
  }

  return [...live.values()];
}

function migrateV1ToV2(snapshot: PersistedWorldStateV1): PersistedWorldStateV2 {
  const { stateSchemaVersion: _oldVersion, ...rest } = clone(snapshot);
  return {
    ...rest,
    stateSchemaVersion: 2,
    championshipMatchBookings: migrateV1TitleBookings(snapshot),
  };
}

function migrateV2ToV3(snapshot: PersistedWorldStateV2): PersistedWorldStateV3 {
  const { stateSchemaVersion: _oldVersion, ...rest } = clone(snapshot);
  return {
    ...rest,
    stateSchemaVersion: CURRENT_WORLD_STATE_SCHEMA_VERSION,
    entityIdCounters: deriveEntityIdCounters(snapshot as unknown as WorldState),
  };
}

function validateChampionshipMatchBookings(snapshot: PersistedWorldStateV2 | PersistedWorldStateV3): void {
  const promotionIds = new Set(snapshot.promotions.map((promotion) => promotion.id));
  const eventById = new Map(snapshot.events.map((event) => [event.id, event]));
  const matchById = new Map(snapshot.matches.map((match) => [match.id, match]));
  const championshipById = new Map(snapshot.championships.map((championship) => [championship.id, championship]));
  const championshipKeys = new Set<string>();
  const matchKeys = new Set<string>();

  for (const booking of snapshot.championshipMatchBookings) {
    if (booking.worldId !== snapshot.world.id) throw new Error("persisted championship booking crosses World boundary");
    if (!promotionIds.has(booking.promotionId)) throw new Error("persisted championship booking references missing promotion");

    const event = eventById.get(booking.eventId);
    if (!event || event.status !== "SCHEDULED") throw new Error("persisted championship booking requires a scheduled event");
    if (event.promotionId !== booking.promotionId) throw new Error("persisted championship booking event belongs to another promotion");

    const match = matchById.get(booking.matchId);
    if (!match || match.status !== "SCHEDULED") throw new Error("persisted championship booking requires a scheduled match");
    if (match.eventId !== event.id || match.promotionId !== booking.promotionId) {
      throw new Error("persisted championship booking match does not belong to its event and promotion");
    }

    const championship = championshipById.get(booking.championshipId);
    if (!championship || championship.promotionId !== booking.promotionId) {
      throw new Error("persisted championship booking title belongs to another promotion");
    }

    const championshipKey = `${booking.eventId}:${booking.championshipId}`;
    const matchKey = `${booking.eventId}:${booking.matchId}`;
    if (championshipKeys.has(championshipKey)) throw new Error("persisted event double-books one championship");
    if (matchKeys.has(matchKey)) throw new Error("persisted match is assigned to multiple championships");
    championshipKeys.add(championshipKey);
    matchKeys.add(matchKey);
  }
}

/**
 * Convert live simulation state into the current persistence schema without
 * mutating the live World. Persistence metadata is intentionally outside the
 * deterministic World object and therefore does not participate in wrestling
 * outcomes.
 */
export function createPersistedWorldState(state: WorldState): PersistedWorldStateV3 {
  return clone({
    stateSchemaVersion: CURRENT_WORLD_STATE_SCHEMA_VERSION,
    world: state.world,
    ruleset: state.ruleset,
    markets: state.markets,
    venues: state.venues,
    promotions: state.promotions,
    promotionMarketStates: state.promotionMarketStates,
    promotionStandings: state.promotionStandings ?? [],
    promotionTalentTrust: state.promotionTalentTrust ?? [],
    promotionSurvivalStates: state.promotionSurvivalStates ?? [],
    people: state.people,
    contracts: state.contracts,
    contractOffers: state.contractOffers,
    events: state.events,
    scheduledAppearances: state.scheduledAppearances,
    matches: state.matches,
    matchParticipants: state.matchParticipants,
    injuries: state.injuries,
    workingChemistry: state.workingChemistry,
    teams: state.teams ?? [],
    teamMemberships: state.teamMemberships ?? [],
    championships: state.championships ?? [],
    championshipReigns: state.championshipReigns ?? [],
    championshipContests: state.championshipContests ?? [],
    championshipMatchBookings: state.championshipMatchBookings ?? [],
    entityIdCounters: snapshotEntityIdCounters(state),
    financialTransactions: state.financialTransactions,
    ledger: state.ledger,
  });
}

function restoreV3(snapshot: PersistedWorldStateV3): WorldState {
  validateChampionshipMatchBookings(snapshot);
  const {
    stateSchemaVersion: _stateSchemaVersion,
    entityIdCounters,
    promotionTalentTrust,
    ...base
  } = clone(snapshot);

  const state: WorldState = {
    ...base,
    promotionTalentTrust,
  };
  const validatedCounters = validateEntityIdCounters(entityIdCounters, state);
  registerEntityIdCounters(state, validatedCounters);
  return state;
}

/**
 * Validate, migrate when necessary, and restore a detached runtime WorldState.
 * Deep domain invariants remain the responsibility of the normal simulation
 * invariant suite after load/migration.
 */
export function restorePersistedWorldState(input: unknown): WorldState {
  if (!isRecord(input)) throw new Error("persisted World state must be an object");
  validateMetadata(input);

  if (input.stateSchemaVersion === 1) {
    validateArrayFields(input, REQUIRED_ARRAY_FIELDS_V1);
    const v2 = migrateV1ToV2(input as unknown as PersistedWorldStateV1);
    return restoreV3(migrateV2ToV3(v2));
  }

  if (input.stateSchemaVersion === 2) {
    validateArrayFields(input, REQUIRED_ARRAY_FIELDS_V2);
    return restoreV3(migrateV2ToV3(input as unknown as PersistedWorldStateV2));
  }

  if (input.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION) {
    validateArrayFields(input, REQUIRED_ARRAY_FIELDS_V2);
    return restoreV3(input as unknown as PersistedWorldStateV3);
  }

  throw new Error(`unsupported World state schema version: ${String(input.stateSchemaVersion)}`);
}

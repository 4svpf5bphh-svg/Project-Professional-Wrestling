import type { WorldState } from "../../domain/src/types.js";
import type { PromotionTalentTrust } from "../../domain/src/talent-trust.js";

export const CURRENT_WORLD_STATE_SCHEMA_VERSION = 1 as const;
export type WorldStateSchemaVersion = typeof CURRENT_WORLD_STATE_SCHEMA_VERSION;

/**
 * Persistence boundary for one complete deterministic World snapshot.
 *
 * Runtime WorldState deliberately still permits a few lazily-created collections
 * while the simulation is being hardened. Persisted state does not: every
 * collection is materialized so migrations have one explicit shape to target.
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

export type PersistedWorldState = PersistedWorldStateV1;

const REQUIRED_ARRAY_FIELDS = [
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Convert live simulation state into the current persistence schema without
 * mutating the live World. Persistence metadata is intentionally outside the
 * deterministic World object and therefore does not participate in simulation
 * hashes or wrestling outcomes.
 */
export function createPersistedWorldState(state: WorldState): PersistedWorldStateV1 {
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
    financialTransactions: state.financialTransactions,
    ledger: state.ledger,
  });
}

/**
 * Validate the top-level persistence contract and restore a detached runtime
 * WorldState. Deep domain invariants remain the responsibility of the normal
 * simulation invariant suite after load/migration.
 */
export function restorePersistedWorldState(input: unknown): WorldState {
  if (!isRecord(input)) throw new Error("persisted World state must be an object");
  if (input.stateSchemaVersion !== CURRENT_WORLD_STATE_SCHEMA_VERSION) {
    throw new Error(`unsupported World state schema version: ${String(input.stateSchemaVersion)}`);
  }
  if (!isRecord(input.world)) throw new Error("persisted World state is missing world metadata");
  if (!isRecord(input.ruleset)) throw new Error("persisted World state is missing ruleset metadata");

  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(input[field])) {
      throw new Error(`persisted World state field ${field} must be an array`);
    }
  }

  const snapshot = input as unknown as PersistedWorldStateV1;
  if (snapshot.world.rulesetVersion !== snapshot.ruleset.version) {
    throw new Error(
      `persisted World ruleset mismatch: world=${snapshot.world.rulesetVersion}, state=${snapshot.ruleset.version}`,
    );
  }

  const {
    stateSchemaVersion: _stateSchemaVersion,
    promotionTalentTrust,
    ...base
  } = clone(snapshot);

  return {
    ...base,
    promotionTalentTrust,
  };
}

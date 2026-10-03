from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f"{path}: expected {count} occurrences of {old!r}, found {actual}")
    write(path, text.replace(old, new))


# Export allocator.
replace(
    "packages/sim-core/src/index.ts",
    'export * from "./human-routine.js";\n',
    'export * from "./human-routine.js";\nexport * from "./id-allocator.js";\n',
)

# Contracts and offers.
replace(
    "packages/sim-core/src/contracts.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { nextEntityId } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/contracts.ts",
    'id: `contract-${String(state.contracts.length + 1).padStart(6, "0")}`,',
    'id: nextEntityId(state, "contract"),',
)
replace(
    "packages/sim-core/src/contracts.ts",
    'id: `offer-${String(state.contractOffers.length + 1).padStart(7, "0")}`,',
    'id: nextEntityId(state, "contractOffer"),',
)
replace(
    "packages/sim-core/src/human-contracts.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { nextEntityId } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/human-contracts.ts",
    'id: `offer-${String(state.contractOffers.length + 1).padStart(7, "0")}`,',
    'id: nextEntityId(state, "contractOffer"),',
)

# Events and appearances.
replace(
    "packages/sim-core/src/events.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { nextEntityId } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/events.ts",
    'id: `event-${String(state.events.length + 1).padStart(7, "0")}`,',
    'id: nextEntityId(state, "event"),',
    2,
)
replace(
    "packages/sim-core/src/events.ts",
    'id: `appearance-${String(state.scheduledAppearances.length + 1).padStart(8, "0")}`,',
    'id: nextEntityId(state, "scheduledAppearance"),',
    2,
)

# Human and AI match creation.
replace(
    "packages/sim-core/src/human-booking.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { nextEntityId } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/human-booking.ts",
    'id: `match-${String(state.matches.length + 1).padStart(8, "0")}`,',
    'id: nextEntityId(state, "match"),',
)
replace(
    "packages/sim-core/src/human-booking.ts",
    'id: `match-participant-${String(state.matchParticipants.length + 1).padStart(9, "0")}`,',
    'id: nextEntityId(state, "matchParticipant"),',
)
replace(
    "packages/sim-core/src/matches.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { nextEntityId } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/matches.ts",
    'id: `chemistry-${String(state.workingChemistry.length + 1).padStart(7, "0")}`,',
    'id: nextEntityId(state, "workingChemistry"),',
)
replace(
    "packages/sim-core/src/matches.ts",
    'const id = `match-${String(state.matches.length + 1).padStart(8, "0")}`;',
    'const id = nextEntityId(state, "match");',
)
replace(
    "packages/sim-core/src/matches.ts",
    'id: `match-participant-${String(state.matchParticipants.length + 1).padStart(9, "0")}`,',
    'id: nextEntityId(state, "matchParticipant"),',
)

# Career-generated entities.
replace(
    "packages/sim-core/src/career.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { allocateEntityId, nextEntityId } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/career.ts",
    'id: `injury-${String(state.injuries.length + 1).padStart(7, "0")}`,',
    'id: nextEntityId(state, "injury"),',
)
replace(
    "packages/sim-core/src/career.ts",
    'function generatedProspect(state: WorldState, index: number): Person {',
    'function generatedProspect(state: WorldState, index: number, id: string): Person {',
)
replace(
    "packages/sim-core/src/career.ts",
    'id: `person-${String(index).padStart(4, "0")}`,',
    'id,',
)
replace(
    "packages/sim-core/src/career.ts",
    '    const person = generatedProspect(state, state.people.length + 1);',
    '    const allocation = allocateEntityId(state, "person");\n    const person = generatedProspect(state, allocation.sequence, allocation.id);',
)

# Competition entities.
replace(
    "packages/sim-core/src/competition.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { nextEntityId } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/competition.ts",
    'id: `team-${String(teams(state).length + 1).padStart(7, "0")}`,',
    'id: nextEntityId(state, "team"),',
)
replace(
    "packages/sim-core/src/competition.ts",
    'id: `team-membership-${String(teamMemberships(state).length + 1).padStart(8, "0")}`,',
    'id: nextEntityId(state, "teamMembership"),',
)
replace(
    "packages/sim-core/src/competition.ts",
    'id: `championship-${String(championships(state).length + 1).padStart(6, "0")}`,',
    'id: nextEntityId(state, "championship"),',
)
replace(
    "packages/sim-core/src/competition.ts",
    'id: `championship-reign-${String(championshipReigns(state).length + 1).padStart(7, "0")}`,',
    'id: nextEntityId(state, "championshipReign"),',
)
replace(
    "packages/sim-core/src/competition.ts",
    'id: `championship-contest-${String(championshipContests(state).length + 1).padStart(8, "0")}`,',
    'id: nextEntityId(state, "championshipContest"),',
)

# Finance rows.
replace(
    "packages/sim-core/src/transactions.ts",
    'import type { FinancialTransaction, FinancialTransactionCategory, Promotion, WorldState } from "../../domain/src/types.js";\n',
    'import type { FinancialTransaction, FinancialTransactionCategory, Promotion, WorldState } from "../../domain/src/types.js";\nimport { nextEntityId } from "./id-allocator.js";\n',
)
replace(
    "packages/sim-core/src/transactions.ts",
    'id: `finance-${String(state.financialTransactions.length + 1).padStart(8, "0")}`,',
    'id: nextEntityId(state, "financialTransaction"),',
)

# Bind a newly-created World to counters before its first Ledger/contract row.
replace(
    "packages/sim-core/src/genesis.ts",
    'import { LedgerWriter } from "./ledger.js";\n',
    'import { registerEntityIdCounters } from "./id-allocator.js";\nimport { LedgerWriter } from "./ledger.js";\n',
)
replace(
    "packages/sim-core/src/genesis.ts",
    'const writer=new LedgerWriter(worldId,state.ledger);',
    'registerEntityIdCounters(state);const writer=new LedgerWriter(worldId,state.ledger);',
)

# Persistence Schema v3: counters are explicit persisted metadata. v1/v2 still migrate.
path = "packages/sim-core/src/state-schema.ts"
text = read(path)
text = text.replace(
    'import type { PromotionTalentTrust } from "../../domain/src/talent-trust.js";\n',
    'import type { PromotionTalentTrust } from "../../domain/src/talent-trust.js";\nimport {\n  deriveEntityIdCounters,\n  registerEntityIdCounters,\n  snapshotEntityIdCounters,\n  validateEntityIdCounters,\n  type EntityIdCounters,\n} from "./id-allocator.js";\n',
)
text = text.replace(
    'export const CURRENT_WORLD_STATE_SCHEMA_VERSION = 2 as const;\nexport type WorldStateSchemaVersion = 1 | typeof CURRENT_WORLD_STATE_SCHEMA_VERSION;',
    'export const CURRENT_WORLD_STATE_SCHEMA_VERSION = 3 as const;\nexport type WorldStateSchemaVersion = 1 | 2 | typeof CURRENT_WORLD_STATE_SCHEMA_VERSION;',
)
old = '''export interface PersistedWorldStateV2 extends Omit<PersistedWorldStateV1, "stateSchemaVersion"> {\n  stateSchemaVersion: 2;\n  championshipMatchBookings: ChampionshipMatchBooking[];\n}\n\nexport type PersistedWorldState = PersistedWorldStateV2;'''
new = '''export interface PersistedWorldStateV2 extends Omit<PersistedWorldStateV1, "stateSchemaVersion"> {\n  stateSchemaVersion: 2;\n  championshipMatchBookings: ChampionshipMatchBooking[];\n}\n\n/**\n * Schema v3 persists per-World entity allocation counters. Counters may be\n * ahead of the currently loaded hot collections after historical rows are\n * archived, but may never fall behind an ID still present in loaded state.\n */\nexport interface PersistedWorldStateV3 extends Omit<PersistedWorldStateV2, "stateSchemaVersion"> {\n  stateSchemaVersion: 3;\n  entityIdCounters: EntityIdCounters;\n}\n\nexport type PersistedWorldState = PersistedWorldStateV3;'''
if old not in text:
    raise RuntimeError("state-schema: V2 interface block not found")
text = text.replace(old, new)
text = text.replace(
    '    stateSchemaVersion: CURRENT_WORLD_STATE_SCHEMA_VERSION,\n    championshipMatchBookings: migrateV1TitleBookings(snapshot),',
    '    stateSchemaVersion: 2,\n    championshipMatchBookings: migrateV1TitleBookings(snapshot),',
    1,
)
marker = '''function validateChampionshipMatchBookings(snapshot: PersistedWorldStateV2): void {'''
if marker not in text:
    raise RuntimeError("state-schema: booking validator marker not found")
text = text.replace(
    marker,
    '''function migrateV2ToV3(snapshot: PersistedWorldStateV2): PersistedWorldStateV3 {\n  const { stateSchemaVersion: _oldVersion, ...rest } = clone(snapshot);\n  return {\n    ...rest,\n    stateSchemaVersion: CURRENT_WORLD_STATE_SCHEMA_VERSION,\n    entityIdCounters: deriveEntityIdCounters(snapshot as unknown as WorldState),\n  };\n}\n\nfunction validateChampionshipMatchBookings(snapshot: PersistedWorldStateV2 | PersistedWorldStateV3): void {''',
)
text = text.replace(
    'export function createPersistedWorldState(state: WorldState): PersistedWorldStateV2 {',
    'export function createPersistedWorldState(state: WorldState): PersistedWorldStateV3 {',
)
text = text.replace(
    '    championshipMatchBookings: state.championshipMatchBookings ?? [],\n    financialTransactions: state.financialTransactions,',
    '    championshipMatchBookings: state.championshipMatchBookings ?? [],\n    entityIdCounters: snapshotEntityIdCounters(state),\n    financialTransactions: state.financialTransactions,',
)
start = text.index('function restoreV2(snapshot: PersistedWorldStateV2): WorldState {')
end = text.index('/**\n * Validate, migrate when necessary', start)
restore_v3 = '''function restoreV3(snapshot: PersistedWorldStateV3): WorldState {\n  validateChampionshipMatchBookings(snapshot);\n  const {\n    stateSchemaVersion: _stateSchemaVersion,\n    entityIdCounters,\n    promotionTalentTrust,\n    ...base\n  } = clone(snapshot);\n\n  const state: WorldState = {\n    ...base,\n    promotionTalentTrust,\n  };\n  const validatedCounters = validateEntityIdCounters(entityIdCounters, state);\n  registerEntityIdCounters(state, validatedCounters);\n  return state;\n}\n\n'''
text = text[:start] + restore_v3 + text[end:]
start = text.index('export function restorePersistedWorldState(input: unknown): WorldState {')
new_restore = '''export function restorePersistedWorldState(input: unknown): WorldState {\n  if (!isRecord(input)) throw new Error("persisted World state must be an object");\n  validateMetadata(input);\n\n  if (input.stateSchemaVersion === 1) {\n    validateArrayFields(input, REQUIRED_ARRAY_FIELDS_V1);\n    const v2 = migrateV1ToV2(input as unknown as PersistedWorldStateV1);\n    return restoreV3(migrateV2ToV3(v2));\n  }\n\n  if (input.stateSchemaVersion === 2) {\n    validateArrayFields(input, REQUIRED_ARRAY_FIELDS_V2);\n    return restoreV3(migrateV2ToV3(input as unknown as PersistedWorldStateV2));\n  }\n\n  if (input.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION) {\n    validateArrayFields(input, REQUIRED_ARRAY_FIELDS_V2);\n    return restoreV3(input as unknown as PersistedWorldStateV3);\n  }\n\n  throw new Error(`unsupported World state schema version: ${String(input.stateSchemaVersion)}`);\n}\n'''
text = text[:start] + new_restore
write(path, text)

# Update current persistence tests for Schema v3.
path = "tests/run-state-schema-tests.ts"
text = read(path)
text = text.replace(
    '  ok(snapshot.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "snapshot schema version is missing or incorrect");',
    '  ok(snapshot.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "snapshot schema version is missing or incorrect");\n  ok(typeof snapshot.entityIdCounters === "object", "entity ID counters were not persisted");',
)
text = text.replace(
    '    championshipMatchBookings: _discardV2LiveState,\n    stateSchemaVersion: _discardV2Version,',
    '    championshipMatchBookings: _discardV2LiveState,\n    entityIdCounters: _discardV3Counters,\n    stateSchemaVersion: _discardV3Version,',
)
text = text.replace(
    'test("schema v1 migrates unresolved Ledger title intent into explicit v2 live state", () => {',
    'test("schema v1 migrates unresolved Ledger title intent through the current live state", () => {',
)
text = text.replace(
    'ok(snapshot.stateSchemaVersion === 2, "title booking snapshot did not use schema v2");',
    'ok(snapshot.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "title booking snapshot did not use current schema");',
)
text = text.replace(
    '  const missingBookings = { ...snapshot, championshipMatchBookings: undefined };\n  expectReject(() => restorePersistedWorldState(missingBookings), "field championshipMatchBookings must be an array");',
    '  const missingBookings = { ...snapshot, championshipMatchBookings: undefined };\n  expectReject(() => restorePersistedWorldState(missingBookings), "field championshipMatchBookings must be an array");\n\n  const missingCounters = { ...snapshot, entityIdCounters: undefined };\n  expectReject(() => restorePersistedWorldState(missingCounters), "persisted entity ID counters must be an object");',
)
write(path, text)

# Dedicated allocator tests, including archival/pruning behavior.
id_tests = r'''declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  LedgerWriter,
  createPersistedWorldState,
  createWorld,
  formatEntityId,
  recordFinancialTransaction,
  resolveWorldWeeks,
  restorePersistedWorldState,
  snapshotEntityIdCounters,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function expectReject(fn: () => void, fragment: string): void {
  let message = "";
  try {
    fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  ok(message.includes(fragment), `expected rejection containing "${fragment}", got "${message}"`);
}

test("Genesis registers counters that match every already-created ID family", () => {
  const state = createWorld(23001, DEFAULT_RULESET);
  const counters = snapshotEntityIdCounters(state);
  ok(counters.market === state.markets.length, "market counter does not match Genesis IDs");
  ok(counters.venue === state.venues.length, "venue counter does not match Genesis IDs");
  ok(counters.promotion === state.promotions.length, "promotion counter does not match Genesis IDs");
  ok(counters.person === state.people.length, "person counter does not match Genesis IDs");
  ok(counters.contract === state.contracts.length, "contract counter does not match Genesis IDs");
  ok(counters.ledger === state.ledger.length, "Ledger counter does not match Genesis IDs");
});

test("persisted counters survive pruned hot history and prevent ID reuse", () => {
  const state = createWorld(23002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 8);
  const snapshot = createPersistedWorldState(state);
  const financeCounter = snapshot.entityIdCounters.financialTransaction;
  const ledgerCounter = snapshot.entityIdCounters.ledger;
  ok(financeCounter > 20 && ledgerCounter > 20, "fixture did not create enough historical IDs");

  snapshot.financialTransactions = snapshot.financialTransactions.slice(-3);
  snapshot.ledger = snapshot.ledger.slice(-3);
  const restored = restorePersistedWorldState(snapshot);
  const promotion = restored.promotions[0]!;
  const transaction = recordFinancialTransaction(restored, promotion, "MEDIA_INCOME", 0, "id-counter-test");
  ok(
    transaction.id === formatEntityId("financialTransaction", financeCounter + 1),
    `pruned finance history reused an old ID: ${transaction.id}`,
  );

  const ledgerEntry = new LedgerWriter(restored.world.id, restored.ledger).append({
    date: restored.world.currentDate,
    type: "ID_COUNTER_TEST",
  });
  ok(ledgerEntry.order === ledgerCounter + 1, "pruned Ledger history reset global Ledger order");
  ok(ledgerEntry.id === formatEntityId("ledger", ledgerCounter + 1), "pruned Ledger history reused an old ID");
});

test("schema v2 migration derives counters from the highest existing IDs", () => {
  const state = createWorld(23003, DEFAULT_RULESET);
  resolveWorldWeeks(state, 5);
  const current = createPersistedWorldState(state);
  const expected = current.entityIdCounters;
  const { entityIdCounters: _discardCounters, stateSchemaVersion: _discardVersion, ...body } = current;
  const legacyV2 = { ...body, stateSchemaVersion: 2 as const };
  const restored = restorePersistedWorldState(legacyV2);
  const migrated = snapshotEntityIdCounters(restored);
  ok(JSON.stringify(migrated) === JSON.stringify(expected), "schema v2 migration derived different entity counters");
});

test("current schema rejects a counter that falls behind a loaded entity ID", () => {
  const state = createWorld(23004, DEFAULT_RULESET);
  const snapshot = createPersistedWorldState(state);
  snapshot.entityIdCounters.contract = 0;
  expectReject(() => restorePersistedWorldState(snapshot), "counter contract is behind loaded World state");
});

console.log(`\nID allocation tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
'''
write("tests/run-id-allocation-tests.ts", id_tests)

# Wire the new suite into npm test.
path = "package.json"
text = read(path)
text = text.replace(
    '    "test:state-schema": "node dist/tests/run-state-schema-tests.js",\n',
    '    "test:state-schema": "node dist/tests/run-state-schema-tests.js",\n    "test:id-allocation": "node dist/tests/run-id-allocation-tests.js",\n',
)
text = text.replace(
    ' && npm run test:human-routine && npm run test:state-schema",',
    ' && npm run test:human-routine && npm run test:state-schema && npm run test:id-allocation",',
)
write(path, text)

print("ID counter slice applied")

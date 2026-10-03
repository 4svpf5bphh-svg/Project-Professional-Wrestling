declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  CURRENT_WORLD_STATE_SCHEMA_VERSION,
  activeContractsForPromotion,
  bookHumanChampionshipMatch,
  claimIndependentPromotionForHuman,
  createPersistedWorldState,
  createWorld,
  deterministicWorldHash,
  ensureWorldChampionships,
  prepareHumanMatchCard,
  prepareHumanShow,
  resolveWorldWeeks,
  restorePersistedWorldState,
  validateWorldInvariants,
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

function humanTitleFixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionForHuman(state, promotion.id, { name: "Persistence Wrestling" });
  const participantIds = [...new Set(
    activeContractsForPromotion(state, promotion.id)
      .map((contract) => contract.personId)
      .filter((personId) => state.people.find((person) => person.id === personId)?.status === "ACTIVE"),
  )].slice(0, 10);
  ok(participantIds.length === 10, "expected enough wrestlers for persistence title fixture");
  const venue = state.venues.find((candidate) => candidate.marketId === promotion.homeMarketId)!;
  const event = prepareHumanShow(state, {
    promotionId: promotion.id,
    marketId: promotion.homeMarketId,
    venueId: venue.id,
    day: 5,
    ticketStrategy: "STANDARD",
    participantIds,
  });
  const matches = prepareHumanMatchCard(state, event.id, [
    { type: "SINGLES", sideAIds: [participantIds[0]!], sideBIds: [participantIds[1]!], intendedWinnerSide: "A", intent: "COMPETITIVE", plannedLengthMinutes: 10 },
    { type: "SINGLES", sideAIds: [participantIds[2]!], sideBIds: [participantIds[3]!], intendedWinnerSide: "B", intent: "STORY", plannedLengthMinutes: 12 },
    { type: "SINGLES", sideAIds: [participantIds[4]!], sideBIds: [participantIds[5]!], intendedWinnerSide: "A", intent: "TECHNICAL", plannedLengthMinutes: 14 },
    { type: "SINGLES", sideAIds: [participantIds[6]!], sideBIds: [participantIds[7]!], intendedWinnerSide: "B", intent: "SHOWCASE", plannedLengthMinutes: 11 },
    { type: "SINGLES", sideAIds: [participantIds[8]!], sideBIds: [participantIds[9]!], intendedWinnerSide: "A", intent: "EPIC", plannedLengthMinutes: 18 },
  ]);
  ensureWorldChampionships(state);
  const championship = state.championships!.find(
    (candidate) => candidate.promotionId === promotion.id && candidate.division === "SINGLES",
  )!;
  bookHumanChampionshipMatch(state, event.id, matches[2]!.id, championship.id);
  return { state, promotion, event, match: matches[2]!, championship };
}

test("persisted World state has an explicit schema version and materializes lazy collections", () => {
  const state = createWorld(22001, DEFAULT_RULESET);
  ok(state.promotionStandings === undefined, "fixture unexpectedly initialized promotion standings");
  ok(state.teams === undefined, "fixture unexpectedly initialized teams");
  ok(state.championshipMatchBookings === undefined, "fixture unexpectedly initialized championship booking state");

  const snapshot = createPersistedWorldState(state);

  ok(snapshot.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "snapshot schema version is missing or incorrect");
  ok(typeof snapshot.entityIdCounters === "object", "entity ID counters were not persisted");
  ok(Array.isArray(snapshot.promotionStandings), "promotion standings were not materialized");
  ok(Array.isArray(snapshot.promotionTalentTrust), "talent trust was not materialized");
  ok(Array.isArray(snapshot.promotionSurvivalStates), "survival state was not materialized");
  ok(Array.isArray(snapshot.teams), "teams were not materialized");
  ok(Array.isArray(snapshot.teamMemberships), "team memberships were not materialized");
  ok(Array.isArray(snapshot.championships), "championships were not materialized");
  ok(Array.isArray(snapshot.championshipReigns), "championship reigns were not materialized");
  ok(Array.isArray(snapshot.championshipContests), "championship contests were not materialized");
  ok(Array.isArray(snapshot.championshipMatchBookings), "championship match bookings were not materialized");
  ok(state.promotionStandings === undefined, "serializing mutated the live promotion standings collection");
  ok(state.teams === undefined, "serializing mutated the live teams collection");
  ok(state.championshipMatchBookings === undefined, "serializing mutated live championship booking state");
});

test("JSON persistence round-trip preserves the deterministic World and future resolution", () => {
  const original = createWorld(22002, DEFAULT_RULESET);
  resolveWorldWeeks(original, 26);

  const beforeHash = deterministicWorldHash(original);
  const json = JSON.stringify(createPersistedWorldState(original));
  const restored = restorePersistedWorldState(JSON.parse(json));

  ok(deterministicWorldHash(restored) === beforeHash, "restored World hash differs immediately after persistence round-trip");
  ok(validateWorldInvariants(restored).length === 0, "restored World violates invariants");

  resolveWorldWeeks(original, 26);
  resolveWorldWeeks(restored, 26);
  ok(deterministicWorldHash(restored) === deterministicWorldHash(original), "restored World diverged during future deterministic resolution");
});

test("restored World state is detached from the persisted snapshot object", () => {
  const state = createWorld(22003, DEFAULT_RULESET);
  const snapshot = createPersistedWorldState(state);
  const originalCash = snapshot.promotions[0]!.cash;
  const restored = restorePersistedWorldState(snapshot);

  restored.promotions[0]!.cash += 12345;
  ok(snapshot.promotions[0]!.cash === originalCash, "mutating restored state also mutated persisted snapshot data");
});

test("schema v1 migrates unresolved Ledger title intent through the current live state", () => {
  const { state, event, match, championship } = humanTitleFixture(22004);
  const current = createPersistedWorldState(state);
  const {
    championshipMatchBookings: _discardV2LiveState,
    entityIdCounters: _discardV3Counters,
    stateSchemaVersion: _discardV3Version,
    ...legacyBody
  } = current;
  const legacyV1 = { ...legacyBody, stateSchemaVersion: 1 };

  const restored = restorePersistedWorldState(legacyV1);
  const booking = restored.championshipMatchBookings?.find(
    (candidate) => candidate.eventId === event.id && candidate.championshipId === championship.id,
  );
  ok(Boolean(booking), "v1 migration did not reconstruct unresolved title intent from historical Ledger data");
  ok(booking!.matchId === match.id, "v1 migration reconstructed the wrong title match");
  ok(
    deterministicWorldHash(restored) === deterministicWorldHash(state),
    "v1 migration changed deterministic current World state",
  );
});

test("current schema persists live title intent independently of Ledger interpretation", () => {
  const { state, event, match, championship } = humanTitleFixture(22005);
  const snapshot = createPersistedWorldState(state);
  const restored = restorePersistedWorldState(JSON.parse(JSON.stringify(snapshot)));
  const booking = restored.championshipMatchBookings?.[0];

  ok(snapshot.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "title booking snapshot did not use current schema");
  ok(Boolean(booking), "live title booking did not survive current-schema persistence");
  ok(booking!.eventId === event.id && booking!.matchId === match.id && booking!.championshipId === championship.id, "restored live title booking changed identity");
  ok(deterministicWorldHash(restored) === deterministicWorldHash(state), "live title booking round-trip changed deterministic state");
});

test("unsupported persistence schema versions are rejected before restore", () => {
  const snapshot = createPersistedWorldState(createWorld(22006, DEFAULT_RULESET));
  const unsupported = { ...snapshot, stateSchemaVersion: 999 };
  expectReject(() => restorePersistedWorldState(unsupported), "unsupported World state schema version");
});

test("missing or corrupt mandatory persisted booking state is rejected", () => {
  const snapshot = createPersistedWorldState(createWorld(22007, DEFAULT_RULESET));
  const missingMatches = { ...snapshot, matches: undefined };
  expectReject(() => restorePersistedWorldState(missingMatches), "field matches must be an array");

  const missingBookings = { ...snapshot, championshipMatchBookings: undefined };
  expectReject(() => restorePersistedWorldState(missingBookings), "field championshipMatchBookings must be an array");

  const missingCounters = { ...snapshot, entityIdCounters: undefined };
  expectReject(() => restorePersistedWorldState(missingCounters), "persisted entity ID counters must be an object");

  const mismatch = structuredClone(snapshot);
  mismatch.world.rulesetVersion = "different-ruleset";
  expectReject(() => restorePersistedWorldState(mismatch), "persisted World ruleset mismatch");

  const titleFixture = humanTitleFixture(22008);
  const corrupt = createPersistedWorldState(titleFixture.state);
  corrupt.championshipMatchBookings[0]!.eventId = "missing-event";
  expectReject(() => restorePersistedWorldState(corrupt), "requires a scheduled event");
});

console.log(`\nState schema tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

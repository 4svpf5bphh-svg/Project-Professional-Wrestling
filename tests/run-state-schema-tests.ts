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
  ok(state.programmes === undefined, "fixture unexpectedly initialized Programme state");

  const snapshot = createPersistedWorldState(state);

  ok(snapshot.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "snapshot schema version is missing or incorrect");
  ok(typeof snapshot.entityIdCounters === "object", "entity ID counters were not persisted");
  ok(Array.isArray(snapshot.promotionStandings), "promotion standings were not materialized");
  ok(Array.isArray(snapshot.promotionTalentTrust), "talent trust was not materialized");
  ok(Array.isArray(snapshot.promotionSurvivalStates), "survival state was not materialized");
  ok(Array.isArray(snapshot.teams), "teams were not materialized");
  ok(Array.isArray(snapshot.teamMemberships), "team memberships were not materialized");
  ok(Array.isArray(snapshot.stables) && Array.isArray(snapshot.stableMemberships), "stable collections were not persisted");
  ok(snapshot.entityIdCounters.stable === 0 && snapshot.entityIdCounters.stableMembership === 0, "new stable counters were not initialized");
  ok(Array.isArray(snapshot.championships), "championships were not materialized");
  ok(Array.isArray(snapshot.championshipReigns), "championship reigns were not materialized");
  ok(Array.isArray(snapshot.championshipContests), "championship contests were not materialized");
  ok(Array.isArray(snapshot.championshipMatchBookings), "championship match bookings were not materialized");
  ok(Array.isArray(snapshot.programmes), "Programmes were not materialized");
  ok(Array.isArray(snapshot.programmeActivities), "Programme activities were not materialized");
  ok(Array.isArray(snapshot.promotionWrestlerPresentations), "promotion wrestler presentation was not materialized");
  ok(Array.isArray(snapshot.wrestlerRelationships), "wrestler relationships were not materialized");
  ok(Array.isArray(snapshot.wrestlerPromotionAffiliations), "wrestler promotion affiliations were not materialized");
  ok(state.promotionStandings === undefined, "serializing mutated the live promotion standings collection");
  ok(state.teams === undefined, "serializing mutated the live teams collection");
  ok(state.championshipMatchBookings === undefined, "serializing mutated live championship booking state");
  ok(state.programmes === undefined, "serializing mutated live Programme state");
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
    stateSchemaVersion: _discardV4Version,
    programmes: _discardV4Programmes,
    programmeActivities: _discardV4Activities,
    promotionWrestlerPresentations: _discardV5Presentation,
    wrestlerRelationships: _discardV6Relationships,
    wrestlerPromotionAffiliations: _discardV6Affiliations,
    ...legacyBody
  } = current;
  const legacyV1 = { ...legacyBody, stateSchemaVersion: 1 };

  const restored = restorePersistedWorldState(legacyV1);
  const booking = restored.championshipMatchBookings?.find(
    (candidate) => candidate.eventId === event.id && candidate.championshipId === championship.id,
  );
  ok(Boolean(booking), "v1 migration did not reconstruct unresolved title intent from historical Ledger data");
  ok(booking!.matchId === match.id, "v1 migration reconstructed the wrong title match");
  ok(restored.programmes?.length === 0 && restored.programmeActivities?.length === 0, "v1 migration did not initialize empty Programme state");
  ok(deterministicWorldHash(restored) === deterministicWorldHash(state), "v1 migration changed deterministic current World state");
});

test("schema v3 upgrades legacy entity counters and initializes Programme collections", () => {
  const snapshot = createPersistedWorldState(createWorld(22009, DEFAULT_RULESET));
  const legacyV3: any = structuredClone(snapshot);
  legacyV3.stateSchemaVersion = 3;
  delete legacyV3.programmes;
  delete legacyV3.programmeActivities;
  delete legacyV3.entityIdCounters.programme;
  delete legacyV3.entityIdCounters.programmeActivity;

  const restored = restorePersistedWorldState(legacyV3);
  const current = createPersistedWorldState(restored);
  ok(restored.programmes?.length === 0 && restored.programmeActivities?.length === 0, "v3 migration did not initialize Programme collections");
  ok(current.entityIdCounters.programme === 0 && current.entityIdCounters.programmeActivity === 0, "v3 migration did not initialize Programme counters");
});

test("schema v4 migrates with empty promotion wrestler presentation state", () => {
  const snapshot = createPersistedWorldState(createWorld(22010, DEFAULT_RULESET));
  const legacyV4: any = structuredClone(snapshot);
  legacyV4.stateSchemaVersion = 4;
  delete legacyV4.promotionWrestlerPresentations;

  const restored = restorePersistedWorldState(legacyV4);
  ok(Array.isArray(restored.promotionWrestlerPresentations), "v4 migration did not initialize presentation state");
  ok(restored.promotionWrestlerPresentations?.length === 0, "v4 migration invented wrestler presentation overrides");
  const current = createPersistedWorldState(restored);
  ok(current.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "v4 migration did not upgrade to current schema");
});

test("schema v7 migrates existing Worlds without inventing stables", () => {
  const world = createWorld(22035, DEFAULT_RULESET);
  const snapshot = createPersistedWorldState(world);
  const legacy: any = structuredClone(snapshot);
  legacy.stateSchemaVersion = 7;
  delete legacy.stables;
  delete legacy.stableMemberships;
  delete legacy.entityIdCounters.stable;
  delete legacy.entityIdCounters.stableMembership;
  const restored = restorePersistedWorldState(legacy);
  ok(Array.isArray(restored.stables) && restored.stables.length === 0,
    "v7 migration did not initialize empty stable identities");
  ok(Array.isArray(restored.stableMemberships) && restored.stableMemberships.length === 0,
    "v7 migration invented stable membership");
  const current = createPersistedWorldState(restored);
  ok(current.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION,
    "v7 migration did not upgrade schema");
  ok(current.entityIdCounters.stable === 0 && current.entityIdCounters.stableMembership === 0,
    "v7 migration did not upgrade stable allocation counters");
  ok(deterministicWorldHash(restored) === deterministicWorldHash(world),
    "migration changed the deterministic World");
});

test("schema v6 migrates promotion-owned show series and event lineage", () => {
  const state = createWorld(22013, DEFAULT_RULESET);
  const snapshot = createPersistedWorldState(state);
  const legacyV6: any = structuredClone(snapshot);
  legacyV6.stateSchemaVersion = 6;
  delete legacyV6.showSeries;
  for (const event of legacyV6.events) delete event.showSeriesId;

  const restored = restorePersistedWorldState(legacyV6);
  ok((restored.showSeries?.length ?? 0) === restored.promotions.length * 2, "v6 migration did not seed flagship and premium show identities");
  ok(restored.showSeries?.every((series) => series.worldId === restored.world.id), "migrated show identity crossed World boundary");
  const current = createPersistedWorldState(restored);
  ok(current.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "v6 migration did not upgrade to current schema");
});

test("schema v5 migrates with empty relationship and roster-affiliation collections", () => {
  const snapshot = createPersistedWorldState(createWorld(22011, DEFAULT_RULESET));
  const legacyV5: any = structuredClone(snapshot);
  legacyV5.stateSchemaVersion = 5;
  delete legacyV5.wrestlerRelationships;
  delete legacyV5.wrestlerPromotionAffiliations;

  const restored = restorePersistedWorldState(legacyV5);
  ok(Array.isArray(restored.wrestlerRelationships), "v5 migration did not initialize wrestler relationships");
  ok(Array.isArray(restored.wrestlerPromotionAffiliations), "v5 migration did not initialize roster affiliations");
  ok(restored.wrestlerRelationships?.length === 0, "v5 migration invented wrestler relationships");
  ok(restored.wrestlerPromotionAffiliations?.length === 0, "v5 migration invented roster affiliations");
});

test("v8 saves migrate to empty portable identities without inventing global character changes", () => {
  const state=createWorld(22910,DEFAULT_RULESET);
  const old=createPersistedWorldState(state);
  const legacy:any=structuredClone(old);
  legacy.stateSchemaVersion=8;
  delete legacy.wrestlerIdentities;
  const restored=restorePersistedWorldState(legacy);
  ok(Array.isArray(restored.wrestlerIdentities)&&restored.wrestlerIdentities.length===0,
    "legacy promotion-local characters were incorrectly promoted to global identities");
  ok(deterministicWorldHash(restored)===deterministicWorldHash(state),
    "v8 migration changed unrelated simulation output");
  const reSaved=createPersistedWorldState(restored);
  ok(reSaved.stateSchemaVersion===CURRENT_WORLD_STATE_SCHEMA_VERSION&&Array.isArray(reSaved.wrestlerIdentities),
    "v8 save did not upgrade safely to the portable identity schema");
});

test("v9 preserves unique wrestler-owned persona eras, move repertoire and clone isolation", () => {
  const state=createWorld(22911,DEFAULT_RULESET);
  const person=state.people[0]!;
  state.wrestlerIdentities=[{
    worldId:state.world.id,personId:person.id,revision:2,
    active:{
      personaName:"The Ring Specialist",gimmickId:"RING_GENERAL",
      primaryStyle:"TECHNICAL",secondaryStyle:"SUBMISSION",
      signatureMoves:[{name:"Bridge Lock",category:"SUBMISSION"}],
      finishingMoves:[{name:"Final Hold",category:"SUBMISSION"}],
      introducedDate:{year:2,week:4,day:1},provenance:"NEGOTIATED",
    },
    history:[{
      persona:{
        personaName:person.name,gimmickId:"AUTHENTIC",
        primaryStyle:"ALL_ROUNDER",secondaryStyle:null,
        signatureMoves:[],finishingMoves:[],
        introducedDate:{year:1,week:1,day:1},provenance:"LEGACY_MIGRATED",
      },
      endedDate:{year:2,week:4,day:1},changedByPromotionId:state.promotions[0]!.id,
    }],
  }];
  const saved=createPersistedWorldState(state);
  const restored=restorePersistedWorldState(JSON.parse(JSON.stringify(saved)));
  ok(restored.wrestlerIdentities?.[0]?.active.signatureMoves[0]?.name==="Bridge Lock"
    &&restored.wrestlerIdentities[0]?.history[0]?.persona.personaName===person.name,
    "portable persona, era or move set lost during persistence");
  restored.wrestlerIdentities![0]!.active.signatureMoves[0]!.name="Altered In Copy";
  ok(saved.wrestlerIdentities[0]!.active.signatureMoves[0]!.name==="Bridge Lock",
    "restored identity mutated the saved snapshot");
  state.wrestlerIdentities.push(structuredClone(state.wrestlerIdentities[0]!));
  let refused=false;
  try{createPersistedWorldState(state);}catch{refused=true;}
  ok(refused,"duplicate wrestler career records must never be accepted");
  state.wrestlerIdentities[1]!.personId="missing-person";
  refused=false;
  try{createPersistedWorldState(state);}catch{refused=true;}
  ok(refused,"orphaned portable persona records must never be accepted");
});

test("current schema persists relationship and multi-promotion roster state", () => {
  const state = createWorld(22012, DEFAULT_RULESET);
  const person = state.people[0]!;
  state.wrestlerRelationships = [{
    id: "wrestler-relationship:p1:p2",
    worldId: state.world.id,
    personAId: state.people[0]!.id < state.people[1]!.id ? state.people[0]!.id : state.people[1]!.id,
    personBId: state.people[0]!.id < state.people[1]!.id ? state.people[1]!.id : state.people[0]!.id,
    affinity: 10,
    professionalTrust: 20,
    rivalryHeat: 30,
    familiarity: 40,
    tags: ["ALLY"],
  }];
  state.wrestlerPromotionAffiliations = [{
    worldId: state.world.id,
    personId: person.id,
    promotionId: state.promotions[0]!.id,
    role: "PRIMARY",
    basis: "CONTRACT",
  }];
  const restored = restorePersistedWorldState(JSON.parse(JSON.stringify(createPersistedWorldState(state))));
  ok(restored.wrestlerRelationships?.length === 1, "relationship state did not survive persistence");
  ok(restored.wrestlerPromotionAffiliations?.length === 1, "roster-affiliation state did not survive persistence");
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

  const missingProgrammes = { ...snapshot, programmes: undefined };
  expectReject(() => restorePersistedWorldState(missingProgrammes), "field programmes must be an array");

  const missingActivities = { ...snapshot, programmeActivities: undefined };
  expectReject(() => restorePersistedWorldState(missingActivities), "field programmeActivities must be an array");

  const missingPresentation = { ...snapshot, promotionWrestlerPresentations: undefined };
  expectReject(() => restorePersistedWorldState(missingPresentation), "field promotionWrestlerPresentations must be an array");

  const missingRelationships = { ...snapshot, wrestlerRelationships: undefined };
  expectReject(() => restorePersistedWorldState(missingRelationships), "field wrestlerRelationships must be an array");

  const missingAffiliations = { ...snapshot, wrestlerPromotionAffiliations: undefined };
  expectReject(() => restorePersistedWorldState(missingAffiliations), "field wrestlerPromotionAffiliations must be an array");

  const missingStables = { ...snapshot, stables: undefined };
  expectReject(() => restorePersistedWorldState(missingStables), "field stables must be an array");
  const missingMembers = { ...snapshot, stableMemberships: undefined };
  expectReject(() => restorePersistedWorldState(missingMembers), "field stableMemberships must be an array");

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
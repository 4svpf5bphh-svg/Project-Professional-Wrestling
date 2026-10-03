declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPromotion,
  createWorld,
  deterministicWorldHash,
  ensurePromotionStandings,
  ensurePromotionTalentTrust,
  LedgerWriter,
  processTalentTrustForWeek,
  promotionTalentTrustFor,
  resolveWorldWeeks,
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

test("contract relationships create one neutral trust record per wrestler and promotion", () => {
  const state = createWorld(10401, DEFAULT_RULESET);
  const relationships = ensurePromotionTalentTrust(state);
  const contractPairs = new Set(state.contracts.map((contract) => `${contract.promotionId}|${contract.personId}`));
  const relationshipPairs = new Set(relationships.map((entry) => `${entry.promotionId}|${entry.personId}`));
  ok(relationships.length === contractPairs.size, `expected ${contractPairs.size} trust relationships, got ${relationships.length}`);
  ok(relationshipPairs.size === relationships.length, "duplicate wrestler-promotion trust relationships were created");
  ok(relationships.every((entry) => entry.trust === 50), "new trust relationships should begin neutral at 50");
});

test("global diagnostic hash includes promotion standing and wrestler trust state", () => {
  const state = createWorld(10405, DEFAULT_RULESET);
  const standings = ensurePromotionStandings(state);
  const relationships = ensurePromotionTalentTrust(state);
  ok(standings.length > 0, "expected promotion standings for hash test");
  ok(relationships.length > 0, "expected wrestler trust relationships for hash test");

  const baseline = deterministicWorldHash(state);
  const trust = relationships[0]!;
  const originalTrust = trust.trust;
  trust.trust = originalTrust + 1;
  const trustHash = deterministicWorldHash(state);
  ok(trustHash !== baseline, "changing wrestler trust did not change the global diagnostic hash");
  trust.trust = originalTrust;

  const standing = standings[0]!;
  const originalPrestige = standing.prestige;
  standing.prestige = originalPrestige + 1;
  const standingHash = deterministicWorldHash(state);
  ok(standingHash !== baseline, "changing promotion standing did not change the global diagnostic hash");
});

test("being used builds more trust than being contracted but unused", () => {
  const state = createWorld(10402, DEFAULT_RULESET);
  resolveWorldWeeks(state, 51);
  const promotion = state.promotions[0]!;
  const contracts = activeContractsForPromotion(state, promotion.id);
  const usedContract = contracts[0]!;
  const unusedContract = contracts.find((contract) => contract.personId !== usedContract.personId)!;
  ok(Boolean(usedContract && unusedContract), "expected at least two active contracts for trust comparison");

  const used = promotionTalentTrustFor(state, promotion.id, usedContract.personId);
  const unused = promotionTalentTrustFor(state, promotion.id, unusedContract.personId);
  used.trust = 50;
  unused.trust = 50;

  state.scheduledAppearances = state.scheduledAppearances.filter((appearance) => !(
    appearance.date.year === state.world.currentDate.year
    && appearance.promotionId === promotion.id
    && (appearance.personId === used.personId || appearance.personId === unused.personId)
  ));

  for (let index = 0; index < 8; index += 1) {
    state.scheduledAppearances.push({
      id: `trust-appearance-${index}`,
      worldId: state.world.id,
      eventId: `trust-event-${index}`,
      promotionId: promotion.id,
      personId: used.personId,
      contractId: usedContract.id,
      date: { ...state.world.currentDate, day: (index % 7) + 1 },
      serviceCapacityAtBooking: 100,
      status: "COMPLETED",
    });
  }

  processTalentTrustForWeek(state);
  console.log(`  usage trust: used ${used.trust}, unused ${unused.trust}`);
  ok(used.trust >= unused.trust + 7, `usage did not create meaningful trust separation: ${used.trust} vs ${unused.trust}`);
  ok(unused.trust < 50, `unused contracted talent did not lose trust: ${unused.trust}`);
});

test("a restructuring release causes a sharp relationship-specific trust loss", () => {
  const state = createWorld(10403, DEFAULT_RULESET);
  resolveWorldWeeks(state, 51);
  const promotion = state.promotions[1]!;
  const contract = activeContractsForPromotion(state, promotion.id)[0]!;
  ok(Boolean(contract), "expected an active contract for restructuring trust test");
  const relationship = promotionTalentTrustFor(state, promotion.id, contract.personId);
  relationship.trust = 70;
  contract.status = "TERMINATED";

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "CONTRACT_TERMINATED_DURING_RESTRUCTURING",
    significance: "ROUTINE",
    entityIds: [promotion.id, contract.personId, contract.id],
    payload: { settlement: 0 },
  });

  processTalentTrustForWeek(state);
  console.log(`  restructuring trust: 70 -> ${relationship.trust}`);
  ok(relationship.trust <= 58, `restructuring release did not damage trust enough: ${relationship.trust}`);
});

test("a decade produces bounded, differentiated and deterministic wrestler trust", () => {
  const stateA = createWorld(20261002, DEFAULT_RULESET);
  const stateB = createWorld(20261002, DEFAULT_RULESET);
  resolveWorldWeeks(stateA, 520);
  resolveWorldWeeks(stateB, 520);
  const trustA = ensurePromotionTalentTrust(stateA);
  const trustB = ensurePromotionTalentTrust(stateB);
  const values = trustA.map((entry) => entry.trust);
  const range = Math.max(...values) - Math.min(...values);
  console.log(`  decade trust: ${trustA.length} relationships, range ${range.toFixed(1)}, min ${Math.min(...values).toFixed(1)}, max ${Math.max(...values).toFixed(1)}`);
  ok(trustA.length > stateA.promotions.length * 10, `too few persistent trust relationships: ${trustA.length}`);
  ok(values.every((value) => value >= 0 && value <= 100), "wrestler trust escaped the 0-100 bounds");
  ok(range >= 10, `wrestler trust remained too homogeneous after a decade: range ${range}`);
  ok(range <= 75, `wrestler trust became implausibly polarized after a decade: range ${range}`);
  ok(JSON.stringify(trustA) === JSON.stringify(trustB), "wrestler trust is not deterministic for the same World seed");
});

console.log(`\nTalent trust tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

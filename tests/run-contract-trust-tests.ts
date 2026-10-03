declare const process: { exitCode?: number };

import type { ContractOffer, Person, Promotion, WorldState } from "../packages/domain/src/types.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  addPpwWeeks,
  createWorld,
  ensurePromotionTalentTrust,
  evaluateContractOffer,
  marketWeeklyValue,
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

function fixture(seed: number): {
  state: WorldState;
  person: Person;
  promotion: Promotion;
  relationship: NonNullable<WorldState["promotionTalentTrust"]>[number];
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const contract = [...state.contracts]
    .sort((a, b) => {
      const personA = state.people.find((person) => person.id === a.personId)!;
      const personB = state.people.find((person) => person.id === b.personId)!;
      return personB.priorities.loyalty - personA.priorities.loyalty || a.id.localeCompare(b.id);
    })[0]!;
  const person = state.people.find((candidate) => candidate.id === contract.personId)!;
  const promotion = state.promotions.find((candidate) => candidate.id === contract.promotionId)!;
  const relationship = ensurePromotionTalentTrust(state).find(
    (entry) => entry.personId === person.id && entry.promotionId === promotion.id,
  )!;
  ok(Boolean(person && promotion && relationship), "failed to build trust-aware contract fixture");
  return { state, person, promotion, relationship };
}

function offerFor(
  state: WorldState,
  person: Person,
  promotion: Promotion,
  id: string,
  weeklyGuarantee: number,
  appearanceFee: number,
  signingBonus: number,
): ContractOffer {
  return {
    id,
    worldId: state.world.id,
    personId: person.id,
    promotionId: promotion.id,
    submittedDate: { ...state.world.currentDate },
    status: "PENDING",
    offerKind: "RENEWAL",
    resolvedUtility: null,
    rejectionReason: null,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "FEATURED",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 4,
    weeklyGuarantee,
    appearanceFee,
    signingBonus,
  };
}

test("higher wrestler trust improves an otherwise identical contract offer", () => {
  const { state, person, promotion, relationship } = fixture(10501);
  const market = marketWeeklyValue(person);
  const offer = offerFor(state, person, promotion, "trust-utility-same-offer", market * 0.45, market * 0.8, market * 0.5);

  relationship.trust = 15;
  const lowTrust = evaluateContractOffer(state, offer);
  relationship.trust = 85;
  const highTrust = evaluateContractOffer(state, offer);

  console.log(`  trust utility: low ${lowTrust.toFixed(1)} vs high ${highTrust.toFixed(1)}`);
  ok(highTrust > lowTrust, `higher trust did not improve utility: ${lowTrust} vs ${highTrust}`);
  ok(highTrust - lowTrust >= 2, `trust effect was too weak to matter: delta ${(highTrust - lowTrust).toFixed(1)}`);
  ok(highTrust - lowTrust <= 8, `trust effect became too dominant: delta ${(highTrust - lowTrust).toFixed(1)}`);
});

test("neutral trust preserves the previous relationship loyalty baseline", () => {
  const { state, person, promotion, relationship } = fixture(10502);
  const market = marketWeeklyValue(person);
  const offer = offerFor(state, person, promotion, "neutral-trust-baseline", market * 0.5, market * 0.8, market * 0.5);

  relationship.trust = 50;
  const explicitNeutral = evaluateContractOffer(state, offer);
  state.promotionTalentTrust = state.promotionTalentTrust?.filter((entry) => entry !== relationship);
  const missingTrustRecord = evaluateContractOffer(state, offer);

  ok(explicitNeutral === missingTrustRecord, `neutral trust changed legacy utility: ${explicitNeutral} vs ${missingTrustRecord}`);
});

test("money remains more important than trust at contract extremes", () => {
  const { state, person, promotion, relationship } = fixture(10503);
  const market = marketWeeklyValue(person);

  relationship.trust = 90;
  const poorOffer = offerFor(state, person, promotion, "poor-high-trust", 0, market * 0.2, 0);
  const poorHighTrust = evaluateContractOffer(state, poorOffer);

  relationship.trust = 10;
  const strongOffer = offerFor(state, person, promotion, "strong-low-trust", market * 1.45, market * 0.7, market * 2);
  const strongLowTrust = evaluateContractOffer(state, strongOffer);

  console.log(`  money vs trust: poor/high-trust ${poorHighTrust.toFixed(1)} vs strong/low-trust ${strongLowTrust.toFixed(1)}`);
  ok(strongLowTrust >= poorHighTrust + 10, `trust outweighed a major money difference: ${poorHighTrust} vs ${strongLowTrust}`);
});

test("trust can decide a genuinely marginal accept-or-reject offer", () => {
  const { state, person, promotion, relationship } = fixture(10504);
  const market = marketWeeklyValue(person);
  let boundary: { low: number; high: number; multiplier: number } | null = null;

  for (let step = 0; step <= 180; step += 1) {
    const multiplier = step / 100;
    const offer = offerFor(
      state,
      person,
      promotion,
      "marginal-trust-offer",
      market * multiplier,
      market * 0.45,
      market * 0.25,
    );
    relationship.trust = 10;
    const low = evaluateContractOffer(state, offer);
    relationship.trust = 90;
    const high = evaluateContractOffer(state, offer);
    if (low < state.ruleset.offerAcceptanceThreshold && high >= state.ruleset.offerAcceptanceThreshold) {
      boundary = { low, high, multiplier };
      break;
    }
  }

  ok(boundary, "could not find a marginal offer where trust changes the acceptance outcome");
  console.log(`  marginal trust boundary: ${boundary!.multiplier.toFixed(2)}x guarantee, low ${boundary!.low.toFixed(1)}, high ${boundary!.high.toFixed(1)}`);
  ok(boundary!.high - boundary!.low <= 8, "marginal trust effect exceeded the restrained design band");
});

console.log(`\nContract trust tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

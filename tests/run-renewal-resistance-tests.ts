declare const process: { exitCode?: number };

import type { ContractOffer, Person, Promotion, WorldState } from "../packages/domain/src/types.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  addPpwWeeks,
  applyRenewalRelationshipResistance,
  createWorld,
  ensurePromotionTalentTrust,
  evaluateContractOffer,
  marketWeeklyValue,
  renewalRelationshipPenalty,
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
  const contract = state.contracts[0]!;
  const person = state.people.find((candidate) => candidate.id === contract.personId)!;
  const promotion = state.promotions.find((candidate) => candidate.id === contract.promotionId)!;
  const relationship = ensurePromotionTalentTrust(state).find(
    (entry) => entry.personId === person.id && entry.promotionId === promotion.id,
  )!;
  ok(Boolean(person && promotion && relationship), "failed to build renewal relationship fixture");
  return { state, person, promotion, relationship };
}

function offerFor(
  state: WorldState,
  person: Person,
  promotion: Promotion,
  id: string,
  weeklyGuarantee: number,
  offerKind: "RECRUITMENT" | "RENEWAL" = "RENEWAL",
): ContractOffer {
  const market = marketWeeklyValue(person);
  return {
    id,
    worldId: state.world.id,
    personId: person.id,
    promotionId: promotion.id,
    submittedDate: { ...state.world.currentDate },
    status: "PENDING",
    offerKind,
    resolvedUtility: null,
    rejectionReason: null,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "FEATURED",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 4,
    weeklyGuarantee,
    appearanceFee: market * 0.45,
    signingBonus: market * 0.25,
  };
}

function marginalRenewal(
  state: WorldState,
  person: Person,
  promotion: Promotion,
  id: string,
): { offer: ContractOffer; utility: number; multiplier: number } {
  const market = marketWeeklyValue(person);
  for (let step = 0; step <= 180; step += 1) {
    const multiplier = step / 100;
    const offer = offerFor(state, person, promotion, id, market * multiplier);
    const utility = evaluateContractOffer(state, offer);
    if (utility >= state.ruleset.offerAcceptanceThreshold && utility <= state.ruleset.offerAcceptanceThreshold + 7) {
      return { offer, utility, multiplier };
    }
  }
  throw new Error("could not find marginal renewal offer");
}

test("low morale and low trust can veto a marginal renewal", () => {
  const { state, person, promotion, relationship } = fixture(10701);
  person.morale = 25;
  relationship.trust = 25;
  const candidate = marginalRenewal(state, person, promotion, "renewal-low-low");
  state.contractOffers.push(candidate.offer);

  const rejected = applyRenewalRelationshipResistance(state);
  const penalty = renewalRelationshipPenalty(person.morale, relationship.trust);
  console.log(`  marginal renewal: base ${candidate.utility.toFixed(1)}, relationship penalty ${penalty.toFixed(1)}, status ${candidate.offer.status}`);

  ok(rejected === 1, `expected one relationship-driven rejection, got ${rejected}`);
  ok(candidate.offer.status === "REJECTED", "poor morale/trust did not reject marginal renewal");
  ok(candidate.offer.rejectionReason?.includes("morale and trust"), "relationship rejection did not explain its cause");
});

test("strong trust can cushion a temporary morale dip", () => {
  const { state, person, promotion, relationship } = fixture(10702);
  person.morale = 25;
  relationship.trust = 90;
  const candidate = marginalRenewal(state, person, promotion, "renewal-trust-cushion");
  state.contractOffers.push(candidate.offer);

  const rejected = applyRenewalRelationshipResistance(state);
  console.log(`  trust cushion: morale ${person.morale}, trust ${relationship.trust}, penalty ${renewalRelationshipPenalty(person.morale, relationship.trust).toFixed(1)}`);
  ok(rejected === 0, "high trust failed to cushion temporary low morale");
  ok(candidate.offer.status === "PENDING", "cushioned renewal was incorrectly pre-rejected");
});

test("a clearly strong renewal survives even very poor morale and trust", () => {
  const { state, person, promotion, relationship } = fixture(10703);
  const market = marketWeeklyValue(person);
  person.morale = 10;
  relationship.trust = 10;
  const offer = offerFor(state, person, promotion, "renewal-strong-money", market * 1.6);
  const baseUtility = evaluateContractOffer(state, offer);
  state.contractOffers.push(offer);

  const rejected = applyRenewalRelationshipResistance(state);
  const adjusted = baseUtility - renewalRelationshipPenalty(person.morale, relationship.trust);
  console.log(`  strong renewal: base ${baseUtility.toFixed(1)}, adjusted ${adjusted.toFixed(1)}, status ${offer.status}`);
  ok(baseUtility >= state.ruleset.offerAcceptanceThreshold + 15, "test fixture did not create a clearly strong offer");
  ok(rejected === 0, "relationship resistance overrode a clearly strong renewal");
  ok(offer.status === "PENDING", "strong renewal was incorrectly rejected");
});

test("recruitment offers are not filtered by renewal relationship resistance", () => {
  const { state, person, promotion, relationship } = fixture(10704);
  const market = marketWeeklyValue(person);
  person.morale = 10;
  relationship.trust = 10;
  const offer = offerFor(state, person, promotion, "recruitment-unaffected", market * 0.4, "RECRUITMENT");
  state.contractOffers.push(offer);

  const rejected = applyRenewalRelationshipResistance(state);
  ok(rejected === 0, "renewal resistance touched a recruitment offer");
  ok(offer.status === "PENDING", "recruitment offer was incorrectly changed");
});

console.log(`\nRenewal resistance tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

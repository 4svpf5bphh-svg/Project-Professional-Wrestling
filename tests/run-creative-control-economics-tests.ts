declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { ContractOffer, Person, Promotion } from "../packages/domain/src/types.js";
import {
  addPpwWeeks,
  createWorld,
  marketWeeklyValue,
  evaluateContractOffer,
  creativeControlOfferBonus,
  credibleCreativeControlOfferBonus,
  suggestedAiCreativeControl,
  generateAiContractOffers,
  resolvedCreativeControl,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;
function ok(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (err) { failed++; console.error("FAIL " + name + ": " + String(err)); }
}

test("higher contracted protections matter but cannot substitute for an exploitative zero-pay offer", () => {
  const state = createWorld(92051, DEFAULT_RULESET);
  const person = state.people.find((entry) => entry.status === "ACTIVE")!;
  const levels = ["NONE", "CONSULTATION", "PROTECTED_FINISHES", "FULL_APPROVAL"] as const;
  const atMarket = levels.map((level) =>
    credibleCreativeControlOfferBonus(person, level, 65, "LIMITED_NON_EXCLUSIVE", 26));
  ok(atMarket[0] === 0 && atMarket[1] > 0 && atMarket[2] > atMarket[1]
    && atMarket[3] > atMarket[2], "credible offers must value stronger wrestler rights progressively");
  ok(credibleCreativeControlOfferBonus(person, "FULL_APPROVAL", 0, "LIMITED_NON_EXCLUSIVE", 26)
    <= creativeControlOfferBonus(person, "FULL_APPROVAL") * 0.22,
    "unpaid offers received the full noncash benefit of creative approval");
  ok(credibleCreativeControlOfferBonus(person, "FULL_APPROVAL", 35, "LIMITED_NON_EXCLUSIVE", 26)
    < atMarket[3]!, "bargain-basement cash got full creative rights utility");
  ok(credibleCreativeControlOfferBonus(person, "FULL_APPROVAL", 65, "ONE_OFF", 1)
    < atMarket[3]! / 2, "one-off creative pledge was valued as a full season of protection");
  ok(credibleCreativeControlOfferBonus(person, "NONE", 100, "EXCLUSIVE", 52) === 0,
    "plain terms unexpectedly grant creative bargaining credit");
});

test("same wrestler and money receive identical creative utility in human and AI contract offers", () => {
  const state = createWorld(92052, DEFAULT_RULESET);
  const promotion = state.promotions.find((entry) => entry.controllerType === "AI")!;
  const person = state.people.find((entry) => entry.status === "ACTIVE")!;
  ok(promotion && person, "World fixture needs a signed-up AI company and wrestler");
  const market = marketWeeklyValue(person);
  const basis: ContractOffer = {
    id: "offer:creative-parity",
    worldId: state.world.id,
    promotionId: promotion.id,
    personId: person.id,
    submittedDate: { ...state.world.currentDate },
    status: "PENDING", offerKind: "RECRUITMENT", resolvedUtility: null, rejectionReason: null,
    family: "LIMITED_NON_EXCLUSIVE", exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "UPPER_CARD",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 5, weeklyGuarantee: Math.round(market * 0.3),
    appearanceFee: market, signingBonus: market,
  };
  const none = evaluateContractOffer(state, basis);
  const protectedOffer = evaluateContractOffer(state, { ...basis, creativeControl: "PROTECTED_FINISHES" });
  const fullOffer = evaluateContractOffer(state, { ...basis, creativeControl: "FULL_APPROVAL" });
  ok(none < protectedOffer && protectedOffer < fullOffer,
    "offer utility did not reflect increasing contractual obligations");

  promotion.controllerType = "HUMAN";
  ok(evaluateContractOffer(state, basis) === none
    && evaluateContractOffer(state, { ...basis, creativeControl: "PROTECTED_FINISHES" }) === protectedOffer
    && evaluateContractOffer(state, { ...basis, creativeControl: "FULL_APPROVAL" }) === fullOffer,
    "human and AI promoters secretly used different negotiation acceptance scores");
});

test("AI policy differentiates talent, promotion, consent severity and financial crisis", () => {
  const state = createWorld(92053, DEFAULT_RULESET);
  const person = state.people.find((p) => p.status === "ACTIVE")!;
  const original = state.promotions.find((entry) => entry.controllerType === "AI")!;
  const premium = {
    ...original, tier: "GLOBAL" as const,
    financialDistress: "HEALTHY" as const,
    aiProfile: { ...original.aiProfile, financialCaution: 30 },
  } satisfies Promotion;
  const talent = {
    ...person, recognition: 97, popularity: 95,
    skills: { ...person.skills, presentation: 92 },
    priorities: { ...person.priorities, role: 100, schedule: 90, money: 20 },
  } satisfies Person;
  const exclusive = { family: "EXCLUSIVE" as const, roleExpectation: "MAIN_EVENT" as const };
  ok(suggestedAiCreativeControl(talent, premium, exclusive) === "FULL_APPROVAL",
    "prestige AI cannot offer meaningful top-tier creative protections");
  ok(suggestedAiCreativeControl(talent, premium, {
    ...exclusive, family: "LIMITED_NON_EXCLUSIVE",
  }) === "PROTECTED_FINISHES", "non-exclusive offer unexpectedly granted season-long full veto");
  ok(suggestedAiCreativeControl(talent, { ...premium, financialDistress: "CRISIS" }, exclusive) === "NONE",
    "crisis promotion casually granted expensive top-tier creative protections");
  ok(suggestedAiCreativeControl(talent, premium, {
    ...exclusive, family: "ONE_OFF",
  }) === "NONE", "one-off appearances received long-term creative rights");
  ok(suggestedAiCreativeControl({ ...talent, recognition: 30, popularity: 25,
    skills: { ...talent.skills, presentation: 25 } }, premium, exclusive) === "NONE",
    "unrecognised newcomer received main-event-grade creative protections");
});

test("actual AI offers use the same bounded policy, without changing cash or giving hidden extra dates", () => {
  const state = createWorld(92054, DEFAULT_RULESET);
  // Genesis deliberately starts with staffed AI rosters. Give a smaller AI
  // promotion a genuine vacancy without deleting contracts, spoofing player
  // activity or touching production generation logic.
  const needingTalent = state.promotions.find((promotion) =>
    promotion.controllerType === "AI" && promotion.tier === "LOCAL" && promotion.lifecycle === "ACTIVE")
    ?? state.promotions.find((promotion) =>
      promotion.controllerType === "AI" && promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE");
  if (!needingTalent) throw new Error("fixture needs an AI promotion to recruit talent");
  needingTalent.tier = "GLOBAL"; // larger target roster creates genuine new-offer slots
  needingTalent.financialDistress = "HEALTHY";
  const beforeCount = state.contractOffers.length;
  generateAiContractOffers(state);
  const generated = state.contractOffers.slice(beforeCount);
  ok(generated.length > 0, "fixture did not generate AI contract offers");
  for (const offer of generated) {
    const person = state.people.find((entry) => entry.id === offer.personId)!;
    const promotion = state.promotions.find((entry) => entry.id === offer.promotionId)!;
    ok(promotion.controllerType === "AI", "player promotion received automated contract offer");
    ok(resolvedCreativeControl(offer.creativeControl) === suggestedAiCreativeControl(person, promotion, offer),
      "actual AI offer bypassed its documented creative-control contract policy");
    ok(Number.isSafeInteger(offer.weeklyGuarantee) && Number.isSafeInteger(offer.signingBonus)
      && offer.weeklyGuarantee >= 0 && offer.signingBonus >= 0,
      "AI rights generator altered cash or broke financial offer invariants");
    if (offer.family === "EXCLUSIVE") ok(offer.appearanceFee === 0,
      "creative concession reintroduced appearance fees on unlimited exclusive terms");
  }
});

console.log(`Creative contract economics tests: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;

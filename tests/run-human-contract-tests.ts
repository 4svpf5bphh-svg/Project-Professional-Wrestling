declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  applicableCreativeContract,
  addPpwWeeks,
  buildContractTerms,
  contractHasAppearanceRights,
  contractCoversBookedDate,
  applicableCreativeContract,
  canAddLimitedContractDates,
  creativeBookingReview,
  creativeControlOfferBonus,
  resolvedCreativeControl,
  evaluateContractOffer,
  createSignedContract,
  submitHumanDatesAddendum,
  validateWorldInvariants,
  DeterministicRng,
  claimIndependentPromotionForHuman,
  createWorld,
  marketWeeklyValue,
  resolveContractOffers,
  resolveWorldWeek,
  submitHumanContractOffer,
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

function fixture(seed: number): { state: WorldState; promotionId: string; freeAgentId: string } {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionForHuman(state, promotion.id, { name: "Player Wrestling" });
  const freeAgent = state.people.find(
    (person) => person.status === "ACTIVE" && activeContractsForPerson(state, person.id).length === 0,
  )!;
  ok(Boolean(freeAgent), "expected an active free agent at Genesis");
  return { state, promotionId: promotion.id, freeAgentId: freeAgent.id };
}

test("human promoter can submit exact recruitment terms without AI rewriting them", () => {
  const { state, promotionId, freeAgentId } = fixture(11001);
  const endDate = addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear);
  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: freeAgentId,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "FEATURED",
    startDate: { ...state.world.currentDate },
    endDate,
    dateEntitlement: 4,
    weeklyGuarantee: 12_000,
    appearanceFee: 6_500,
    signingBonus: 8_000,
  });

  ok(offer.status === "PENDING", "human offer was not submitted as pending");
  ok(offer.offerKind === "RECRUITMENT", "first relationship offer was not classified as recruitment");
  ok(offer.weeklyGuarantee === 12_000, "weekly guarantee was rewritten");
  ok(offer.appearanceFee === 6_500, "appearance fee was rewritten");
  ok(offer.dateEntitlement === 4, "purchased dates were rewritten");
  ok(state.contractOffers[state.contractOffers.length - 1] === offer, "offer was not appended to the shared market");
  ok(state.ledger[state.ledger.length - 1]!.type === "HUMAN_CONTRACT_OFFER_SUBMITTED", "offer was not recorded in World history");
});

test("a strong human offer resolves through the normal wrestler decision system and becomes a real contract", () => {
  const { state, promotionId, freeAgentId } = fixture(11002);
  const person = state.people.find((candidate) => candidate.id === freeAgentId)!;
  const market = marketWeeklyValue(person);
  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: freeAgentId,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "MAIN_EVENT",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 2,
    weeklyGuarantee: market * 4,
    appearanceFee: market * 4,
    signingBonus: market * 12,
  });

  resolveWorldWeek(state);

  ok(offer.resolvedUtility !== null, "wrestler never evaluated the human offer");
  ok(offer.status === "ACCEPTED", `strong human offer finished as ${offer.status}`);
  const contract = state.contracts.find((candidate) => candidate.sourceOfferId === offer.id);
  ok(Boolean(contract), "accepted human offer did not create a real contract");
  ok(contract!.promotionId === promotionId && contract!.personId === freeAgentId, "accepted contract points at wrong parties");
  ok(contract!.weeklyGuarantee === offer.weeklyGuarantee, "signed contract does not preserve human-negotiated money");
});

test("an existing wrestler relationship is classified as a renewal", () => {
  const { state, promotionId } = fixture(11003);
  const current = activeContractsForPromotion(state, promotionId).find(
    (contract) => activeContractsForPerson(state, contract.personId).length === 1,
  )!;
  ok(Boolean(current), "expected a singly contracted wrestler for renewal test");
  const startDate = addPpwWeeks(current.endDate, 1, state.ruleset.weeksPerYear);

  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: current.personId,
    family: "ONE_OFF",
    exclusivity: "OPEN",
    roleExpectation: current.roleExpectation,
    startDate,
    endDate: { ...startDate },
    dateEntitlement: 1,
    weeklyGuarantee: 0,
    appearanceFee: Math.max(1, current.appearanceFee || current.weeklyGuarantee),
    signingBonus: 0,
  });

  ok(offer.offerKind === "RENEWAL", "existing relationship was incorrectly classified as recruitment");
});

test("an exhausted limited-date deal can be replaced immediately without stacking contracts", () => {
  const { state, promotionId } = fixture(11006);
  const source = activeContractsForPromotion(state, promotionId).find((contract) => contract.family !== "ONE_OFF")!;
  ok(Boolean(source), "expected a renewable limited-date contract");
  source.datesUsed = source.dateEntitlement;
  const person = state.people.find((candidate) => candidate.id === source.personId)!;
  const market = marketWeeklyValue(person);
  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: source.personId,
    sourceContractId: source.id,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: source.roleExpectation,
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 5,
    weeklyGuarantee: market * 4,
    appearanceFee: market * 4,
    signingBonus: market * 12,
  });

  ok(offer.offerKind === "RENEWAL", "exhausted replacement was not classified as renewal");
  ok(offer.sourceContractId === source.id, "exhausted replacement lost its source contract");
  resolveContractOffers(state);
  ok(offer.status === "ACCEPTED", `strong exhausted-date replacement finished as ${offer.status}`);
  ok(source.status === "TERMINATED", "accepted exhausted replacement did not supersede the spent deal");
  const replacement = state.contracts.find((contract) => contract.sourceOfferId === offer.id);
  ok(Boolean(replacement) && replacement!.status === "SIGNED", "accepted exhausted replacement did not create a live contract");
  ok(replacement!.datesUsed === 0 && replacement!.dateEntitlement === 5, "replacement did not restore purchased dates");
  ok(activeContractsForPromotion(state, promotionId).filter((contract) => contract.personId === source.personId).length === 1, "exhausted replacement stacked multiple active contracts");
});

test("structurally impossible overlapping exclusive terms are rejected before submission", () => {
  const { state, promotionId } = fixture(11004);
  const current = activeContractsForPromotion(state, promotionId)[0]!;
  const offersBefore = state.contractOffers.length;

  let rejected = false;
  try {
    submitHumanContractOffer(state, {
      promotionId,
      personId: current.personId,
      family: "EXCLUSIVE",
      exclusivity: "EXCLUSIVE",
      roleExpectation: "MAIN_EVENT",
      startDate: { ...state.world.currentDate },
      endDate: addPpwWeeks(state.world.currentDate, 25, state.ruleset.weeksPerYear),
      dateEntitlement: 16,
      weeklyGuarantee: 50_000,
      appearanceFee: 0,
      signingBonus: 50_000,
    });
  } catch {
    rejected = true;
  }

  ok(rejected, "overlapping exclusive human offer was accepted into the market");
  ok(state.contractOffers.length === offersBefore, "rejected contract offer partially mutated World state");
});

test("AI promotions cannot use the human contract command", () => {
  const { state, freeAgentId } = fixture(11005);
  const aiPromotion = state.promotions.find((promotion) => promotion.controllerType === "AI" && promotion.lifecycle === "ACTIVE")!;

  let rejected = false;
  try {
    submitHumanContractOffer(state, {
      promotionId: aiPromotion.id,
      personId: freeAgentId,
      family: "ONE_OFF",
      exclusivity: "OPEN",
      roleExpectation: "REGULAR",
      startDate: { ...state.world.currentDate },
      endDate: { ...state.world.currentDate },
      dateEntitlement: 1,
      weeklyGuarantee: 0,
      appearanceFee: 10_000,
      signingBonus: 0,
    });
  } catch {
    rejected = true;
  }
  ok(rejected, "AI promotion could invoke a human-only contract command");
});

test("exclusive appearance rights survive exhausting the legacy date count, non-exclusive dates do not", () => {
  const { state, promotionId, freeAgentId } = fixture(11007);
  const promotion = state.promotions.find((entry) => entry.id === promotionId)!;
  const person = state.people.find((entry) => entry.id === freeAgentId)!;
  const exclusive = buildContractTerms(
    state, promotion, person, new DeterministicRng(11007), state.world.currentDate, "EXCLUSIVE",
  );
  ok(exclusive.family === "EXCLUSIVE" && exclusive.exclusivity === "EXCLUSIVE",
    "forced exclusive proposal changed contractual employment type");
  ok(exclusive.weeklyGuarantee > 0 && exclusive.appearanceFee === 0,
    "exclusive employment lost guaranteed pay or invented an appearance charge");
  ok(contractHasAppearanceRights({ family: "EXCLUSIVE", dateEntitlement: 1, datesUsed: 600 }),
    "exclusive wrestler became unbookable despite an active exclusive term");
  ok(contractHasAppearanceRights({ family: "EXCLUSIVE", dateEntitlement: 26, datesUsed: 26 }),
    "exclusive booking rights were incorrectly limited by a legacy numeric entitlement");
  ok(contractHasAppearanceRights({ family: "LIMITED_NON_EXCLUSIVE", dateEntitlement: 6, datesUsed: 5 }),
    "non-exclusive booking was denied before all six purchased dates were used");
  ok(!contractHasAppearanceRights({ family: "LIMITED_NON_EXCLUSIVE", dateEntitlement: 6, datesUsed: 6 }),
    "non-exclusive agreement allowed an unpaid seventh appearance");
  ok(!contractHasAppearanceRights({ family: "ONE_OFF", dateEntitlement: 1, datesUsed: 1 }),
    "one-off agreement allowed a second appearance");
});

test("accepted date addendum extends the same non-exclusive contract with no new term or weekly wage", () => {
  const { state, promotionId, freeAgentId } = fixture(11008);
  const person = state.people.find(item => item.id === freeAgentId)!;
  const promotion = state.promotions.find(item => item.id === promotionId)!;
  const market = marketWeeklyValue(person);
  const source = createSignedContract(state, person, promotion, {
    family: "LIMITED_NON_EXCLUSIVE", exclusivity: "NON_EXCLUSIVE", roleExpectation: "FEATURED",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 2, weeklyGuarantee: 1000, appearanceFee: market, signingBonus: 0,
    creativeControl: "CONSULTATION",
  }, null, false);
  const originalEnd = JSON.stringify(source.endDate);
  const countBefore = state.contracts.length;
  const cashBefore = promotion.cash;
  const payment = market * 20;
  const offer = submitHumanDatesAddendum(state, {
    promotionId, personId: person.id, contractId: source.id,
    additionalDates: 2, additionalPayment: payment,
  });
  ok(offer.offerKind === "DATES_ADDENDUM" && offer.sourceContractId === source.id
    && offer.dateEntitlement === 4, "proposal did not target total dates on the signed agreement");
  ok(source.dateEntitlement === 2, "pending addendum amended the contract before wrestler accepted");
  resolveContractOffers(state);
  ok(offer.status === "ACCEPTED", `wrestler did not accept a strong extra-dates proposal: ${offer.rejectionReason}`);
  ok(state.contracts.length === countBefore, "accepted extra dates created a second overlapping contract");
  ok(source.dateEntitlement === 4 && source.status === "SIGNED", "existing deal did not gain two dates");
  ok(JSON.stringify(source.endDate) === originalEnd && source.weeklyGuarantee === 1000
    && source.exclusivity === "NON_EXCLUSIVE"
    && source.creativeControl === "CONSULTATION",
    "addendum rewrote contract expiry, wage, creative rights or exclusivity");
  ok(promotion.cash === cashBefore - payment, "negotiated extra payment was not charged once");
  ok(state.financialTransactions.some(tx => tx.source === offer.id
    && tx.category === "CONTRACT_SIGNING_BONUS" && tx.amount === -payment),
    "extra-date payment lacks an auditable financial record");
  ok(state.ledger.some(item => item.type === "CONTRACT_EXTRA_DATES_ACCEPTED"
    && item.entityIds.includes(source.id)), "accepted addendum not recorded in World history");
  const errors = validateWorldInvariants(state);
  ok(errors.length === 0, "accepted date addendum broke shared World invariants: " + errors.slice(0, 3).join("; "));
});

test("extra-date proposals reject exclusive contracts and impossible workloads before any mutation", () => {
  const { state, promotionId, freeAgentId } = fixture(11009);
  const person = state.people.find(item => item.id === freeAgentId)!;
  const promotion = state.promotions.find(item => item.id === promotionId)!;
  const source = createSignedContract(state, person, promotion, {
    family: "LIMITED_NON_EXCLUSIVE", exclusivity: "NON_EXCLUSIVE", roleExpectation: "REGULAR",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 1, state.ruleset.weeksPerYear),
    dateEntitlement: 1, weeklyGuarantee: 250, appearanceFee: 900, signingBonus: 0,
  }, null, false);
  const offersBefore = state.contractOffers.length;
  ok(!canAddLimitedContractDates(state, person, source, 100).ok, "impossible two-week workload passed capacity guard");
  let rejected = false;
  try {
    submitHumanDatesAddendum(state, {
      promotionId, personId: freeAgentId, contractId: source.id,
      additionalDates: 100, additionalPayment: 1000,
    });
  } catch { rejected = true; }
  ok(rejected && state.contractOffers.length === offersBefore,
    "rejected addendum changed World offers");
  source.family = "EXCLUSIVE";
  source.exclusivity = "EXCLUSIVE";
  rejected = false;
  try {
    submitHumanDatesAddendum(state, {
      promotionId, personId: freeAgentId, contractId: source.id,
      additionalDates: 1, additionalPayment: 1000,
    });
  } catch { rejected = true; }
  ok(rejected && state.contractOffers.length === offersBefore,
    "exclusive contract incorrectly offered limited-date addendum");
});

test("creative control tiers are deterministic, ordered and never rewrite a scripted booking", () => {
  const { state, freeAgentId } = fixture(11010);
  const person = state.people.find(p => p.id === freeAgentId)!;
  const plain = creativeControlOfferBonus(person, "NONE");
  const consult = creativeControlOfferBonus(person, "CONSULTATION");
  const protectedFinishes = creativeControlOfferBonus(person, "PROTECTED_FINISHES");
  const full = creativeControlOfferBonus(person, "FULL_APPROVAL");
  ok(plain === 0 && consult > 0 && protectedFinishes > consult && full > protectedFinishes,
    "higher contractual rights do not improve a wrestler's negotiated utility");
  ok(resolvedCreativeControl(undefined) === "NONE", "legacy contracts must have no implicit veto");
  const loss = { loses: true, cleanOrSubmission: true, repackaging: false };
  const ordinary = creativeBookingReview(undefined, loss);
  const consultation = creativeBookingReview("CONSULTATION", loss);
  const protectedLoss = creativeBookingReview("PROTECTED_FINISHES", loss);
  const protectedWin = creativeBookingReview("PROTECTED_FINISHES",
    { ...loss, loses: false });
  const fullApproval = creativeBookingReview("FULL_APPROVAL",
    { loses: false, cleanOrSubmission: false, repackaging: true });
  ok(!ordinary.requiresConsent && ordinary.reasons.length === 0, "default booking needed invented approval");
  ok(!consultation.requiresConsent && consultation.reasons.includes("CONSULTATION_REQUESTED"),
    "consultation was treated as a blocking veto");
  ok(protectedLoss.requiresConsent && protectedLoss.reasons.includes("PROTECTED_LOSS"),
    "protected wrestler was not consulted for a clean loss");
  ok(!protectedWin.requiresConsent, "protected wrestler could veto unrelated wins");
  ok(fullApproval.requiresConsent && fullApproval.reasons.includes("GIMMICK_APPROVAL"),
    "full creative approval did not detect repackaging");
});

test("a creative-control concession improves an offer and persists into the signed agreement", () => {
  const { state, promotionId, freeAgentId } = fixture(11011);
  const person = state.people.find(p => p.id === freeAgentId)!;
  const market = marketWeeklyValue(person);
  const offer = submitHumanContractOffer(state, {
    promotionId, personId: person.id,
    family: "LIMITED_NON_EXCLUSIVE", exclusivity: "NON_EXCLUSIVE", roleExpectation: "MAIN_EVENT",
    creativeControl: "PROTECTED_FINISHES",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 3, weeklyGuarantee: market * 4, appearanceFee: market * 3,
    signingBonus: market * 8,
  });
  const equalCashNoRights = evaluateContractOffer(state, { ...offer, creativeControl: "NONE" });
  const withRights = evaluateContractOffer(state, offer);
  ok(withRights > equalCashNoRights + 8,
    "wrestler did not meaningfully value their protected-finishes concession");
  resolveContractOffers(state);
  ok(offer.status === "ACCEPTED", `strong offer with creative rights was ${offer.status}`);
  const signed = state.contracts.find(c => c.sourceOfferId === offer.id);
  if (!signed) throw new Error("accepted creative-control contract was not signed");
  ok(signed.creativeControl === "PROTECTED_FINISHES",
    "accepted creative-control clause was lost between offer and signed contract");
  ok(signed.weeklyGuarantee === market * 4 && signed.appearanceFee === market * 3,
    "creative rights silently rewrote agreed compensation");
});

test("legacy and AI final-week terms cover all seven PPW show days without adding another week", () => {
  const { state, promotionId } = fixture(11013);
  const contract = activeContractsForPromotion(state, promotionId)[0];
  if (!contract) throw new Error("final-week boundary fixture has no signed contract");
  const original = { ...contract.endDate };
  contract.startDate = { year: 1, week: 51, day: 1 };
  contract.endDate = { year: 2, week: 1, day: 1 }; // Existing week-based contracts historically store D1.
  ok(contractCoversBookedDate(state, contract, { year: 1, week: 52, day: 7 }),
    "booking was blocked in previous covered year-end week");
  ok(contractCoversBookedDate(state, contract, { year: 2, week: 1, day: 7 }),
    "legacy day-one expiry wrongly blocked the last calendar day of a covered PPW week");
  ok(!contractCoversBookedDate(state, contract, { year: 2, week: 2, day: 1 }),
    "booking incorrectly extended contractual rights into an extra week");
  contract.creativeControl = "FULL_APPROVAL";
  ok(applicableCreativeContract(state, promotionId, contract.personId,
    { year: 2, week: 1, day: 6 })?.id === contract.id,
    "final-week day-six creative approval was silently bypassed");
  ok(!applicableCreativeContract(state, promotionId, contract.personId,
    { year: 2, week: 2, day: 1 }),
    "creative veto rights illegally extended into the next PPW week");
  contract.startDate = { year: 1, week: 51, day: 4 };
  ok(!contractCoversBookedDate(state, contract, { year: 1, week: 51, day: 3 }),
    "final-week accommodation allowed booking before a precise midweek commencement");
  ok(contractCoversBookedDate(state, contract, { year: 1, week: 51, day: 4 }),
    "contract was not usable on its actual start day");
  contract.status = "EXPIRED";
  ok(!contractCoversBookedDate(state, contract, { year: 2, week: 1, day: 5 }),
    "expired contract was allowed to reserve a show");
  contract.endDate = original;
});

test("accepted future renewal changes creative rights only when the new term begins", () => {
  const { state, promotionId } = fixture(11012);
  const source = activeContractsForPromotion(state, promotionId).find(contract =>
    contract.family === "LIMITED_NON_EXCLUSIVE"
    && activeContractsForPerson(state, contract.personId).length === 1);
  if (!source) throw new Error("creative renewal fixture needs a single-contract roster member");
  source.creativeControl = "PROTECTED_FINISHES";
  source.endDate = addPpwWeeks(state.world.currentDate, 2, state.ruleset.weeksPerYear);
  const person = state.people.find(entry => entry.id === source.personId)!;
  const market = marketWeeklyValue(person);
  const startDate = addPpwWeeks(source.endDate, 1, state.ruleset.weeksPerYear);
  const offer = submitHumanContractOffer(state, {
    promotionId, personId: person.id, sourceContractId: source.id,
    family: "LIMITED_NON_EXCLUSIVE", exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "MAIN_EVENT", creativeControl: "FULL_APPROVAL",
    startDate, endDate: addPpwWeeks(startDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 3, weeklyGuarantee: market * 5,
    appearanceFee: market * 4, signingBonus: market * 12,
  });
  ok(source.creativeControl === "PROTECTED_FINISHES",
    "pending renewal prematurely changed current creative rights");
  resolveContractOffers(state);
  ok(offer.status === "ACCEPTED",
    `strong creative renewal failed normal negotiation: ${offer.rejectionReason}`);
  const renewed = state.contracts.find(contract => contract.sourceOfferId === offer.id);
  if (!renewed) throw new Error("accepted renewal did not create the new agreement");
  ok(renewed.creativeControl === "FULL_APPROVAL",
    "new rights did not reach the accepted future agreement");
  ok(source.creativeControl === "PROTECTED_FINISHES" && source.status === "SIGNED",
    "new rights rewrote or terminated the current, unexpired contract");
  ok(applicableCreativeContract(state, promotionId, person.id, state.world.currentDate)?.id === source.id,
    "future Full Approval unexpectedly applied to a wrestler's current booking");
  ok(applicableCreativeContract(state, promotionId, person.id, startDate)?.id === renewed.id,
    "future Full Approval is not operative when its signed term starts");
});

console.log(`\nHuman contract tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

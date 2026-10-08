declare const process: { exitCode?: number };

import {
  buildPlayerTalentManagementView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { activeContractsForPromotion, createWorld } from "../packages/sim-core/src/index.js";

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
  aggregate: ApplicationWorldAggregate;
  promotionAId: string;
  promotionBId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotions = state.promotions.filter((promotion) => (
    promotion.controllerType === "AI"
    && promotion.tier === "INDEPENDENT"
    && promotion.lifecycle === "ACTIVE"
  )).slice(0, 2);
  if (promotions.length < 2) throw new Error("talent fixture needs two Independent promotions");
  claimIndependentPromotionForPlayer(state, ownership, "player-a", promotions[0]!.id);
  claimIndependentPromotionForPlayer(state, ownership, "player-b", promotions[1]!.id);

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
    },
    promotionAId: promotions[0]!.id,
    promotionBId: promotions[1]!.id,
  };
}

function pushPendingOffer(
  aggregate: ApplicationWorldAggregate,
  promotionId: string,
  personId: string,
  id: string,
  weeklyGuarantee: number,
): void {
  aggregate.state.contractOffers.push({
    id,
    worldId: aggregate.state.world.id,
    personId,
    promotionId,
    submittedDate: { ...aggregate.state.world.currentDate },
    status: "PENDING",
    offerKind: "RECRUITMENT",
    resolvedUtility: null,
    rejectionReason: null,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "REGULAR",
    startDate: { ...aggregate.state.world.currentDate },
    endDate: { year: 1, week: 13, day: 1 },
    dateEntitlement: 4,
    weeklyGuarantee,
    appearanceFee: 2_000,
    signingBonus: 1_000,
  });
}

test("talent view exposes full own roster contracts and remains source-agnostic", () => {
  const { aggregate, promotionAId } = fixture(73001);
  const ownContract = activeContractsForPromotion(aggregate.state, promotionAId)[0];
  ok(ownContract, "fixture promotion has no active roster contract");
  ownContract!.weeklyGuarantee = 1_234_567;
  const person = aggregate.state.people.find((candidate) => candidate.id === ownContract!.personId);
  ok(person, "own contract wrestler is missing");
  person!.name = "Roster Source Replacement";
  person!.division = "WOMEN";

  const view = buildPlayerTalentManagementView(aggregate, "player-a");
  const rosterEntry = view.roster.find((entry) => entry.contractId === ownContract!.id);
  ok(rosterEntry?.name === "Roster Source Replacement", "talent projection did not read the current Person source/name");
  ok(rosterEntry?.division === "WOMEN", "talent projection did not expose wrestler division");
  ok(
    rosterEntry?.employmentPromotions.some((entry) => entry.promotionId === promotionAId),
    "own roster entry did not expose public employment promotion",
  );
  ok(
    rosterEntry?.rosterAffiliations.some((entry) => entry.promotionId === promotionAId && entry.role === "PRIMARY"),
    "contract-derived roster entry did not expose public roster affiliation",
  );
  ok(rosterEntry?.contract.weeklyGuarantee === 1_234_567, "player could not see their own contract money");
  ok(view.player.promotionId === promotionAId, "talent projection returned the wrong controlled promotion");
});

test("talent market can expose non-exclusive availability without leaking rival contract terms", () => {
  const { aggregate, promotionAId, promotionBId } = fixture(73002);
  const ownPeople = new Set(activeContractsForPromotion(aggregate.state, promotionAId).map((contract) => contract.personId));
  const rivalContract = activeContractsForPromotion(aggregate.state, promotionBId)
    .find((contract) => !ownPeople.has(contract.personId));
  ok(rivalContract, "fixture has no rival-only contract");
  rivalContract!.family = "LIMITED_NON_EXCLUSIVE";
  rivalContract!.exclusivity = "NON_EXCLUSIVE";
  rivalContract!.weeklyGuarantee = 987_654_321;
  rivalContract!.appearanceFee = 876_543_210;
  const rivalPerson = aggregate.state.people.find((person) => person.id === rivalContract!.personId);
  ok(rivalPerson, "rival contract wrestler is missing");
  rivalPerson!.division = "WOMEN";

  const view = buildPlayerTalentManagementView(aggregate, "player-a");
  const marketEntry = view.market.find((entry) => entry.personId === rivalContract!.personId);
  ok(marketEntry?.availability === "NON_EXCLUSIVE", "non-exclusive rival talent was not represented as market-available");
  ok(marketEntry?.division === "WOMEN", "market entry did not expose wrestler division");
  ok(
    marketEntry?.employmentPromotions.some((entry) => entry.promotionId === promotionBId),
    "market entry did not expose the wrestler's public employment promotion",
  );
  ok(
    marketEntry?.rosterAffiliations.some((entry) => entry.promotionId === promotionBId),
    "market entry did not expose contract-derived public roster affiliation",
  );
  const serialized = JSON.stringify(view);
  ok(!serialized.includes("987654321"), "rival weekly guarantee leaked into player talent view");
  ok(!serialized.includes("876543210"), "rival appearance fee leaked into player talent view");
  ok(!serialized.includes(rivalContract!.id), "rival contract ID leaked into player talent view");
});

test("pending contract offers are private to the controlling promotion", () => {
  const { aggregate, promotionAId, promotionBId } = fixture(73003);
  const rosterA = new Set(activeContractsForPromotion(aggregate.state, promotionAId).map((contract) => contract.personId));
  const rosterB = new Set(activeContractsForPromotion(aggregate.state, promotionBId).map((contract) => contract.personId));
  const personA = aggregate.state.people.find((person) => !rosterA.has(person.id) && person.status !== "RETIRED");
  const personB = aggregate.state.people.find((person) => !rosterB.has(person.id) && person.status !== "RETIRED" && person.id !== personA?.id);
  ok(personA && personB, "fixture has too few offer candidates");
  pushPendingOffer(aggregate, promotionAId, personA!.id, "private-offer-a", 12_345);
  pushPendingOffer(aggregate, promotionBId, personB!.id, "private-offer-b", 765_432_109);

  const playerA = buildPlayerTalentManagementView(aggregate, "player-a");
  const playerB = buildPlayerTalentManagementView(aggregate, "player-b");
  ok(playerA.pendingOffers.some((offer) => offer.offerId === "private-offer-a"), "player A could not see own pending offer");
  ok(!playerA.pendingOffers.some((offer) => offer.offerId === "private-offer-b"), "player A received player B's private offer");
  ok(playerB.pendingOffers.some((offer) => offer.offerId === "private-offer-b"), "player B could not see own pending offer");
  ok(!JSON.stringify(playerA).includes("765432109"), "player B offer money leaked to player A");
});

test("each human receives only their own roster contract details", () => {
  const { aggregate, promotionAId, promotionBId } = fixture(73004);
  const playerA = buildPlayerTalentManagementView(aggregate, "player-a");
  const playerB = buildPlayerTalentManagementView(aggregate, "player-b");
  ok(playerA.roster.every((entry) => aggregate.state.contracts.find((contract) => contract.id === entry.contractId)?.promotionId === promotionAId), "player A roster leaked rival contracts");
  ok(playerB.roster.every((entry) => aggregate.state.contracts.find((contract) => contract.id === entry.contractId)?.promotionId === promotionBId), "player B roster leaked rival contracts");
});

test("non-members cannot read talent management", () => {
  const { aggregate } = fixture(73005);
  let rejected = false;
  try {
    buildPlayerTalentManagementView(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read talent management");
});

console.log(`\nApplication talent-view tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

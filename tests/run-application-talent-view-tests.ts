declare const process: { exitCode?: number };

import {
  buildPlayerAttention,
  buildPlayerTalentDirectoryView,
  buildPlayerTalentManagementView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  sameTermsRenewalTemplate,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { activeContractsForPromotion, addPpwWeeks, createWorld } from "../packages/sim-core/src/index.js";

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
  ok((rosterEntry?.estimatedWeeklyValue ?? 0) > 0, "roster view did not expose the PPW market-value guide");
  ok(
    ["DEVELOPMENTAL", "REGULAR", "FEATURED", "UPPER_CARD", "MAIN_EVENT", "SPECIAL_ATTRACTION"].includes(rosterEntry?.suggestedRoleExpectation ?? ""),
    "roster view did not expose a suggested negotiation role",
  );
  ok(view.player.promotionId === promotionAId, "talent projection returned the wrong controlled promotion");
});

test("same-terms renewal copies recurring rights and fees, never the old signing bonus", () => {
  const { aggregate, promotionAId } = fixture(73015);
  const source = activeContractsForPromotion(aggregate.state, promotionAId)[0];
  if (!source) throw new Error("fixture needs own active contract");
  source.family = "LIMITED_NON_EXCLUSIVE";
  source.exclusivity = "NON_EXCLUSIVE";
  source.startDate = { ...aggregate.state.world.currentDate, day: 1 };
  source.endDate = addPpwWeeks(source.startDate, 12, aggregate.state.ruleset.weeksPerYear);
  source.dateEntitlement = 5;
  source.weeklyGuarantee = 3210;
  source.appearanceFee = 6789;
  source.signingBonus = 99999;
  source.roleExpectation = "UPPER_CARD";
  source.creativeControl = "PROTECTED_FINISHES";
  const proposal = sameTermsRenewalTemplate(aggregate.state, source);
  ok(proposal?.termWeeks === 13 && proposal.family === "LIMITED_NON_EXCLUSIVE",
    "renewal failed to preserve exact allowed contractual term");
  ok(proposal?.weeklyGuarantee === 3210 && proposal.appearanceFee === 6789 && proposal.dateEntitlement === 5,
    "renewal changed recurring compensation or purchased dates");
  ok(proposal?.roleExpectation === "UPPER_CARD" && proposal.creativeControl === "PROTECTED_FINISHES",
    "renewal lost role or negotiated creative rights");
  ok(proposal?.signingBonus === 0, "previous one-time signing bonus was silently repeated");
  const view = buildPlayerTalentManagementView(aggregate, "player-a");
  ok(view.roster.find(entry => entry.contractId === source.id)?.contract.sameTermsRenewal?.signingBonus === 0,
    "private roster did not expose safe renewal proposal");
  const originalEnd = source.endDate;
  source.endDate = addPpwWeeks(source.startDate, 10, aggregate.state.ruleset.weeksPerYear);
  ok(sameTermsRenewalTemplate(aggregate.state, source) === null,
    "unsupported historical term was misrepresented as repeatable same terms");
  source.endDate = originalEnd;
  source.family = "ONE_OFF";
  ok(sameTermsRenewalTemplate(aggregate.state, source) === null,
    "one-off appearance should not be staff-repeatable as a routine multiweek renewal");
});

test("signed future renewals remain visible before activation and never permit another renewal", () => {
  const { aggregate, promotionAId } = fixture(73991);
  const source = activeContractsForPromotion(aggregate.state, promotionAId)
    .find((contract) => contract.family !== "ONE_OFF");
  if (!source) throw new Error("fixture has no multweek source contract");
  source.family = "LIMITED_NON_EXCLUSIVE";
  source.exclusivity = "NON_EXCLUSIVE";
  source.endDate = addPpwWeeks(aggregate.state.world.currentDate, 1, aggregate.state.ruleset.weeksPerYear);
  source.dateEntitlement = 3;
  source.datesUsed = 3;
  const start = addPpwWeeks(source.endDate, 1, aggregate.state.ruleset.weeksPerYear);
  const first = {
    ...structuredClone(source),
    id: "signed-renewal-1",
    startDate: start,
    endDate: addPpwWeeks(start, 12, aggregate.state.ruleset.weeksPerYear),
    signedDate: { ...aggregate.state.world.currentDate },
    dateEntitlement: 9,
    datesUsed: 0,
  };
  aggregate.state.contracts.push(first);
  const current = buildPlayerTalentManagementView(aggregate, "player-a");
  const entry = current.roster.find((candidate) => candidate.personId === source.personId);
  ok(entry?.contractId === source.id, "old contract should remain the active deal");
  ok(entry?.contract.datesRemaining === 0, "future dates were incorrectly credited to the old contract");
  ok(entry?.scheduledRenewals?.length === 1 && entry.scheduledRenewals[0]?.dateEntitlement === 9,
    "accepted nine-date future renewal was invisible on the current roster");
  ok(entry?.contract.renewalWindowOpen === false && entry?.contract.renewalReason === null,
    "roster still invited another renewal after signed future terms");

  aggregate.state.contracts.push({
    ...structuredClone(first), id: "signed-renewal-2", dateEntitlement: 5,
  });
  const duplicate = buildPlayerTalentManagementView(aggregate, "player-a").roster
    .find((candidate) => candidate.personId === source.personId);
  ok(duplicate?.scheduledRenewals?.length === 2,
    "legacy duplicate accepted future contracts must be shown, not concealed");
  aggregate.state.world.currentDate = { ...start };
  const activated = buildPlayerTalentManagementView(aggregate, "player-a").roster
    .filter((candidate) => candidate.personId === source.personId);
  ok(activated.length === 1 && activated[0]?.concurrentContractCount === 2,
    "future overlapping renewals generated duplicate roster cards after activation");
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
  ok(
    ["KEEN", "INTERESTED", "OPEN_TO_TALKS", "LONG_SHOT", "NOT_INTERESTED"].includes(marketEntry?.interest ?? ""),
    "market entry did not expose a coarse recruitment-interest band",
  );
  ok(marketEntry?.division === "WOMEN", "market entry did not expose wrestler division");
  ok((marketEntry?.estimatedWeeklyValue ?? 0) > 0, "market entry did not expose the PPW market-value guide");
  ok(
    ["DEVELOPMENTAL", "REGULAR", "FEATURED", "UPPER_CARD", "MAIN_EVENT", "SPECIAL_ATTRACTION"].includes(marketEntry?.suggestedRoleExpectation ?? ""),
    "market entry did not expose a suggested negotiation role",
  );
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
  ok(!serialized.includes("resolvedUtility"), "contract utility score leaked into player talent view");
});

test("global directory includes exclusive rival talent without private contract leakage", () => {
  const { aggregate, promotionAId, promotionBId } = fixture(73006);
  const ownPeople = new Set(activeContractsForPromotion(aggregate.state, promotionAId).map((contract) => contract.personId));
  const rivalContract = activeContractsForPromotion(aggregate.state, promotionBId)
    .find((contract) => !ownPeople.has(contract.personId));
  ok(rivalContract, "fixture has no rival-only contract for directory test");
  rivalContract!.family = "EXCLUSIVE";
  rivalContract!.exclusivity = "EXCLUSIVE";
  rivalContract!.weeklyGuarantee = 912_345_678;
  rivalContract!.appearanceFee = 812_345_678;

  const directory = buildPlayerTalentDirectoryView(aggregate, "player-a");
  ok(directory.entries.length === aggregate.state.people.length, "global directory did not include the whole World population");

  const entry = directory.entries.find((candidate) => candidate.personId === rivalContract!.personId);
  ok(entry?.directoryStatus === "EXCLUSIVE", "exclusive rival wrestler was not visible as exclusive in Directory");
  ok(
    entry?.employmentPromotions.some((promotion) => promotion.promotionId === promotionBId),
    "Directory did not expose rival wrestler's public employer",
  );
  ok(
    entry?.rosterAffiliations.some((promotion) => promotion.promotionId === promotionBId),
    "Directory did not expose rival wrestler's public roster affiliation",
  );

  const serialized = JSON.stringify(directory);
  ok(!serialized.includes("912345678"), "rival weekly guarantee leaked into global Directory");
  ok(!serialized.includes("812345678"), "rival appearance fee leaked into global Directory");
  ok(!serialized.includes(rivalContract!.id), "rival contract ID leaked into global Directory");
});

test("contract workbench can show an expiring roster deal alongside its pending offer", () => {
  const { aggregate, promotionAId } = fixture(73018);
  const contract = activeContractsForPromotion(aggregate.state, promotionAId)
    .find((entry) => entry.family !== "ONE_OFF");
  if (!contract) throw new Error("contract desk fixture needs a multiweek contract");
  contract.endDate = { ...aggregate.state.world.currentDate, day: 7 };
  const offerId = "contract-desk-renewal-pending";
  pushPendingOffer(aggregate, promotionAId, contract.personId, offerId, contract.weeklyGuarantee);
  const offer = aggregate.state.contractOffers.find((entry) => entry.id === offerId);
  if (!offer) throw new Error("pending renewal fixture missing offer");
  offer.offerKind = "RENEWAL";

  const view = buildPlayerTalentManagementView(aggregate, "player-a");
  const roster = view.roster.find((entry) => entry.contractId === contract.id);
  ok(roster?.contract.renewalWindowOpen === true, "expiring contract disappeared from roster");
  ok(roster?.personId === contract.personId, "contract roster lost its person identifier");
  ok(view.pendingOffers.some((entry) => entry.personId === contract.personId && entry.offerId === offerId && entry.offerKind === "RENEWAL"),
    "pending renewal is not available to the roster badge and consolidated Contracts queue");
  ok(view.pendingOffers.every((entry) => entry.personId !== undefined),
    "the Contracts pending queue cannot identify its wrestler");
  const alert = buildPlayerAttention(aggregate, "player-a")
    .find((item) => item.attentionId === `contract-expiry:${contract.id}`);
  ok(alert?.category === "WATCHING", "submitted renewal still appeared as a required decision");
  ok(alert?.deepLink === "/talent/contracts?personId=" + encodeURIComponent(contract.personId),
    "pending renewal alert did not open the wrestler's Contracts proposal");
});

test("exhausted appearance dates with an open addendum are waiting, not an unhandled action", () => {
  const { aggregate, promotionAId } = fixture(73019);
  const contract = activeContractsForPromotion(aggregate.state, promotionAId)
    .find((entry) => entry.family === "LIMITED_NON_EXCLUSIVE");
  if (!contract) throw new Error("extra-dates fixture has no limited contract");
  contract.datesUsed = contract.dateEntitlement;
  pushPendingOffer(aggregate, promotionAId, contract.personId, "pending-more-dates", contract.weeklyGuarantee);
  const pending = aggregate.state.contractOffers.find((entry) => entry.id === "pending-more-dates");
  if (!pending) throw new Error("extra-dates fixture missing pending proposal");
  pending.offerKind = "DATES_ADDENDUM";
  const alert = buildPlayerAttention(aggregate, "player-a")
    .find((item) => item.attentionId === `contract-dates-exhausted:${contract.id}`);
  ok(alert?.category === "WATCHING", "submitted addendum incorrectly demands a second action");
  ok(alert?.deepLink === "/talent/contracts?personId=" + encodeURIComponent(contract.personId),
    "pending extra dates must open the wrestler's existing proposal");
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

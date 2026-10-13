declare const process: { exitCode?: number };

import {
  buildPlayerAttention,
  buildAlphaPlayerWorldView,
  claimIndependentPromotionForPlayer,
} from "../packages/application/src/index.js";
import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { activeContractsForPromotion } from "../packages/sim-core/src/index.js";

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

test("resolved player contract offers surface accepted and rejected Attention without leaking rival outcomes", () => {
  const playerId = "contract-attention-player";
  const aggregate = createAlphaWorldAggregate({ seed: 61992, playerId });
  const promotion = aggregate.state.promotions.find((candidate) => (
    candidate.playerTakeoverEligibility === "STANDARD" && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("contract attention fixture has no takeover-eligible promotion");
  claimIndependentPromotionForPlayer(aggregate.state, aggregate.ownership, playerId, promotion.id);
  aggregate.runtime.lastResolvedPpwDate = { ...aggregate.state.world.currentDate };

  const acceptedPerson = aggregate.state.people[0]!;
  const rejectedPerson = aggregate.state.people[1]!;
  const rivalPerson = aggregate.state.people[2]!;
  const rivalPromotion = aggregate.state.promotions.find((candidate) => candidate.id !== promotion.id)!;
  const commonTerms = {
    offerKind: "RECRUITMENT" as const,
    family: "LIMITED_NON_EXCLUSIVE" as const,
    exclusivity: "NON_EXCLUSIVE" as const,
    roleExpectation: "FEATURED" as const,
    startDate: { ...aggregate.state.world.currentDate },
    endDate: { year: aggregate.state.world.currentDate.year, week: Math.min(52, aggregate.state.world.currentDate.week + 12), day: 7 },
    dateEntitlement: 8,
    weeklyGuarantee: 1500,
    appearanceFee: 3500,
    signingBonus: 5000,
  };

  aggregate.state.contractOffers.push(
    {
      id: "offer-player-accepted",
      worldId: aggregate.state.world.id,
      personId: acceptedPerson.id,
      promotionId: promotion.id,
      submittedDate: { ...aggregate.state.world.currentDate },
      status: "ACCEPTED",
      resolvedUtility: 73.5,
      rejectionReason: null,
      ...commonTerms,
    },
    {
      id: "offer-player-rejected",
      worldId: aggregate.state.world.id,
      personId: rejectedPerson.id,
      promotionId: promotion.id,
      submittedDate: { ...aggregate.state.world.currentDate },
      status: "REJECTED",
      resolvedUtility: 41.2,
      rejectionReason: "offer utility below acceptance threshold",
      ...commonTerms,
    },
    {
      id: "offer-rival-rejected",
      worldId: aggregate.state.world.id,
      personId: rivalPerson.id,
      promotionId: rivalPromotion.id,
      submittedDate: { ...aggregate.state.world.currentDate },
      status: "REJECTED",
      resolvedUtility: 39,
      rejectionReason: "offer utility below acceptance threshold",
      ...commonTerms,
    },
  );

  const items = buildPlayerAttention(aggregate, playerId);
  const accepted = items.find((item) => item.attentionId === "contract-offer-result:offer-player-accepted");
  const rejected = items.find((item) => item.attentionId === "contract-offer-result:offer-player-rejected");

  ok(accepted?.category === "IMPORTANT", "accepted contract result was not surfaced as Important");
  ok(accepted?.title.includes(acceptedPerson.name), "accepted contract result lost the wrestler name");
  ok(accepted?.title.includes("accepted"), "accepted contract result did not state the decision");
  ok(accepted?.deepLink === `/talent/contracts?personId=${encodeURIComponent(acceptedPerson.id)}`,
    "accepted contract result did not open the correct wrestler in Contracts");
  ok(accepted?.dismissible === true, "accepted contract result should be dismissible");

  ok(rejected?.category === "IMPORTANT", "rejected contract result was not surfaced as Important");
  ok(rejected?.title.includes(rejectedPerson.name), "rejected contract result lost the wrestler name");
  ok(rejected?.title.includes("rejected"), "rejected contract result did not state the decision");
  ok(rejected?.summary.includes("expectations"), "rejected contract result did not translate the internal rejection reason");
  ok(!rejected?.summary.includes("threshold"), "rejected contract result leaked internal threshold wording");
  ok(!items.some((item) => item.attentionId === "contract-offer-result:offer-rival-rejected"), "rival contract outcome leaked into player Attention");
});


test("expiry and exhausted-date attention opens the exact wrestler in the Contracts workspace", () => {
  const playerId = "contract-desk-attention";
  const aggregate = createAlphaWorldAggregate({ seed: 61993, playerId });
  const promotion = aggregate.state.promotions.find((candidate) => (
    candidate.playerTakeoverEligibility === "STANDARD" && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("no Indie for contract desk fixture");
  claimIndependentPromotionForPlayer(aggregate.state, aggregate.ownership, playerId, promotion.id);

  const active = activeContractsForPromotion(aggregate.state, promotion.id);
  const expiryContract = active.find((contract) => contract.family !== "ONE_OFF");
  if (!expiryContract) throw new Error("contract desk fixture has no multiweek signed contract");
  expiryContract.endDate = { ...aggregate.state.world.currentDate, day: 7 };
  const expiryLink = "/talent/contracts?personId=" + encodeURIComponent(expiryContract.personId);
  const expiryAlert = buildPlayerAttention(aggregate, playerId)
    .find((item) => item.attentionId === "contract-expiry:" + expiryContract.id);
  ok(expiryAlert?.deepLink === expiryLink, "expiry alert must link to the affected wrestler's contract");
  const playerExpiry = buildAlphaPlayerWorldView(aggregate, playerId).attention
    .find((item) => item.attentionId === "contract-expiry:" + expiryContract.id);
  ok(playerExpiry?.deepLink === expiryLink, "home Attention deep link must preserve the target wrestler");

  const exhausted = active.find((contract) => (
    contract.family === "LIMITED_NON_EXCLUSIVE" && contract.id !== expiryContract.id
  ));
  if (!exhausted) throw new Error("contract desk fixture has no second limited non-exclusive contract");
  exhausted.datesUsed = exhausted.dateEntitlement;
  const datesAlert = buildAlphaPlayerWorldView(aggregate, playerId).attention
    .find((item) => item.attentionId === "contract-dates-exhausted:" + exhausted.id);
  ok(datesAlert?.deepLink === "/talent/contracts?personId=" + encodeURIComponent(exhausted.personId),
    "exhausted appearance dates should open the specific wrestler's contract editor");
});

console.log(`\nContract-offer Attention tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

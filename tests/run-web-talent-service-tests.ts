declare const process: { exitCode?: number };

import {
  createAlphaWorldAggregate,
  claimAlphaPromotion,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaTalentSession,
  setAlphaRosterAlignment,
  submitAlphaTalentOffer,
} from "../packages/web-adapter/src/talent-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  addPpwWeeks,
  wrestlerAlignment,
  wrestlerAlignmentForPromotion,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
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

await test("Talent service submits a recruitment offer through the idempotent application command", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73001, playerId: "player-a" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const independent = aggregate.state.promotions.find((promotion) => promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no Independent promotion");
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: independent.id,
    requestId: "talent-claim-recruitment",
  });

  const before = await loadAlphaTalentSession(repository, worldId, "player-a");
  const candidate = before.market.find((person) => person.availability === "FREE_AGENT" && !person.hasOurPendingOffer);
  if (!candidate) throw new Error("fixture has no free agent candidate");
  const request = {
    requestId: "talent-recruitment-001",
    personId: candidate.personId,
    sourceContractId: null,
    family: "LIMITED_NON_EXCLUSIVE" as const,
    roleExpectation: "REGULAR" as const,
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.round(candidate.estimatedWeeklyValue * 0.2),
    appearanceFee: candidate.estimatedWeeklyValue,
    signingBonus: candidate.estimatedWeeklyValue,
  };

  const first = await submitAlphaTalentOffer(repository, worldId, "player-a", request);
  ok(first.offerKind === "RECRUITMENT", "recruitment action produced the wrong offer kind");
  ok(first.view.pendingOffers.some((offer) => offer.offerId === first.offerId), "submitted recruitment offer is missing from the player-safe view");
  const afterFirst = await repository.load(worldId);
  const revision = afterFirst.runtime.revision;
  ok(afterFirst.state.contractOffers.filter((offer) => offer.id === first.offerId && offer.status === "PENDING").length === 1, "recruitment offer was not persisted exactly once");
  ok(afterFirst.commands.receipts.filter((receipt) => receipt.requestId === request.requestId).length === 1, "recruitment command receipt was not persisted exactly once");

  const retry = await submitAlphaTalentOffer(repository, worldId, "player-a", request);
  ok(retry.offerId === first.offerId, "idempotent recruitment retry returned a different offer");
  const afterRetry = await repository.load(worldId);
  ok(afterRetry.runtime.revision === revision, "idempotent recruitment retry advanced the World revision");
  ok(afterRetry.state.contractOffers.filter((offer) => offer.id === first.offerId).length === 1, "idempotent recruitment retry duplicated the offer");
});

await test("Talent service stores promotion-specific alignment without rewriting the wrestler globally", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73004, playerId: "player-a" });
  const independent = aggregate.state.promotions.find((promotion) => promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE");
  const rival = aggregate.state.promotions.find((promotion) => promotion.id !== independent?.id && promotion.lifecycle === "ACTIVE");
  if (!independent || !rival) throw new Error("alignment fixture lacks promotions");
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: independent.id,
    requestId: "talent-claim-alignment",
  });

  const before = await loadAlphaTalentSession(repository, worldId, "player-a");
  const rosterEntry = before.roster[0];
  if (!rosterEntry) throw new Error("alignment fixture has no roster wrestler");
  const target = rosterEntry.alignment === "HEEL" ? "FACE" : "HEEL";
  const request = {
    requestId: "talent-alignment-001",
    personId: rosterEntry.personId,
    alignment: target as "FACE" | "HEEL",
  };

  const first = await setAlphaRosterAlignment(repository, worldId, "player-a", request);
  ok(first.alignment === target, "alignment command returned the wrong value");
  ok(first.changeMode === "INITIAL_PRESENTATION" && first.naturalReset, "first promotion presentation was not treated as a clean establishment");
  ok(first.view.roster.find((entry) => entry.personId === rosterEntry.personId)?.alignment === target, "updated alignment did not reach roster view");

  const persisted = await repository.load(worldId);
  const person = persisted.state.people.find((candidate) => candidate.id === rosterEntry.personId);
  if (!person) throw new Error("alignment fixture lost wrestler");
  const baseline = wrestlerAlignment(person, persisted.state.world.seed);
  ok(wrestlerAlignmentForPromotion(persisted.state, independent.id, person.id) === target, "promotion alignment override was not persisted");
  ok(wrestlerAlignmentForPromotion(persisted.state, rival.id, person.id) === baseline, "alignment override leaked into another promotion");
  ok((persisted.state.promotionWrestlerPresentations ?? []).length === 1, "alignment change did not create exactly one presentation record");
  const revision = persisted.runtime.revision;

  await setAlphaRosterAlignment(repository, worldId, "player-a", request);
  const afterRetry = await repository.load(worldId);
  ok(afterRetry.runtime.revision === revision, "idempotent alignment retry advanced World revision");
  ok((afterRetry.state.promotionWrestlerPresentations ?? []).length === 1, "idempotent alignment retry duplicated presentation state");
  ok(
    afterRetry.state.ledger.filter((entry) => entry.type === "PROMOTION_ALIGNMENT_CHANGED").length === 1,
    "idempotent alignment retry duplicated alignment history",
  );

  const secondTarget = target === "HEEL" ? "TWEENER" : "HEEL";
  const second = await setAlphaRosterAlignment(repository, worldId, "player-a", {
    requestId: "talent-alignment-002",
    personId: rosterEntry.personId,
    alignment: secondTarget,
  });
  ok(second.changeMode === "OFFSCREEN_SWITCH" && !second.naturalReset, "repeated roster-page switch was not classified as unexplained");
  const afterSecond = await repository.load(worldId);
  ok(
    afterSecond.state.ledger.some((entry) => entry.type === "PROMOTION_ALIGNMENT_CHANGED" && entry.payload.method === "OFFSCREEN_SWITCH"),
    "off-screen alignment switch was not recorded for future crowd continuity",
  );
});

await test("Talent service renews only inside the renewal window and starts after the current deal", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73002, playerId: "player-a" });
  const independent = aggregate.state.promotions.find((promotion) => promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no Independent promotion");
  const source = aggregate.state.contracts.find((contract) => contract.promotionId === independent.id && contract.status === "SIGNED");
  if (!source) throw new Error("fixture Independent promotion has no signed contract");
  source.endDate = addPpwWeeks(aggregate.state.world.currentDate, 2, aggregate.state.ruleset.weeksPerYear);
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: independent.id,
    requestId: "talent-claim-renewal",
  });

  const before = await loadAlphaTalentSession(repository, worldId, "player-a");
  const rosterEntry = before.roster.find((entry) => entry.contractId === source.id);
  if (!rosterEntry) throw new Error("source contract is missing from player roster view");
  ok(rosterEntry.contract.renewalWindowOpen, "fixture contract did not enter renewal window");

  const family = source.family;
  const termWeeks = family === "EXCLUSIVE" ? 26 : 13;
  const result = await submitAlphaTalentOffer(repository, worldId, "player-a", {
    requestId: "talent-renewal-001",
    personId: source.personId,
    sourceContractId: source.id,
    family,
    roleExpectation: source.roleExpectation,
    termWeeks,
    dateEntitlement: Math.min(source.dateEntitlement, termWeeks * 2),
    weeklyGuarantee: source.weeklyGuarantee,
    appearanceFee: source.appearanceFee,
    signingBonus: source.signingBonus,
  });
  ok(result.offerKind === "RENEWAL", "renewal action produced the wrong offer kind");

  const persisted = await repository.load(worldId);
  const offer = persisted.state.contractOffers.find((candidate) => candidate.id === result.offerId);
  if (!offer) throw new Error("renewal offer was not persisted");
  const expectedStart = addPpwWeeks(source.endDate, 1, persisted.state.ruleset.weeksPerYear);
  ok(
    offer.startDate.year === expectedStart.year && offer.startDate.week === expectedStart.week && offer.startDate.day === expectedStart.day,
    "renewal offer did not start after the existing contract ends",
  );
  ok(persisted.state.contracts.find((contract) => contract.id === source.id)?.status === "SIGNED", "submitting a renewal terminated the existing contract");
});

await test("Talent service rejects a renewal against another promotion's private contract", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73003, playerId: "player-a" });
  const independent = aggregate.state.promotions.find((promotion) => promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no Independent promotion");
  const rivalContract = aggregate.state.contracts.find((contract) => contract.promotionId !== independent.id && contract.status === "SIGNED");
  if (!rivalContract) throw new Error("fixture has no rival contract");
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: independent.id,
    requestId: "talent-claim-private-renewal",
  });

  let rejected = false;
  try {
    await submitAlphaTalentOffer(repository, worldId, "player-a", {
      requestId: "talent-private-renewal-001",
      personId: rivalContract.personId,
      sourceContractId: rivalContract.id,
      family: "LIMITED_NON_EXCLUSIVE",
      roleExpectation: "REGULAR",
      termWeeks: 13,
      dateEntitlement: 5,
      weeklyGuarantee: 1_000,
      appearanceFee: 2_000,
      signingBonus: 1_000,
    });
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("does not belong");
  }
  ok(rejected, "player could use a rival's private contract as a renewal source");
});

console.log(`\nWeb talent-service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

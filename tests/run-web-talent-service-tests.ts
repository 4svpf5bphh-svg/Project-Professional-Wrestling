declare const process: { exitCode?: number };

import {
  createAlphaWorldAggregate,
  claimAlphaPromotion,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaTalentSession,
  setAlphaRosterAlignment,
  setAlphaTalentWatch,
  submitAlphaTalentOffer,
  submitAlphaDatesAddendum,
} from "../packages/web-adapter/src/talent-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  addPpwWeeks,
  canAddLimitedContractDates,
  wrestlerAlignment,
  wrestlerAlignmentForPromotion,
  serviceCapacityDatesPerWeek,
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

await test("Talent Watchlist persists without advancing the simulation revision", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73000, playerId: "player-a" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const independent = aggregate.state.promotions.find((promotion) => promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("Watchlist fixture has no takeover-eligible promotion");
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: independent.id,
    requestId: "talent-claim-watchlist",
  });

  const before = await loadAlphaTalentSession(repository, worldId, "player-a");
  const candidate = before.market[0];
  if (!candidate) throw new Error("Watchlist fixture has no market candidate");
  const persistedBefore = await repository.load(worldId);
  const revisionBefore = persistedBefore.runtime.revision;

  const watched = await setAlphaTalentWatch(repository, worldId, "player-a", {
    personId: candidate.personId,
    watched: true,
  });
  ok(watched.watched, "Watchlist service did not confirm watched state");
  ok(
    watched.view.market.find((entry) => entry.personId === candidate.personId)?.watched === true,
    "Watchlist state did not reach talent projection",
  );

  const afterWatch = await repository.load(worldId);
  ok(afterWatch.runtime.revision === revisionBefore, "Watchlist preference advanced the simulation revision");
  const reloaded = await loadAlphaTalentSession(repository, worldId, "player-a");
  ok(
    reloaded.market.find((entry) => entry.personId === candidate.personId)?.watched === true,
    "Watchlist preference did not survive repository reload",
  );

  const unwatched = await setAlphaTalentWatch(repository, worldId, "player-a", {
    personId: candidate.personId,
    watched: false,
  });
  ok(!unwatched.watched, "Watchlist service did not confirm unwatch");
  const afterUnwatch = await loadAlphaTalentSession(repository, worldId, "player-a");
  ok(
    afterUnwatch.market.find((entry) => entry.personId === candidate.personId)?.watched === false,
    "Unwatch did not survive repository reload",
  );
});

await test("Talent service submits a recruitment offer through the idempotent application command", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73001, playerId: "player-a" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const independent = aggregate.state.promotions.find((promotion) => promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no takeover-eligible promotion");
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
    creativeControl: "PROTECTED_FINISHES" as const,
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.round(candidate.estimatedWeeklyValue * 0.2),
    appearanceFee: candidate.estimatedWeeklyValue,
    signingBonus: candidate.estimatedWeeklyValue,
  };

  const first = await submitAlphaTalentOffer(repository, worldId, "player-a", request);
  ok(first.offerKind === "RECRUITMENT", "recruitment action produced the wrong offer kind");
  ok(first.view.pendingOffers.some((offer) => offer.offerId === first.offerId
    && offer.creativeControl === "PROTECTED_FINISHES"),
    "player-selected creative rights did not reach the pending-offer UI");
  ok(first.view.pendingOffers.some((offer) => offer.offerId === first.offerId), "submitted recruitment offer is missing from the player-safe view");
  const afterFirst = await repository.load(worldId);
  const revision = afterFirst.runtime.revision;
  ok(afterFirst.state.contractOffers.filter((offer) => offer.id === first.offerId && offer.status === "PENDING").length === 1, "recruitment offer was not persisted exactly once");
  ok(afterFirst.state.contractOffers.find((offer) => offer.id === first.offerId)?.creativeControl === "PROTECTED_FINISHES",
    "selected clause was not stored on the authoritative pending contract");
  ok(afterFirst.commands.receipts.filter((receipt) => receipt.requestId === request.requestId).length === 1, "recruitment command receipt was not persisted exactly once");

  const retry = await submitAlphaTalentOffer(repository, worldId, "player-a", request);
  ok(retry.offerId === first.offerId, "idempotent recruitment retry returned a different offer");
  const afterRetry = await repository.load(worldId);
  ok(afterRetry.runtime.revision === revision, "idempotent recruitment retry advanced the World revision");
  ok(afterRetry.state.contractOffers.filter((offer) => offer.id === first.offerId).length === 1, "idempotent recruitment retry duplicated the offer");
  let rejectedRightsChange = false;
  try {
    await submitAlphaTalentOffer(repository, worldId, "player-a", {
      ...request, creativeControl: "FULL_APPROVAL",
    });
  } catch { rejectedRightsChange = true; }
  ok(rejectedRightsChange, "a reused request ID was allowed to escalate the wrestler's creative clause");
  const afterAlteredReplay = await repository.load(worldId);
  ok(afterAlteredReplay.runtime.revision === revision
    && afterAlteredReplay.state.contractOffers.find((offer) => offer.id === first.offerId)?.creativeControl === "PROTECTED_FINISHES",
    "replayed clause-change mutated the existing offer");
  let invalidRejected = false;
  try {
    await submitAlphaTalentOffer(repository, worldId, "player-a", {
      ...request, requestId: "talent-creative-forged", creativeControl: "SECRET_OVERRIDE" as never,
    });
  } catch { invalidRejected = true; }
  ok(invalidRejected && (await repository.load(worldId)).runtime.revision === revision,
    "invalid creative rights slipped through server validation or changed the World");

});

await test("all four creative levels pass player-authored offers end-to-end and legacy requests default to NONE", async () => {
  const levels = ["NONE", "CONSULTATION", "PROTECTED_FINISHES", "FULL_APPROVAL"] as const;
  for (const [index, level] of levels.entries()) {
    const repository = new InMemoryApplicationWorldRepository();
    const aggregate = createAlphaWorldAggregate({ seed: 73400 + index, playerId: "creative-player" });
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const independent = aggregate.state.promotions.find(p =>
      p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
    if (!independent) throw new Error("no indie promotion to take over");
    await claimAlphaPromotion(repository, worldId, "creative-player", {
      promotionId: independent.id, requestId: `creative-claim-${index}`,
    });
    const view = await loadAlphaTalentSession(repository, worldId, "creative-player");
    const wrestler = view.market.find(person => person.availability === "FREE_AGENT" && !person.hasOurPendingOffer);
    if (!wrestler) throw new Error("no free agent for creative contract fixture");
    const request = {
      requestId: `creative-level-${index}`, personId: wrestler.personId, sourceContractId: null,
      family: "LIMITED_NON_EXCLUSIVE" as const,
      roleExpectation: "REGULAR" as const,
      creativeControl: level,
      termWeeks: 13, dateEntitlement: 5,
      weeklyGuarantee: Math.round(wrestler.estimatedWeeklyValue * 0.2),
      appearanceFee: wrestler.estimatedWeeklyValue,
      signingBonus: wrestler.estimatedWeeklyValue,
    };
    const saved = await submitAlphaTalentOffer(repository, worldId, "creative-player", request);
    const pending = saved.view.pendingOffers.find(offer => offer.offerId === saved.offerId);
    const state = await repository.load(worldId);
    ok(pending?.creativeControl === level && state.state.contractOffers
      .find(offer => offer.id === saved.offerId)?.creativeControl === level,
      `wrestler's selected ${level} rights were not consistently persisted/displayed`);
    if (level === "NONE") {
      // Older clients that omit the optional field should safely read it as
      // standard terms and keep the same idempotent command receipt.
      const retry = await submitAlphaTalentOffer(repository, worldId, "creative-player", {
        ...request, creativeControl: undefined,
      });
      ok(retry.offerId === saved.offerId, "legacy omitted-NONE request did not replay identically");
    }
  }
});

await test("exclusive creative offers have unlimited dates and retry with canonical or older transport entitlements", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73501, playerId: "creative-exclusive-player" });
  const independent = aggregate.state.promotions.find(p =>
    p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!independent) throw new Error("exclusive audit needs an indie promotion");
  const freeAgent = aggregate.state.people.find(person => (
    person.status === "ACTIVE"
    && serviceCapacityDatesPerWeek(person) >= 1.05
    && !aggregate.state.contracts.some(contract => contract.personId === person.id && contract.status === "SIGNED")
  ));
  if (!freeAgent) throw new Error("exclusive audit needs a free agent with sufficient service capacity");
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "creative-exclusive-player", {
    promotionId: independent.id, requestId: "creative-exclusive-claim",
  });
  const before = await loadAlphaTalentSession(repository, worldId, "creative-exclusive-player");
  const wrestler = before.market.find(entry => entry.personId === freeAgent.id);
  if (!wrestler) throw new Error("eligible exclusive candidate missing from market");
  const request = {
    requestId: "creative-exclusive-offer",
    personId: freeAgent.id,
    sourceContractId: null,
    family: "EXCLUSIVE" as const,
    roleExpectation: "FEATURED" as const,
    creativeControl: "FULL_APPROVAL" as const,
    termWeeks: 13,
    // Old clients may still supply an arbitrary positive purchased-dates
    // field, even though the new exclusive agreement is unlimited.
    dateEntitlement: 4,
    weeklyGuarantee: wrestler.estimatedWeeklyValue * 2,
    appearanceFee: 0,
    signingBonus: wrestler.estimatedWeeklyValue * 5,
  };
  const first = await submitAlphaTalentOffer(repository, worldId, "creative-exclusive-player", request);
  const after = await repository.load(worldId);
  const offer = after.state.contractOffers.find(entry => entry.id === first.offerId);
  ok(offer?.dateEntitlement === 13 && offer.creativeControl === "FULL_APPROVAL",
    "exclusive offer did not canonicalise the compatibility field or preserve rights");
  ok(first.view.pendingOffers.some(entry => entry.offerId === first.offerId
    && entry.family === "EXCLUSIVE" && entry.creativeControl === "FULL_APPROVAL"),
    "exclusive creative offer missing from player-visible pending summaries");
  const revision = after.runtime.revision;
  const retry = await submitAlphaTalentOffer(repository, worldId, "creative-exclusive-player", request);
  ok(retry.offerId === first.offerId, "identical legacy exclusive retry was rejected");
  const canonicalRetry = await submitAlphaTalentOffer(repository, worldId, "creative-exclusive-player", {
    ...request, dateEntitlement: 13,
  });
  ok(canonicalRetry.offerId === first.offerId,
    "equivalent canonical exclusive request was treated as a different real promise");
  let rightsChangeRejected = false;
  try {
    await submitAlphaTalentOffer(repository, worldId, "creative-exclusive-player", {
      ...request, creativeControl: "NONE",
    });
  } catch { rightsChangeRejected = true; }
  ok(rightsChangeRejected, "reused exclusive request ID allowed rights downgrade");
  const final = await repository.load(worldId);
  ok(final.runtime.revision === revision
    && final.state.contractOffers.filter(entry => entry.id === first.offerId).length === 1
    && final.state.contractOffers.find(entry => entry.id === first.offerId)?.creativeControl === "FULL_APPROVAL",
    "retry or altered-rights attempt mutated the authoritative World");
});

await test("talent date addendum is private, same-contract and idempotent", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73042, playerId: "player-a" });
  const independent = aggregate.state.promotions.find(p => p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!independent) throw new Error("no takeover promotion in date addendum fixture");
  const source = aggregate.state.contracts.find(c => {
    if (c.promotionId !== independent.id || c.status !== "SIGNED" || c.family !== "LIMITED_NON_EXCLUSIVE") return false;
    const person = aggregate.state.people.find(p => p.id === c.personId);
    return Boolean(person && canAddLimitedContractDates(aggregate.state, person!, c, 1).ok);
  });
  if (!source) throw new Error("no amendable non-exclusive contract in fixture");
  const previousDates = source.dateEntitlement;
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: independent.id, requestId: "talent-claim-addendum",
  });
  const request = {
    requestId: "talent-more-dates-001",
    personId: source.personId,
    contractId: source.id,
    additionalDates: 1,
    additionalPayment: 40_000,
  };
  const first = await submitAlphaDatesAddendum(repository, worldId, "player-a", request);
  ok(first.offerKind === "DATES_ADDENDUM" &&
    first.view.pendingOffers.some(o => o.offerId === first.offerId && o.offerKind === "DATES_ADDENDUM"),
    "date addendum not visible to its own booker");
  const after = await repository.load(worldId);
  const revision = after.runtime.revision;
  ok(after.state.contracts.find(c => c.id === source.id)?.dateEntitlement === previousDates,
    "pending additional dates mutated the live contract");
  const offer = after.state.contractOffers.find(o => o.id === first.offerId);
  ok(offer?.sourceContractId === source.id && offer.dateEntitlement === previousDates + 1,
    "date addendum lost original contract and proposed total");
  const retry = await submitAlphaDatesAddendum(repository, worldId, "player-a", request);
  ok(retry.offerId === first.offerId, "retry created duplicate date proposal");
  const afterRetry = await repository.load(worldId);
  ok(afterRetry.runtime.revision === revision &&
    afterRetry.state.contractOffers.filter(o => o.id === first.offerId).length === 1,
    "idempotent retry modified the World");
  let rejected = false;
  try {
    await submitAlphaDatesAddendum(repository, worldId, "player-a",
      { ...request, additionalPayment: request.additionalPayment + 1000 });
  } catch { rejected = true; }
  ok(rejected, "reusing requestId with different date terms was accepted");
});

await test("Talent service stores promotion-specific alignment without rewriting the wrestler globally", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73004, playerId: "player-a" });
  const independent = aggregate.state.promotions.find((promotion) => promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE");
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
  const independent = aggregate.state.promotions.find((promotion) => promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no takeover-eligible promotion");
  const source = aggregate.state.contracts.find((contract) => contract.promotionId === independent.id && contract.status === "SIGNED");
  if (!source) throw new Error("fixture takeover promotion has no signed contract");
  source.endDate = addPpwWeeks(aggregate.state.world.currentDate, 2, aggregate.state.ruleset.weeksPerYear);
  source.creativeControl = "PROTECTED_FINISHES";
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
    creativeControl: "FULL_APPROVAL",
    termWeeks,
    dateEntitlement: Math.min(source.dateEntitlement, termWeeks * 2),
    weeklyGuarantee: source.weeklyGuarantee,
    appearanceFee: source.appearanceFee,
    signingBonus: source.signingBonus,
  });
  ok(result.offerKind === "RENEWAL", "renewal action produced the wrong offer kind");
  ok(result.view.pendingOffers.some((offer) => offer.offerId === result.offerId
    && offer.creativeControl === "FULL_APPROVAL"),
    "new creative rights were not visible in the submitted renewal offer");

  const persisted = await repository.load(worldId);
  const offer = persisted.state.contractOffers.find((candidate) => candidate.id === result.offerId);
  if (!offer) throw new Error("renewal offer was not persisted");
  ok(offer.creativeControl === "FULL_APPROVAL", "renewal consent upgrade was lost before acceptance");
  ok(persisted.state.contracts.find(contract => contract.id === source.id)?.creativeControl === "PROTECTED_FINISHES",
    "new renewal rights silently rewrote the still-active signed contract");
  const expectedStart = addPpwWeeks(source.endDate, 1, persisted.state.ruleset.weeksPerYear);
  ok(
    offer.startDate.year === expectedStart.year && offer.startDate.week === expectedStart.week && offer.startDate.day === expectedStart.day,
    "renewal offer did not start after the existing contract ends",
  );
  ok(persisted.state.contracts.find((contract) => contract.id === source.id)?.status === "SIGNED", "submitting a renewal terminated the existing contract");
});

await test("Talent service opens renegotiation when purchased dates are exhausted", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73005, playerId: "player-a" });
  const independent = aggregate.state.promotions.find((promotion) => promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no takeover-eligible promotion");
  const source = aggregate.state.contracts.find((contract) => (
    contract.promotionId === independent.id
    && contract.status === "SIGNED"
    && contract.family !== "ONE_OFF"
  ));
  if (!source) throw new Error("fixture takeover promotion has no limited-date contract");
  source.datesUsed = source.dateEntitlement;
  source.endDate = addPpwWeeks(aggregate.state.world.currentDate, aggregate.state.ruleset.renewalWindowWeeks + 6, aggregate.state.ruleset.weeksPerYear);
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: independent.id,
    requestId: "talent-claim-exhausted-renewal",
  });

  const before = await loadAlphaTalentSession(repository, worldId, "player-a");
  const rosterEntry = before.roster.find((entry) => entry.contractId === source.id);
  if (!rosterEntry) throw new Error("exhausted contract is missing from player roster view");
  ok(rosterEntry.contract.datesRemaining === 0, "fixture contract was not exhausted");
  ok(rosterEntry.contract.renewalWindowOpen, "exhausted contract did not open renegotiation");
  ok(rosterEntry.contract.renewalReason === "DATES_EXHAUSTED", "exhausted contract exposed the wrong renewal reason");

  const result = await submitAlphaTalentOffer(repository, worldId, "player-a", {
    requestId: "talent-exhausted-renewal-001",
    personId: source.personId,
    sourceContractId: source.id,
    family: "LIMITED_NON_EXCLUSIVE",
    roleExpectation: source.roleExpectation,
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.max(source.weeklyGuarantee, 50_000),
    appearanceFee: Math.max(source.appearanceFee, 50_000),
    signingBonus: Math.max(source.signingBonus, 100_000),
  });
  ok(result.offerKind === "RENEWAL", "exhausted-date action produced the wrong offer kind");

  const persisted = await repository.load(worldId);
  const offer = persisted.state.contractOffers.find((candidate) => candidate.id === result.offerId);
  if (!offer) throw new Error("exhausted renewal offer was not persisted");
  ok(
    offer.startDate.year === persisted.state.world.currentDate.year
      && offer.startDate.week === persisted.state.world.currentDate.week
      && offer.startDate.day === persisted.state.world.currentDate.day,
    "exhausted-date renewal did not start immediately",
  );
  ok(offer.sourceContractId === source.id, "exhausted-date renewal lost source contract identity");
  const revisionAfterFirst = persisted.runtime.revision;

  const retry = await submitAlphaTalentOffer(repository, worldId, "player-a", {
    requestId: "talent-exhausted-renewal-001",
    personId: source.personId,
    sourceContractId: source.id,
    family: "LIMITED_NON_EXCLUSIVE",
    roleExpectation: source.roleExpectation,
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.max(source.weeklyGuarantee, 50_000),
    appearanceFee: Math.max(source.appearanceFee, 50_000),
    signingBonus: Math.max(source.signingBonus, 100_000),
  });
  ok(retry.offerId === result.offerId, "idempotent exhausted-date renewal returned a different offer");
  const afterRetry = await repository.load(worldId);
  ok(afterRetry.runtime.revision === revisionAfterFirst, "idempotent exhausted-date renewal advanced World revision twice");
  ok(
    afterRetry.state.contractOffers.filter((candidate) => candidate.id === result.offerId).length === 1,
    "idempotent exhausted-date renewal duplicated the offer",
  );
});

await test("Talent service rejects a renewal against another promotion's private contract", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73003, playerId: "player-a" });
  const independent = aggregate.state.promotions.find((promotion) => promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no takeover-eligible promotion");
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

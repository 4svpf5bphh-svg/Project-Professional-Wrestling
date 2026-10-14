declare const process: { exitCode?: number };

import {
  createAlphaWorldAggregate,
  claimAlphaPromotion,
  advanceAlphaWorldWeek,
  loadAlphaPlayerSession,
  saveAlphaCurrentWeekShowPlan,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaCurrentWeekCard,
  saveAlphaCurrentWeekCard,
} from "../packages/web-adapter/src/card-service.js";
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
  contractHasAppearanceRights,
  contractIsActive,
  contractCoversBookedDate,
  evaluateContractOffer,
  formatEntityId,
  snapshotEntityIdCounters,
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
  const beforeGuardrail = await repository.load(worldId);
  const minimum = Math.ceil(wrestler.estimatedWeeklyValue * 0.5);
  for (const invalid of [
    { ...request, weeklyGuarantee: 0, appearanceFee: wrestler.estimatedWeeklyValue * 100 },
    { ...request, weeklyGuarantee: minimum - 1, appearanceFee: 0 },
    { ...request, weeklyGuarantee: minimum, appearanceFee: wrestler.estimatedWeeklyValue },
  ]) {
    let blocked = false;
    try {
      await submitAlphaTalentOffer(repository, worldId, "creative-exclusive-player", invalid);
    } catch (error) {
      blocked = error instanceof Error && error.message.includes("exclusive");
    }
    ok(blocked, "Web Talent allowed free or appearance-only exclusive warehousing");
    const unchanged = await repository.load(worldId);
    ok(unchanged.runtime.revision === beforeGuardrail.runtime.revision
      && unchanged.state.contractOffers.length === beforeGuardrail.state.contractOffers.length
      && unchanged.commands.receipts.length === beforeGuardrail.commands.receipts.length,
      "invalid exclusive bid changed authoritative World or acquired a request receipt");
  }
  // Same requestId can still be submitted legitimately after an invalid attempt:
  // only a VALID command earns an idempotency receipt.
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

await test("accepted player one-off is bookable on the following PPW show, not spent at offer resolution", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73510, playerId: "one-off-player" });
  const independent = aggregate.state.promotions.find(p =>
    p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!independent) throw new Error("one-off fixture has no takeover-eligible indie");
  const flagship = aggregate.state.showSeries?.find(series =>
    series.promotionId === independent.id && series.role === "FLAGSHIP");
  if (!flagship) throw new Error("one-off fixture has no flagship show series");
  flagship.cadenceWeeks = 1;
  flagship.anchorWeek = 0;
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "one-off-player", {
    promotionId: independent.id, requestId: "one-off-claim",
  });
  const before = await loadAlphaTalentSession(repository, worldId, "one-off-player");
  const initial = (await repository.load(worldId)).state;
  const now = initial.world.currentDate;
  const nextWeek = { ...addPpwWeeks(now, 1, initial.ruleset.weeksPerYear), day: 1 };
  // This tests timing, not a guarantee that any wrestler will sign.
  // Select an actually willing free agent through PPW's existing scorer,
  // without changing the production acceptance rules or wrestler priorities.
  const predictedOfferId = formatEntityId("contractOffer",
    snapshotEntityIdCounters(initial).contractOffer + 1);
  const candidates = before.market
    .filter(entry => entry.availability === "FREE_AGENT" && entry.division === "MEN")
    .map(entry => {
      const person = initial.people.find(p => p.id === entry.personId);
      if (!person || person.status !== "ACTIVE" || serviceCapacityDatesPerWeek(person) < 1.05) return null;
      const score = evaluateContractOffer(initial, {
        id: predictedOfferId, worldId, personId: entry.personId,
        promotionId: independent.id, submittedDate: { ...now },
        status: "PENDING", offerKind: "RECRUITMENT", resolvedUtility: null,
        rejectionReason: null, family: "ONE_OFF", exclusivity: "OPEN",
        roleExpectation: "MAIN_EVENT", creativeControl: "NONE",
        startDate: nextWeek, endDate: { ...nextWeek, day: 7 }, dateEntitlement: 1,
        weeklyGuarantee: 0, appearanceFee: entry.estimatedWeeklyValue * 2, signingBonus: 0,
      });
      return { entry, score };
    })
    .filter((item): item is { entry: (typeof before.market)[number]; score: number } => item !== null)
    .sort((a, b) => b.score - a.score);
  const chosen = candidates[0];
  if (!chosen || chosen.score < initial.ruleset.offerAcceptanceThreshold + 3) {
    throw new Error(`no credibly willing indie one-off candidate: strongest score ${chosen?.score ?? "none"}`);
  }
  const wrestler = chosen.entry;
  const offerResult = await submitAlphaTalentOffer(repository, worldId, "one-off-player", {
    requestId: "one-off-offer", personId: wrestler.personId, sourceContractId: null,
    family: "ONE_OFF", roleExpectation: "MAIN_EVENT", creativeControl: "NONE",
    termWeeks: 1, dateEntitlement: 1, weeklyGuarantee: 0,
    appearanceFee: wrestler.estimatedWeeklyValue * 2, signingBonus: 0,
  });
  const offered = (await repository.load(worldId)).state.contractOffers.find(o => o.id === offerResult.offerId);
  ok(offered?.startDate.year === nextWeek.year && offered.startDate.week === nextWeek.week
    && offered.endDate.year === nextWeek.year && offered.endDate.week === nextWeek.week
    && offered.startDate.day === 1 && offered.endDate.day === 7,
    "human one-off is not dated for the next bookable PPW week");
  ok(!offerResult.view.roster.some(entry => entry.personId === wrestler.personId),
    "unaccepted one-off appeared as owned, available talent");

  // Contract bids resolve during this tick, *after* the previous show's booking window.
  const beforeTick = await loadAlphaPlayerSession(repository, worldId, "one-off-player");
  const acceptedWeek = await advanceAlphaWorldWeek(repository, worldId, "one-off-player", {
    expectedRevision: beforeTick.world.revision,
  });
  const afterFirst = await repository.load(worldId);
  const accepted = afterFirst.state.contractOffers.find(o => o.id === offerResult.offerId);
  ok(accepted?.status === "ACCEPTED",
    `strong one-off offer did not resolve as accepted: ${accepted?.rejectionReason ?? "unknown"}`);
  if (!accepted) throw new Error("one-off offer disappeared during World resolution");
  const signed = afterFirst.state.contracts.find(c => c.sourceOfferId === accepted.id);
  if (!signed) throw new Error("accepted one-off created no signed contract");
  ok(contractIsActive(afterFirst.state, signed) && contractHasAppearanceRights(signed),
    "accepted one-off expired or exhausted before the booker could use it");
  ok(acceptedWeek.world.week === nextWeek.week && acceptedWeek.world.year === nextWeek.year,
    "World did not advance to the exact accepted one-off booking week");
  const promotion = acceptedWeek.promotion;
  if (!promotion) throw new Error("one-off player lost their promotion after acceptance");
  ok(promotion.roster.some(person => person.personId === wrestler.personId && person.datesRemaining > 0),
    "accepted one-off does not appear as available on the player roster");

  // Prove the actual reservation and authored card pipeline admits this signing.
  const eligibleIds = promotion.roster
    .filter(person => person.status === "ACTIVE" && person.datesRemaining > 0)
    .map(person => person.personId);
  const eligibleSameDivision = afterFirst.state.people.filter(person =>
    person.division === wrestler.division && eligibleIds.includes(person.id)
    && person.id !== wrestler.personId).map(person => person.id);
  const targetCount = Math.min(promotion.showPlanning.maxParticipants,
    Math.max(promotion.showPlanning.minParticipants, 4));
  const evenCount = targetCount % 2 === 0 ? targetCount : targetCount + 1;
  const participants = [wrestler.personId, ...eligibleSameDivision].slice(0, evenCount);
  if (participants.length !== evenCount || evenCount > promotion.showPlanning.maxParticipants) {
    throw new Error("one-off booking fixture lacks sufficient same-division participants");
  }
  const market = promotion.showPlanning.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("one-off test has no event market/venue");
  await saveAlphaCurrentWeekShowPlan(repository, worldId, "one-off-player", {
    requestId: "one-off-reserve-show", expectedRevision: acceptedWeek.world.revision,
    expectedPlanVersion: promotion.showPlanning.workspaceVersion,
    day: 6, marketId: market.marketId, venueId: venue.venueId,
    ticketStrategy: "STANDARD", participantIds: participants,
  });
  const card = await loadAlphaCurrentWeekCard(repository, worldId, "one-off-player");
  ok(card.canEdit && card.participants.some(p => p.personId === wrestler.personId),
    "one-off does not make it onto the player-editable reserved Show Card");
  const matches = Array.from({ length: participants.length / 2 }, (_, i) => ({
    draftMatchId: `one-off-match-${i + 1}`,
    type: "SINGLES" as const,
    sideAIds: [participants[2 * i]!],
    sideBIds: [participants[2 * i + 1]!],
    intendedWinnerSide: "A" as const,
    intent: "COMPETITIVE" as const,
    plannedLengthMinutes: 12,
  }));
  const saved = await saveAlphaCurrentWeekCard(repository, worldId, "one-off-player", {
    requestId: "one-off-book-card",
    expectedRevision: card.world.revision,
    expectedPlanVersion: card.workspaceVersion,
    matches, championshipAssignments: [],
  });
  ok(saved.matches.some(match => match.sideAIds.includes(wrestler.personId)),
    "one-off was not retained in the saved player-authored match");
  const resolved = await advanceAlphaWorldWeek(repository, worldId, "one-off-player", {
    expectedRevision: saved.world.revision,
  });
  ok((resolved.promotion?.lastResolvedShow?.matchCount ?? 0) >= matches.length,
    "signed one-off could not be materialized into the player's next show");
  const afterShow = await repository.load(worldId);
  ok(afterShow.state.contracts.find(c => c.id === signed.id)?.datesUsed === 1,
    "the one purchased date was not consumed by the completed booked show");
});

await test("exhausted-date renewal to a one-off starts next week without premature rights", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73511, playerId: "one-off-renewal-player" });
  const independent = aggregate.state.promotions.find(p =>
    p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!independent) throw new Error("one-off renewal fixture lacks a promotion");
  // This legacy next-week fixture explicitly represents a weekly operator.
  // The distinct biweekly regression checks calendar-aligned later starts.
  const flagship = aggregate.state.showSeries?.find(series =>
    series.promotionId === independent.id && series.role === "FLAGSHIP");
  if (!flagship) throw new Error("one-off renewal fixture lacks a flagship calendar");
  flagship.cadenceWeeks = 1;
  flagship.anchorWeek = 0;
  const source = aggregate.state.contracts.find(c =>
    c.promotionId === independent.id && c.status === "SIGNED" && c.family === "LIMITED_NON_EXCLUSIVE"
    && serviceCapacityDatesPerWeek(aggregate.state.people.find(p => p.id === c.personId)!) >= 1.05);
  if (!source) throw new Error("one-off renewal fixture lacks a limited roster contract");
  source.datesUsed = source.dateEntitlement;
  source.endDate = addPpwWeeks(aggregate.state.world.currentDate, 7, aggregate.state.ruleset.weeksPerYear);
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "one-off-renewal-player", {
    promotionId: independent.id, requestId: "one-off-renewal-claim",
  });
  const view = await loadAlphaTalentSession(repository, worldId, "one-off-renewal-player");
  const wrestler = view.roster.find(p => p.contractId === source.id);
  if (!wrestler || wrestler.contract.renewalReason !== "DATES_EXHAUSTED") {
    throw new Error("one-off renewal fixture did not expose exhausted dates");
  }
  const current = (await repository.load(worldId)).state.world.currentDate;
  const nextWeek = addPpwWeeks(current, 1, aggregate.state.ruleset.weeksPerYear);
  const offer = await submitAlphaTalentOffer(repository, worldId, "one-off-renewal-player", {
    requestId: "one-off-renewal-offer", personId: source.personId, sourceContractId: source.id,
    family: "ONE_OFF", roleExpectation: "MAIN_EVENT", creativeControl: "CONSULTATION",
    termWeeks: 1, dateEntitlement: 1, weeklyGuarantee: 0,
    appearanceFee: wrestler.estimatedWeeklyValue * 25, signingBonus: 0,
  });
  const beforeAcceptance = await repository.load(worldId);
  const pending = beforeAcceptance.state.contractOffers.find(o => o.id === offer.offerId);
  ok(pending?.startDate.week === nextWeek.week && pending.startDate.year === nextWeek.year
    && pending.endDate.week === nextWeek.week && pending.endDate.year === nextWeek.year
    && pending.startDate.day === 1 && pending.endDate.day === 7,
    "exhausted-to-one-off replacement still starts in the already-locked offer week");
  ok(beforeAcceptance.state.contracts.find(c => c.id === source.id)?.status === "SIGNED",
    "submitting a future one-off prematurely terminated the source contract");
  const beforeTick = await loadAlphaPlayerSession(repository, worldId, "one-off-renewal-player");
  await advanceAlphaWorldWeek(repository, worldId, "one-off-renewal-player", {
    expectedRevision: beforeTick.world.revision,
  });
  const afterAcceptance = await repository.load(worldId);
  const decided = afterAcceptance.state.contractOffers.find(o => o.id === offer.offerId);
  ok(decided?.status === "ACCEPTED",
    `strong one-off renewal was not accepted: ${decided?.rejectionReason ?? "unknown"}`);
  const replacement = afterAcceptance.state.contracts.find(c => c.sourceOfferId === offer.offerId);
  ok(replacement?.status === "SIGNED" && contractIsActive(afterAcceptance.state, replacement)
    && contractHasAppearanceRights(replacement),
    "accepted one-off renewal did not become an active next-week appearance");
  ok(afterAcceptance.state.contracts.find(c => c.id === source.id)?.status === "TERMINATED",
    "accepted exhausted renewal left a superseded contract overlapping the new booking");
});

await test("biweekly one-off targets the first actual show and survives the empty intervening week", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73521, playerId: "biweekly-player" });
  const independent = aggregate.state.promotions.find(p =>
    p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!independent) throw new Error("biweekly fixture has no indie promotion");
  const flagship = aggregate.state.showSeries?.find(s =>
    s.promotionId === independent.id && s.role === "FLAGSHIP");
  if (!flagship) throw new Error("biweekly fixture has no flagship calendar");
  for (const series of aggregate.state.showSeries ?? []) {
    if (series.promotionId === independent.id && series.id !== flagship.id) series.active = false;
  }
  flagship.cadenceWeeks = 2;
  flagship.anchorWeek = 0; // Week 1 show; Week 2 blank; Week 3 show.
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "biweekly-player", {
    promotionId: independent.id, requestId: "biweekly-claim",
  });
  const state = (await repository.load(worldId)).state;
  const firstShowWeek = addPpwWeeks(state.world.currentDate, 2, state.ruleset.weeksPerYear);
  const pendingOfferId = formatEntityId("contractOffer",
    snapshotEntityIdCounters(state).contractOffer + 1);
  const view = await loadAlphaTalentSession(repository, worldId, "biweekly-player");
  const sorted = view.market
    .filter(entry => entry.availability === "FREE_AGENT" && entry.division === "MEN")
    .map(entry => {
      const person = state.people.find(p => p.id === entry.personId);
      if (!person || person.status !== "ACTIVE" || serviceCapacityDatesPerWeek(person) < 1.05) return null;
      const utility = evaluateContractOffer(state, {
        id: pendingOfferId, worldId, personId: entry.personId,
        promotionId: independent.id, submittedDate: { ...state.world.currentDate },
        status: "PENDING", offerKind: "RECRUITMENT", resolvedUtility: null,
        rejectionReason: null, family: "ONE_OFF", exclusivity: "OPEN",
        roleExpectation: "MAIN_EVENT", startDate: { ...firstShowWeek, day: 1 },
        endDate: { ...firstShowWeek, day: 7 }, dateEntitlement: 1,
        weeklyGuarantee: 0, appearanceFee: entry.estimatedWeeklyValue * 2, signingBonus: 0,
      });
      return { entry, utility };
    }).filter((v): v is { entry: (typeof view.market)[number]; utility: number } => v !== null)
    .sort((a, b) => b.utility - a.utility);
  const chosen = sorted[0];
  if (!chosen || chosen.utility < state.ruleset.offerAcceptanceThreshold + 3) {
    throw new Error(`biweekly fixture has no willing free agent, best utility ${chosen?.utility ?? "none"}`);
  }
  const offer = await submitAlphaTalentOffer(repository, worldId, "biweekly-player", {
    requestId: "biweekly-one-off", personId: chosen.entry.personId,
    family: "ONE_OFF", roleExpectation: "MAIN_EVENT", creativeControl: "NONE",
    termWeeks: 1, dateEntitlement: 1, weeklyGuarantee: 0,
    appearanceFee: chosen.entry.estimatedWeeklyValue * 2, signingBonus: 0,
  });
  const afterOffer = await repository.load(worldId);
  const pending = afterOffer.state.contractOffers.find(o => o.id === offer.offerId);
  ok(pending?.startDate.year === firstShowWeek.year && pending.startDate.week === firstShowWeek.week
    && pending.startDate.day === 1 && pending.endDate.day === 7,
    "biweekly one-off did not align with its actual next event");
  const retry = await submitAlphaTalentOffer(repository, worldId, "biweekly-player", {
    requestId: "biweekly-one-off", personId: chosen.entry.personId,
    family: "ONE_OFF", roleExpectation: "MAIN_EVENT", creativeControl: "NONE",
    termWeeks: 1, dateEntitlement: 1, weeklyGuarantee: 0,
    appearanceFee: chosen.entry.estimatedWeeklyValue * 2, signingBonus: 0,
  });
  ok(retry.offerId === offer.offerId, "biweekly one-off replay duplicated the offer");

  const initialSession = await loadAlphaPlayerSession(repository, worldId, "biweekly-player");
  const emptyWeekSession = await advanceAlphaWorldWeek(repository, worldId, "biweekly-player", {
    expectedRevision: initialSession.world.revision,
  });
  const afterAcceptance = await repository.load(worldId);
  const decided = afterAcceptance.state.contractOffers.find(o => o.id === offer.offerId);
  ok(decided?.status === "ACCEPTED", `biweekly one-off was rejected: ${decided?.rejectionReason ?? "unknown"}`);
  const signed = afterAcceptance.state.contracts.find(c => c.sourceOfferId === offer.offerId);
  if (!signed) throw new Error("accepted biweekly one-off has no signed contract");
  ok(!contractIsActive(afterAcceptance.state, signed) && signed.datesUsed === 0,
    "biweekly contract incorrectly starts in the no-show interim week");
  const dueWeekSession = await advanceAlphaWorldWeek(repository, worldId, "biweekly-player", {
    expectedRevision: emptyWeekSession.world.revision,
  });
  const showState = await repository.load(worldId);
  ok(dueWeekSession.world.year === firstShowWeek.year && dueWeekSession.world.week === firstShowWeek.week
    && contractIsActive(showState.state, signed),
    "accepted biweekly one-off was not active when its actual show became due");
  const promotion = dueWeekSession.promotion;
  if (!promotion) throw new Error("biweekly promotion vanished");
  ok(promotion.roster.some(p => p.personId === chosen.entry.personId && p.datesRemaining > 0),
    "biweekly one-off missing from roster on event week");
  const sameDivision = promotion.roster.filter(p =>
    showState.state.people.find(person => person.id === p.personId)?.division === "MEN"
    && p.status === "ACTIVE" && p.datesRemaining > 0
    && p.personId !== chosen.entry.personId);
  const evenCount = Math.max(4, promotion.showPlanning.minParticipants % 2
    ? promotion.showPlanning.minParticipants + 1 : promotion.showPlanning.minParticipants);
  const participants = [chosen.entry.personId, ...sameDivision.map(p => p.personId)].slice(0, evenCount);
  if (participants.length < evenCount || evenCount > promotion.showPlanning.maxParticipants) {
    throw new Error("biweekly fixture lacks valid same-division show participants");
  }
  const market = promotion.showPlanning.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("biweekly fixture missing venue or market");
  const reserved = await saveAlphaCurrentWeekShowPlan(repository, worldId, "biweekly-player", {
    requestId: "biweekly-book-show", expectedRevision: dueWeekSession.world.revision,
    expectedPlanVersion: promotion.showPlanning.workspaceVersion, day: 6,
    marketId: market.marketId, venueId: venue.venueId,
    ticketStrategy: "STANDARD", participantIds: participants,
  });
  ok(reserved.promotion?.showPlanning.currentPlan?.participantIds.includes(chosen.entry.personId),
    "biweekly event reservation rejected the accepted one-off");
});

await test("one-off refuses distant schedules instead of selling a date without a bookable show", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73522, playerId: "sparse-player" });
  const independent = aggregate.state.promotions.find(p =>
    p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!independent) throw new Error("sparse fixture has no promotion");
  const flagship = aggregate.state.showSeries?.find(s =>
    s.promotionId === independent.id && s.role === "FLAGSHIP");
  if (!flagship) throw new Error("sparse fixture has no calendar");
  for (const series of aggregate.state.showSeries ?? []) {
    if (series.promotionId === independent.id && series.id !== flagship.id) series.active = false;
  }
  flagship.cadenceWeeks = 26;
  flagship.anchorWeek = 0;
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "sparse-player", {
    promotionId: independent.id, requestId: "sparse-claim",
  });
  const view = await loadAlphaTalentSession(repository, worldId, "sparse-player");
  const wrestler = view.market.find(p => p.availability === "FREE_AGENT");
  if (!wrestler) throw new Error("sparse fixture missing an available wrestler");
  const pre = await repository.load(worldId);
  let rejected = false;
  try {
    await submitAlphaTalentOffer(repository, worldId, "sparse-player", {
      requestId: "sparse-one-off", personId: wrestler.personId,
      family: "ONE_OFF", roleExpectation: "REGULAR", termWeeks: 1,
      dateEntitlement: 1, weeklyGuarantee: 0,
      appearanceFee: wrestler.estimatedWeeklyValue * 2, signingBonus: 0,
    });
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("No scheduled promotion show");
  }
  const after = await repository.load(worldId);
  ok(rejected && after.runtime.revision === pre.runtime.revision
    && after.state.contractOffers.length === pre.state.contractOffers.length,
    "one-off with no near-term scheduled event mutated the World or sold an unusable date");
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

await test("signed next-term renewal does not block a current-term dates addendum", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73042, playerId: "player-a" });
  const promotion = aggregate.state.promotions.find(
    (candidate) => candidate.playerTakeoverEligibility === "STANDARD" && candidate.lifecycle === "ACTIVE"
  );
  if (!promotion) throw new Error("no promotion for signed-renewal addendum fixture");
  const source = aggregate.state.contracts.find((contract) => {
    if (contract.promotionId !== promotion.id || contract.status !== "SIGNED" || contract.family !== "LIMITED_NON_EXCLUSIVE") return false;
    const person = aggregate.state.people.find((candidate) => candidate.id === contract.personId);
    return Boolean(person && canAddLimitedContractDates(aggregate.state, person, contract, 1).ok);
  });
  if (!source) throw new Error("no current deal can accept additional dates");

  source.datesUsed = source.dateEntitlement;
  const currentEntitlement = source.dateEntitlement;
  const futureStart = addPpwWeeks(source.endDate, 1, aggregate.state.ruleset.weeksPerYear);
  const nextContract = {
    ...structuredClone(source),
    id: "signed-next-term-for-date-addendum",
    signedDate: { ...aggregate.state.world.currentDate },
    startDate: futureStart,
    endDate: addPpwWeeks(futureStart, 12, aggregate.state.ruleset.weeksPerYear),
    dateEntitlement: 9,
    datesUsed: 0,
  };
  aggregate.state.contracts.push(nextContract);
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: promotion.id,
    requestId: "claim-signed-renewal-dates",
  });

  const before = await loadAlphaTalentSession(repository, worldId, "player-a");
  const wrestler = before.roster.find((entry) => entry.personId === source.personId);
  ok(wrestler?.scheduledRenewals?.some((renewal) => renewal.contractId === nextContract.id),
    "signed future renewal is not visible before its start");
  ok(wrestler?.contract.datesRemaining === 0 && wrestler.contract.renewalReason === "DATES_EXHAUSTED",
    "current exhausted deal must remain eligible for a dates addendum, not another full renewal");
  ok(wrestler?.contract.sameTermsRenewal === null, "signed future terms left another renewal action enabled");

  const submitted = await submitAlphaDatesAddendum(repository, worldId, "player-a", {
    requestId: "signed-next-term-current-addendum",
    personId: source.personId,
    contractId: source.id,
    additionalDates: 1,
    additionalPayment: 40_000,
  });
  ok(submitted.offerKind === "DATES_ADDENDUM", "dates proposal incorrectly became a second renewal");
  const after = await repository.load(worldId);
  const persistedCurrent = after.state.contracts.find((contract) => contract.id === source.id);
  const persistedFuture = after.state.contracts.find((contract) => contract.id === nextContract.id);
  const offer = after.state.contractOffers.find((entry) => entry.id === submitted.offerId);
  ok(persistedCurrent?.dateEntitlement === currentEntitlement
    && persistedCurrent.datesUsed === currentEntitlement,
    "pending addendum changed current contractual appearance rights without consent");
  ok(persistedFuture?.dateEntitlement === 9 && persistedFuture.datesUsed === 0,
    "current-term dates offer modified the already-signed future agreement");
  ok(offer?.sourceContractId === source.id && offer.dateEntitlement === currentEntitlement + 1,
    "addendum did not apply to the correct current-term contract");
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

for (const family of ["LIMITED_NON_EXCLUSIVE", "EXCLUSIVE"] as const) {
  await test(`new human ${family} starts paying only in its first player-bookable PPW week`, async () => {
    const playerId = `first-paid-${family}`;
    const repository = new InMemoryApplicationWorldRepository();
    const aggregate = createAlphaWorldAggregate({
      seed: family === "EXCLUSIVE" ? 73611 : 73610, playerId,
    });
    const independent = aggregate.state.promotions.find(p =>
      p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
    if (!independent) throw new Error("paid-week fixture has no eligible indie");
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    await claimAlphaPromotion(repository, worldId, playerId, {
      promotionId: independent.id, requestId: `claim-${family}`,
    });
    const before = await loadAlphaTalentSession(repository, worldId, playerId);
    const initial = (await repository.load(worldId)).state;
    const submissionWeek = initial.world.currentDate;
    const effectiveStart = { ...addPpwWeeks(submissionWeek, 1, initial.ruleset.weeksPerYear), day: 1 };
    const termWeeks = 13;
    const endDate = addPpwWeeks(effectiveStart, termWeeks - 1, initial.ruleset.weeksPerYear);
    const predictedOfferId = formatEntityId("contractOffer",
      snapshotEntityIdCounters(initial).contractOffer + 1);
    const termsFor = (personId: string, market: number) => ({
      id: predictedOfferId,
      worldId, personId, promotionId: independent.id,
      submittedDate: { ...submissionWeek }, status: "PENDING" as const,
      offerKind: "RECRUITMENT" as const, resolvedUtility: null, rejectionReason: null,
      family,
      exclusivity: family === "EXCLUSIVE" ? "EXCLUSIVE" as const : "NON_EXCLUSIVE" as const,
      roleExpectation: "MAIN_EVENT" as const, creativeControl: "NONE" as const,
      startDate: effectiveStart, endDate, dateEntitlement: family === "EXCLUSIVE" ? termWeeks : 5,
      weeklyGuarantee: market * (family === "EXCLUSIVE" ? 4 : 2),
      appearanceFee: family === "EXCLUSIVE" ? 0 : market * 3,
      signingBonus: market * 10,
    });
    const candidates = before.market
      .filter(p => p.availability === "FREE_AGENT")
      .map(p => {
        const person = initial.people.find(x => x.id === p.personId);
        if (!person || person.status !== "ACTIVE"
          || serviceCapacityDatesPerWeek(person) < 1.05) return null;
        return { entry: p, score: evaluateContractOffer(initial, termsFor(p.personId, p.estimatedWeeklyValue)) };
      })
      .filter((x): x is { entry: (typeof before.market)[number]; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);
    const chosen = candidates[0];
    if (!chosen || chosen.score < initial.ruleset.offerAcceptanceThreshold + 3) {
      throw new Error(`no willing ${family} first-paid-week fixture candidate: ${chosen?.score ?? "none"}`);
    }
    const requestTerms = termsFor(chosen.entry.personId, chosen.entry.estimatedWeeklyValue);
    const request = {
      requestId: `first-paid-offer-${family}`,
      personId: chosen.entry.personId, sourceContractId: null,
      family, roleExpectation: requestTerms.roleExpectation,
      creativeControl: requestTerms.creativeControl, termWeeks,
      dateEntitlement: requestTerms.dateEntitlement,
      weeklyGuarantee: requestTerms.weeklyGuarantee,
      appearanceFee: requestTerms.appearanceFee,
      signingBonus: requestTerms.signingBonus,
    };
    const submitted = await submitAlphaTalentOffer(repository, worldId, playerId, request);
    const offer = (await repository.load(worldId)).state.contractOffers.find(o => o.id === submitted.offerId);
    if (!offer) throw new Error("pending paid-week offer was not saved");
    ok(offer.startDate.year === effectiveStart.year && offer.startDate.week === effectiveStart.week
      && offer.startDate.day === 1, "13-week offer begins in the already locked submission week");
    ok(offer.endDate.year === endDate.year && offer.endDate.week === endDate.week,
      "paid-week offer shortened its 13-week entitlement");
    ok(!submitted.view.roster.some(p => p.personId === chosen.entry.personId),
      "pending agreement granted player booking rights before acceptance");
    const afterSubmission = await loadAlphaPlayerSession(repository, worldId, playerId);
    const first = await advanceAlphaWorldWeek(repository, worldId, playerId, {
      expectedRevision: afterSubmission.world.revision,
    });
    const afterTick = await repository.load(worldId);
    const resolved = afterTick.state.contractOffers.find(o => o.id === submitted.offerId);
    ok(resolved?.status === "ACCEPTED",
      `paid-week offer was not accepted: ${resolved?.rejectionReason ?? "missing"}`);
    const signed = afterTick.state.contracts.find(c => c.sourceOfferId === submitted.offerId);
    if (!signed) throw new Error("accepted agreement did not create signed rights");
    ok(contractIsActive(afterTick.state, signed),
      "agreement is not active when first player-bookable week opens");
    ok(first.world.week === effectiveStart.week && first.world.year === effectiveStart.year,
      "World did not advance into the first paid booking week");
    ok(first.promotion?.roster.some(p => p.personId === signed.personId && p.datesRemaining > 0),
      "player cannot use the accepted contract in its first paid week");
    ok(!afterTick.state.financialTransactions.some(t => t.source === signed.id
      && t.category === "CONTRACT_GUARANTEE"),
      "player was charged weekly wages in the unbookable offer-resolution week");
    ok(contractCoversBookedDate(afterTick.state, signed, { ...endDate, day: 6 })
      && !contractCoversBookedDate(afterTick.state, signed,
        addPpwWeeks(endDate, 1, afterTick.state.ruleset.weeksPerYear)),
      "signed agreement does not cover exactly the promised 13 booking weeks");
    const retry = await submitAlphaTalentOffer(repository, worldId, playerId, request);
    ok(retry.offerId === submitted.offerId,
      "retry of accepted contract created another offer instead of replaying original receipt");

    await advanceAlphaWorldWeek(repository, worldId, playerId, {
      expectedRevision: first.world.revision,
    });
    const afterFirstPaidWeek = await repository.load(worldId);
    const guaranteeTransactions = afterFirstPaidWeek.state.financialTransactions.filter(t =>
      t.source === signed.id && t.category === "CONTRACT_GUARANTEE");
    ok(guaranteeTransactions.length === 1
      && guaranteeTransactions[0]!.amount === -request.weeklyGuarantee,
      "first bookable PPW week did not charge exactly one negotiated weekly guarantee");
  });
}

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

await test("a signed future renewal blocks repeat offers while keeping current contract dates unchanged", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73992, playerId: "player-a" });
  const promotion = aggregate.state.promotions.find((candidate) =>
    candidate.playerTakeoverEligibility === "STANDARD" && candidate.lifecycle === "ACTIVE");
  if (!promotion) throw new Error("fixture needs a promotion");
  const source = aggregate.state.contracts.find((contract) =>
    contract.promotionId === promotion.id && contract.status === "SIGNED" && contract.family !== "ONE_OFF");
  if (!source) throw new Error("fixture needs an active source contract");
  source.family = "LIMITED_NON_EXCLUSIVE";
  source.exclusivity = "NON_EXCLUSIVE";
  source.endDate = addPpwWeeks(aggregate.state.world.currentDate, 1, aggregate.state.ruleset.weeksPerYear);
  const nextStart = addPpwWeeks(source.endDate, 1, aggregate.state.ruleset.weeksPerYear);
  aggregate.state.contracts.push({
    ...structuredClone(source),
    id: "existing-future-signed-renewal",
    signedDate: { ...aggregate.state.world.currentDate },
    startDate: nextStart,
    endDate: addPpwWeeks(nextStart, 12, aggregate.state.ruleset.weeksPerYear),
    dateEntitlement: 9,
    datesUsed: 0,
  });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, "player-a", { promotionId: promotion.id, requestId: "claim-future-deal" });
  const roster = await loadAlphaTalentSession(repository, worldId, "player-a");
  const own = roster.roster.find((entry) => entry.personId === source.personId);
  ok(own?.scheduledRenewals?.length === 1 && own?.contract.renewalWindowOpen === false,
    "roster incorrectly offered a second renewal after signed future terms");
  let rejected = false;
  try {
    await submitAlphaTalentOffer(repository, worldId, "player-a", {
      requestId: "repeat-renewal-after-signature",
      personId: source.personId,
      sourceContractId: source.id,
      family: "LIMITED_NON_EXCLUSIVE",
      roleExpectation: source.roleExpectation,
      termWeeks: 13,
      dateEntitlement: 5,
      weeklyGuarantee: source.weeklyGuarantee,
      appearanceFee: source.appearanceFee,
      signingBonus: 0,
    });
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("already signed");
  }
  ok(rejected, "second overlapping renewal was accepted even though future signed contract exists");
  const persisted = await repository.load(worldId);
  ok(persisted.state.contracts.filter((contract) => contract.personId === source.personId
    && contract.promotionId === promotion.id && contract.status === "SIGNED").length === 2,
    "duplicate renewal attempt mutated the World contracts");
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
  const firstBookableWeek = addPpwWeeks(persisted.state.world.currentDate, 1, persisted.state.ruleset.weeksPerYear);
  ok(
    offer.startDate.year === firstBookableWeek.year
      && offer.startDate.week === firstBookableWeek.week
      && offer.startDate.day === 1,
    "exhausted-date replacement should begin in the first bookable paid PPW week",
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

declare const process: { exitCode?: number };

import {
  createPersistedApplicationWorld,
  restorePersistedApplicationWorld,
} from "../packages/application/src/world-aggregate.js";
import {
  createAlphaWorldAggregate, ensureAlphaWorld, alphaWorldId,
  claimAlphaPromotion, saveAlphaCurrentWeekShowPlan, advanceAlphaWorldWeek,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaCurrentWeekCard, saveAlphaCurrentWeekCard,
  type AlphaCardMatchView,
} from "../packages/web-adapter/src/card-service.js";
import {
  loadAlphaTalentSession, submitAlphaTalentOffer,
} from "../packages/web-adapter/src/talent-service.js";
import {
  loadAlphaStaff, hireAlphaTalentManager, authoriseAlphaTalentManagerRenewal,
} from "../packages/web-adapter/src/staff-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  createPersistedWorldState, validateWorldInvariants,
} from "../packages/sim-core/src/index.js";
import { buildPlayerAttention } from "../packages/application/src/attention.js";

let passed = 0; let failed = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}
function ok(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function rosterMatches(state: ReturnType<typeof createAlphaWorldAggregate>["state"],
  candidates: Array<{ personId: string }>, minimum: number, maximum: number): string[] {
  const division = new Map(state.people.map(person => [person.id, person.division ?? "MEN"]));
  const groups = ["MEN", "WOMEN"].map(group => candidates.filter(person => division.get(person.personId) === group));
  groups.sort((a,b)=>b.length-a.length);
  const required = minimum + (minimum % 2);
  const available = groups.find(group => group.length >= required);
  if (!available) throw new Error("Indie has insufficient same-division roster");
  let count = Math.min(maximum, available.length);
  count -= count % 2;
  return available.slice(0, count).map(person => person.personId);
}

await test("v9 saved player World migrates to staff schema without rewriting contracts, bookings, cash or ownership", async () => {
  const source = createAlphaWorldAggregate({ seed: 75201, playerId: "release-player" });
  const before = createPersistedApplicationWorld(source);
  const previousContracts = JSON.stringify(before.world.contracts);
  const previousCash = before.world.promotions.map(p => p.cash);
  const originalIdentity = before.world.world.id;
  const legacy = structuredClone(before) as unknown as {
    world: { stateSchemaVersion: number; staffMembers?: unknown; staffEmployments?: unknown };
  };
  legacy.world.stateSchemaVersion = 9;
  delete legacy.world.staffMembers;
  delete legacy.world.staffEmployments;
  const restored = restorePersistedApplicationWorld(legacy as Parameters<typeof restorePersistedApplicationWorld>[0]);
  ok(restored.state.world.id === originalIdentity, "migration changed World ID");
  ok(JSON.stringify(restored.state.contracts) === previousContracts,
    "migration rewrote live wrestler contracts or dates");
  ok(restored.state.promotions.every((p,i) => p.cash === previousCash[i]),
    "migration unexpectedly charged or subsidised the promotion");
  ok((restored.state.staffMembers?.length ?? 0) > 0 && restored.state.staffEmployments?.length === 0,
    "migration failed to seed uncontracted staff without automatically hiring");
  ok(restored.ownership.memberships.length === source.ownership.memberships.length,
    "migration lost World player membership");
  ok(restored.runtime.revision === source.runtime.revision,
    "migration advanced authoritative World time/revision");
  const resaved = createPersistedApplicationWorld(restored);
  ok(resaved.world.stateSchemaVersion === 10, "migration did not resave current staff schema");
  ok(JSON.stringify(createPersistedWorldState(
      restorePersistedApplicationWorld(resaved).state).staffEmployments) === "[]",
    "repeated v10 restore invented staff employment");
  ok(validateWorldInvariants(restored.state).length === 0, "migrated World is invalid");
});

await test("fresh playtest seed creates a separate World without deleting, mutating or resetting previous World", async () => {
  const repo = new InMemoryApplicationWorldRepository();
  const originalSeed = 75202;
  const nextSeed = 75203;
  const originalId = await ensureAlphaWorld(repo, {
    seed: originalSeed, playerId: "release-player", worldName: "Archived Alpha World",
  });
  const old = await repo.load(originalId);
  const oldContracts = JSON.stringify(old.state.contracts);
  const originalRevision = old.runtime.revision;
  const createdId = await ensureAlphaWorld(repo, {
    seed: nextSeed, playerId: "release-player", worldName: "New Alpha Playtest",
  });
  ok(originalId === alphaWorldId(originalSeed) && createdId === alphaWorldId(nextSeed)
    && originalId !== createdId, "separate playtest seeds selected the same World");
  const originalAfter = await repo.load(originalId);
  ok(JSON.stringify(originalAfter.state.contracts) === oldContracts
    && originalAfter.runtime.revision === originalRevision,
    "creating new seed modified historical World unexpectedly");
  const created = await repo.load(createdId);
  ok(created.state.world.currentDate.year === 1 && created.state.world.currentDate.week === 1,
    "newly initialised playtest did not start at Year 1 Week 1");
  ok(created.state.staffEmployments?.length === 0,
    "fresh playtest hired managers by default");
  await ensureAlphaWorld(repo, { seed: nextSeed, playerId: "release-player", worldName: "New Alpha Playtest" });
  const reopened = await repo.load(createdId);
  ok(reopened.runtime.revision === created.runtime.revision,
    "idempotent bootstrap reinitialised an existing World");
});

await test("player recruits, books real card, delegates renewal, then World resolves offers and show once", async () => {
  const playerId = "release-player";
  const aggregate = createAlphaWorldAggregate({ seed: 75204, playerId });
  const indie = aggregate.state.promotions.find(p =>
    p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  ok(indie, "no eligible Indie");
  const flagship = aggregate.state.showSeries?.find(series => series.promotionId === indie.id && series.role === "FLAGSHIP");
  ok(flagship, "no Indie flagship");
  flagship.cadenceWeeks = 1;
  flagship.anchorWeek = 0;

  // A real multiweek contract entering its final weeks; this is test fixture
  // setup only, not a backdated player operation or live migration.
  const source = aggregate.state.contracts.find(c =>
    c.promotionId === indie.id && c.status === "SIGNED" && c.family === "LIMITED_NON_EXCLUSIVE");
  ok(source, "no limited wrestler contract");
  source.startDate = { year: 1, week: 1, day: 1 };
  source.endDate = { year: 1, week: 13, day: 1 };
  source.dateEntitlement = 5;
  source.datesUsed = 0;
  source.weeklyGuarantee = 2200;
  source.appearanceFee = 4800;
  source.signingBonus = 50_000;
  source.creativeControl = "PROTECTED_FINISHES";
  aggregate.state.world.currentDate = { year: 1, week: 11, day: 1 };

  const repo = new InMemoryApplicationWorldRepository();
  await repo.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const claimed = await claimAlphaPromotion(repo, worldId, playerId, {
    promotionId: indie.id, requestId: "release-claim",
  });
  ok(claimed.promotion, "Indie claim returned no promotion");
  const firstMarket = claimed.promotion.showPlanning.markets[0];
  const venue = firstMarket?.venues[0];
  ok(firstMarket && venue, "no player event market");
  const participants = rosterMatches(aggregate.state,
    claimed.promotion.roster.filter(x => x.status === "ACTIVE" && x.datesRemaining > 0),
    claimed.promotion.showPlanning.minParticipants, claimed.promotion.showPlanning.maxParticipants);
  await saveAlphaCurrentWeekShowPlan(repo, worldId, playerId, {
    requestId: "release-plan",
    expectedRevision: claimed.world.revision,
    expectedPlanVersion: claimed.promotion.showPlanning.workspaceVersion,
    day: 6, marketId: firstMarket.marketId, venueId: venue.venueId,
    ticketStrategy: "STANDARD", participantIds: participants,
  });
  const card = await loadAlphaCurrentWeekCard(repo, worldId, playerId);
  ok(card.canEdit && participants.every(id => card.participants.some(p => p.personId === id)),
    "date-specific Show Card lost reserved wrestler availability");
  const matches: AlphaCardMatchView[] = [];
  for (let i = 0; i < participants.length; i += 2) {
    matches.push({
      draftMatchId: `audit-match-${i/2+1}`, type: "SINGLES",
      sideAIds: [participants[i]!], sideBIds: [participants[i+1]!],
      intendedWinnerSide: "A", intent: "COMPETITIVE", plannedLengthMinutes: 12,
    });
  }
  const saved = await saveAlphaCurrentWeekCard(repo, worldId, playerId, {
    requestId: "release-card",
    expectedRevision: card.world.revision,
    expectedPlanVersion: card.workspaceVersion,
    matches, championshipAssignments: [],
  });
  ok(saved.matches.length === matches.length, "saved player card lost matches");

  const staffBefore = await loadAlphaStaff(repo, worldId, playerId);
  const manager = staffBefore.availableManagers[0];
  ok(manager, "no free manager to hire");
  await hireAlphaTalentManager(repo, worldId, playerId, {
    requestId: "release-hire", staffId: manager.staffId,
  });
  const renewal = (await loadAlphaStaff(repo, worldId, playerId)).renewals.find(r => r.contractId === source.id);
  ok(renewal, "eligible existing wrestler not proposed for renewal");
  ok(renewal.weeklyGuarantee === 2200 && renewal.appearanceFee === 4800,
    "renewal workspace changed continuing compensation");
  const delegated = await authoriseAlphaTalentManagerRenewal(repo, worldId, playerId, {
    requestId: "release-delegate", sourceContractId: source.id,
  });
  ok(delegated.offerId, "manager failed to submit an authorised offer");

  const talent = await loadAlphaTalentSession(repo, worldId, playerId);
  const freeAgent = talent.market.find(candidate =>
    candidate.availability === "FREE_AGENT" && !candidate.hasOurPendingOffer);
  ok(freeAgent, "no free agent for player-controlled initial signing");
  const recruitment = await submitAlphaTalentOffer(repo, worldId, playerId, {
    requestId: "release-recruit", personId: freeAgent.personId, sourceContractId: null,
    family: "LIMITED_NON_EXCLUSIVE", roleExpectation: "REGULAR", creativeControl: "NONE",
    termWeeks: 13, dateEntitlement: 3,
    weeklyGuarantee: Math.round(freeAgent.estimatedWeeklyValue * 0.2),
    appearanceFee: freeAgent.estimatedWeeklyValue, signingBonus: 0,
  });
  ok(recruitment.offerKind === "RECRUITMENT", "staff recruitment superseded player signing control");

  const beforeResolve = await repo.load(worldId);
  const pending = [delegated.offerId, recruitment.offerId];
  ok(pending.every(id => beforeResolve.state.contractOffers.some(o => o.id === id && o.status === "PENDING")),
    "simultaneous player recruitment and staff renewal did not queue normally");
  const progressed = await advanceAlphaWorldWeek(repo, worldId, playerId, {
    expectedRevision: beforeResolve.runtime.revision,
  });
  const after = await repo.load(worldId);
  ok(progressed.promotion?.lastResolvedShow?.matchCount === matches.length,
    "World Lock did not resolve the fully authored player show");
  ok(pending.every(id => {
    const status = after.state.contractOffers.find(o => o.id === id)?.status;
    return status === "ACCEPTED" || status === "REJECTED";
  }), "recruitment or delegated renewal bypassed standard wrestler accept/reject resolution");
  ok(after.state.financialTransactions.some(tx => tx.category === "STAFF_SALARY"),
    "manager was not paid during canonical World resolution");
  ok(after.commands.receipts.filter(receipt => receipt.requestId === "release-delegate").length === 1,
    "manager authorisation was duplicated through the World Tick");
  const attention = buildPlayerAttention(after, playerId);
  ok(attention.some(item => item.attentionId === `contract-offer-result:${delegated.offerId}`
    && item.deepLink === `/talent/contracts?personId=${encodeURIComponent(source.personId)}`),
    "manager's resolution result not exposed through the correct attention deep link");
  ok(validateWorldInvariants(after.state).length === 0,
    "World broken after booking, recruitment and delegated renewal resolved");
});

console.log(`\nRelease readiness: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

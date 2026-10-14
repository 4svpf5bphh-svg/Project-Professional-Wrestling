declare const process: { exitCode?: number };
import {
  createAlphaWorldAggregate, claimAlphaPromotion,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaStaff, hireAlphaTalentManager, releaseAlphaTalentManager,
  authoriseAlphaTalentManagerRenewal, authoriseAlphaTalentManagerDatesAddendum,
} from "../packages/web-adapter/src/staff-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { joinPlayerToWorld } from "../packages/application/src/ownership.js";
import { buildPlayerAttention } from "../packages/application/src/attention.js";
import { addPpwWeeks } from "../packages/sim-core/src/clock.js";
import { canAddLimitedContractDates } from "../packages/sim-core/src/contracts.js";

let passed = 0, failed = 0;
async function test(name: string, run: () => Promise<void>): Promise<void> {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`); }
}
function ok(condition: unknown, msg: string): void { if (!condition) throw Error(msg); }
async function rejects(task: () => Promise<unknown>, expected: string): Promise<void> {
  let error = "";
  try { await task(); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  ok(error.includes(expected), `expected "${expected}", got "${error}"`);
}
async function fixture(seed: number) {
  const aggregate = createAlphaWorldAggregate({ seed, playerId: "player-a" });
  const candidates = aggregate.state.promotions.filter(p => p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (candidates.length < 2) throw Error("fixture needs two promotions");
  aggregate.ownership.humanSeatLimit = 2;
  joinPlayerToWorld(aggregate.ownership, "player-b", aggregate.state.world.currentDate);
  const repo = new InMemoryApplicationWorldRepository();
  await repo.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repo, worldId, "player-a", { promotionId: candidates[0]!.id, requestId: `staff-claim-a-${seed}` });
  await claimAlphaPromotion(repo, worldId, "player-b", { promotionId: candidates[1]!.id, requestId: `staff-claim-b-${seed}` });
  return { repo, worldId, a: candidates[0]!.id, b: candidates[1]!.id };
}

await test("two players compete for a single World-unique manager, and retries do not double hire", async () => {
  const { repo, worldId } = await fixture(73550);
  const beforeA = await loadAlphaStaff(repo, worldId, "player-a");
  const beforeB = await loadAlphaStaff(repo, worldId, "player-b");
  const manager = beforeA.availableManagers[0]!;
  ok(manager && beforeB.availableManagers.some(m => m.staffId === manager.staffId),
    "manager not visible to both players before hire");
  const first = await hireAlphaTalentManager(repo, worldId, "player-a", {
    requestId: "hire-manager-a", staffId: manager.staffId,
  });
  ok(first.view.talentManager?.staffId === manager.staffId, "hire did not persist");
  const afterHire = await repo.load(worldId);
  const revision = afterHire.runtime.revision;
  const retry = await hireAlphaTalentManager(repo, worldId, "player-a", {
    requestId: "hire-manager-a", staffId: manager.staffId,
  });
  ok(retry.view.talentManager?.staffId === manager.staffId, "idempotent hire retry lost staff");
  ok((await repo.load(worldId)).runtime.revision === revision, "duplicate hire advanced World revision");
  await rejects(() => hireAlphaTalentManager(repo, worldId, "player-b", {
    requestId: "hire-manager-b", staffId: manager.staffId,
  }), "already works");
  ok(!(await loadAlphaStaff(repo, worldId, "player-b")).availableManagers.some(m => m.staffId === manager.staffId),
    "rival manager is still offered as available");
  await rejects(() => releaseAlphaTalentManager(repo, worldId, "player-b", {
    requestId: "rival-release", employmentId: first.view.talentManager!.employmentId,
  }), "no active staff employment");
  const released = await releaseAlphaTalentManager(repo, worldId, "player-a", {
    requestId: "release-manager-a", employmentId: first.view.talentManager!.employmentId,
  });
  ok(!released.view.talentManager, "manager was not released");
  const rehired = await hireAlphaTalentManager(repo, worldId, "player-b", {
    requestId: "hire-manager-b-after-release", staffId: manager.staffId,
  });
  ok(rehired.view.talentManager?.staffId === manager.staffId, "released manager was not returned to shared market");
});

await test("delegate requires an employed manager and preserves exact money, role and wrestler consent", async () => {
  const aggregate = createAlphaWorldAggregate({ seed: 73551, playerId: "player-a" });
  const indie = aggregate.state.promotions.find(p => p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!indie) throw Error("no Indie");
  const source = aggregate.state.contracts.find(c => c.promotionId === indie.id && c.family === "LIMITED_NON_EXCLUSIVE" && c.status === "SIGNED");
  if (!source) throw Error("no limited current contract");
  source.startDate = { year: 1, week: 1, day: 1 };
  source.endDate = addPpwWeeks(source.startDate, 12, aggregate.state.ruleset.weeksPerYear);
  source.dateEntitlement = 5; source.datesUsed = 0;
  source.weeklyGuarantee = 2500; source.appearanceFee = 5500; source.signingBonus = 75_000;
  source.creativeControl = "PROTECTED_FINISHES";
  aggregate.state.world.currentDate = { year: 1, week: 11, day: 1 };
  const repo = new InMemoryApplicationWorldRepository();
  await repo.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repo, worldId, "player-a", { promotionId: indie.id, requestId: "staff-claim-renewal" });
  await rejects(() => authoriseAlphaTalentManagerRenewal(repo, worldId, "player-a", {
    requestId: "no-manager", sourceContractId: source.id,
  }), "hire a Talent Manager");
  const available = await loadAlphaStaff(repo, worldId, "player-a");
  const manager = available.availableManagers[0]!;
  await hireAlphaTalentManager(repo, worldId, "player-a", { requestId: "hire-delegation", staffId: manager.staffId });
  const proposals = await loadAlphaStaff(repo, worldId, "player-a");
  ok(proposals.renewals.some(r => r.contractId === source.id), "renewal was not shown to manager");
  const submitted = await authoriseAlphaTalentManagerRenewal(repo, worldId, "player-a", {
    requestId: "delegate-same-terms", sourceContractId: source.id,
  });
  ok(!!submitted.offerId, "authorisation did not create a wrestler offer");
  const stored = await repo.load(worldId);
  const offer = stored.state.contractOffers.find(o => o.id === submitted.offerId)!;
  ok(offer?.offerKind === "RENEWAL" && offer.sourceContractId === source.id && offer.status === "PENDING",
    "delegated renewal did not enter normal wrestler negotiation queue");
  ok(offer.signingBonus === 0 && offer.weeklyGuarantee === 2500 && offer.appearanceFee === 5500,
    "manager changed original recurring terms or repeated historic signing bonus");
  ok(offer.creativeControl === "PROTECTED_FINISHES" && offer.dateEntitlement === 5,
    "manager silently changed protected creative rights or purchased dates");
  const receipts = stored.commands.receipts.filter(r => r.commandType === "AUTHORISE_TALENT_MANAGER_RENEWAL");
  ok(receipts.length === 1 && receipts[0]!.playerId === "player-a",
    "player authorisation provenance was not persisted");
  const retry = await authoriseAlphaTalentManagerRenewal(repo, worldId, "player-a", {
    requestId: "delegate-same-terms", sourceContractId: source.id,
  });
  ok(retry.offerId === submitted.offerId, "retry offered wrestler a second agreement");
  await rejects(() => authoriseAlphaTalentManagerRenewal(repo, worldId, "player-a", {
    requestId: "delegate-again", sourceContractId: source.id,
  }), "pending offer");
  // Simulate a rejected standard resolver result to test staff outcome routing;
  // never claim that a real multiweek World resolution ran here.
  await repo.transact(worldId, null, current => {
    const pending = current.state.contractOffers.find(row => row.id === submitted.offerId);
    if (!pending) throw new Error("missing staff proposal");
    pending.status = "REJECTED";
    pending.rejectionReason = "offer utility below acceptance threshold";
    current.runtime.lastResolvedPpwDate = { ...current.state.world.currentDate };
  });
  const attention = buildPlayerAttention(await repo.load(worldId), "player-a");
  const outcome = attention.find(item => item.attentionId === `contract-offer-result:${submitted.offerId}`);
  ok(outcome?.deepLink === "/staff" && outcome.title.includes("Talent Manager"),
    "manager refusal did not return to staff context");
  ok(outcome?.summary.includes("negotiate different terms manually"),
    "manager rejection hid the need for player negotiation");
});


await test("bounded staff addendum uses standard consent, pending offer and idempotent command", async () => {
  const aggregate = createAlphaWorldAggregate({ seed: 73042, playerId: "player-a" });
  const indie = aggregate.state.promotions.find(p => p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!indie) throw Error("no eligible promotion");
  const source = aggregate.state.contracts.find(contract => {
    if (contract.promotionId !== indie.id || contract.family !== "LIMITED_NON_EXCLUSIVE" || contract.status !== "SIGNED") return false;
    const person = aggregate.state.people.find(candidate => candidate.id === contract.personId);
    return person && canAddLimitedContractDates(aggregate.state, person, contract, 1).ok;
  });
  if (!source) throw Error("no amendable contract");
  indie.cash = Math.max(indie.cash, 500_000);
  const repo = new InMemoryApplicationWorldRepository();
  await repo.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repo, worldId, "player-a", { promotionId: indie.id, requestId: "staff-claim-dates" });
  const request = { requestId: "staff-extra-dates-1", sourceContractId: source.id, additionalDates: 1, additionalPayment: 20_000 };
  await rejects(() => authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a", request), "hire a Talent Manager");
  const before = await loadAlphaStaff(repo, worldId, "player-a");
  await hireAlphaTalentManager(repo, worldId, "player-a",
    { requestId: "staff-hire-dates", staffId: before.availableManagers[0]!.staffId });
  const eligible = (await loadAlphaStaff(repo, worldId, "player-a")).dateAddendums;
  ok(eligible.some(entry => entry.contractId === source.id && entry.maxAdditionalDates >= 1),
    "valid addendum is not offered on Staff screen");
  await rejects(() => authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a",
    { ...request, requestId: "too-many-staff-dates", additionalDates: 5 }), "between 1 and 4");
  await rejects(() => authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a",
    { ...request, requestId: "too-much-staff-payment", additionalPayment: 250_001 }), "between 0 and 250000");
  const first = await authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a", request);
  const after = await repo.load(worldId);
  const pending = after.state.contractOffers.find(offer => offer.id === first.offerId);
  ok(pending?.offerKind === "DATES_ADDENDUM" && pending.status === "PENDING"
    && pending.sourceContractId === source.id && pending.signingBonus === request.additionalPayment,
    "not a standard pending wrestler-consent proposal");
  ok(pending.dateEntitlement === source.dateEntitlement + 1,
    "staff changed date entitlement beyond player permission");
  ok(after.state.contracts.find(contract => contract.id === source.id)?.dateEntitlement === source.dateEntitlement,
    "staff mutated signed contract before wrestler acceptance");
  ok(after.commands.receipts.some(receipt =>
    receipt.requestId === request.requestId && receipt.playerId === "player-a"
    && receipt.commandType === "SUBMIT_CONTRACT_DATES_ADDENDUM"),
    "standard authoritative command provenance missing");
  ok(!first.view.dateAddendums.some(entry => entry.contractId === source.id),
    "ineligible pending wrestler still offered on Staff screen");
  const revision = after.runtime.revision;
  const replay = await authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a", request);
  ok(replay.offerId === first.offerId && (await repo.load(worldId)).runtime.revision === revision,
    "retry duplicated offer or advanced World");
  await rejects(() => authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a",
    { ...request, additionalPayment: 21_000 }), "different additional-date terms");
  await rejects(() => authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a",
    { ...request, requestId: "duplicate-staff-addendum" }), "not eligible");
});

await test("staff may not authorise additional-dates payment beyond available cash", async () => {
  const aggregate = createAlphaWorldAggregate({ seed: 73042, playerId: "player-a" });
  const indie = aggregate.state.promotions.find(p => p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!indie) throw Error("no eligible promotion");
  const source = aggregate.state.contracts.find(contract => {
    if (contract.promotionId !== indie.id || contract.family !== "LIMITED_NON_EXCLUSIVE" || contract.status !== "SIGNED") return false;
    const person = aggregate.state.people.find(candidate => candidate.id === contract.personId);
    return person && canAddLimitedContractDates(aggregate.state, person, contract, 1).ok;
  });
  if (!source) throw Error("no amendable contract");
  const repo = new InMemoryApplicationWorldRepository();
  await repo.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repo, worldId, "player-a", { promotionId: indie.id, requestId: "staff-claim-low-cash" });
  const available = await loadAlphaStaff(repo, worldId, "player-a");
  await hireAlphaTalentManager(repo, worldId, "player-a",
    { requestId: "staff-hire-low-cash", staffId: available.availableManagers[0]!.staffId });
  await repo.transact(worldId, null, current => {
    current.state.promotions.find(p => p.id === indie.id)!.cash = 500;
  });
  await rejects(() => authoriseAlphaTalentManagerDatesAddendum(repo, worldId, "player-a", {
    requestId: "staff-unaffordable", sourceContractId: source.id, additionalDates: 1, additionalPayment: 501,
  }), "available cash");
});
console.log(`\nWeb staff service tests: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;

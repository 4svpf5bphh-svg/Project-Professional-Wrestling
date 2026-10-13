declare const process: { exitCode?: number };

import { claimAlphaPromotion, createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { loadAlphaStableRoster, mutateAlphaStable } from "../packages/web-adapter/src/stable-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";

let passed = 0;
let failed = 0;
async function test(name: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`, error instanceof Error ? error.message : String(error));
  }
}
function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}
async function rejects(work: () => Promise<unknown>, fragment: string): Promise<void> {
  let thrown: unknown = null;
  try { await work(); } catch (error) { thrown = error; }
  ok(String(thrown).includes(fragment), `expected rejection containing "${fragment}", received ${String(thrown)}`);
}

async function fixture(seed: number) {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed, playerId: "player-a" });
  const worldId = aggregate.state.world.id;
  await repository.initialize(aggregate);
  const promotion = aggregate.state.promotions.find((candidate) => (
    candidate.playerTakeoverEligibility === "STANDARD" && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("stable fixture has no eligible promotion");
  await claimAlphaPromotion(repository, worldId, "player-a", {
    promotionId: promotion.id, requestId: "claim-stable-promotion",
  });
  const view = await loadAlphaStableRoster(repository, worldId, "player-a");
  ok(view.roster.length >= 5, "stable fixture needs five contracted wrestlers");
  return { repository, worldId, view };
}

await test("Stable commands create historical World membership, permit edits and disband without simulation bonuses", async () => {
  const { repository, worldId, view } = await fixture(73341);
  const ids = view.roster.slice(0, 5).map((person) => person.personId);
  const before = await repository.load(worldId);
  const contractsBefore = before.state.contracts.length;
  const chemistryBefore = before.state.workingChemistry.length;
  const ledgerBefore = before.state.ledger.length;

  const created = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "stable-create", expectedRevision: view.world.revision,
    name: "World Test Stable", personIds: ids.slice(0, 3),
  });
  const stable = created.stables.find((entry) => entry.name === "World Test Stable")!;
  ok(stable && stable.currentMembers.length === 3, "stable identity or members were not persisted");
  ok(created.roster.filter((p) => p.stableId === stable.stableId).length === 3,
    "roster projection did not assign the wrestlers");
  const retry = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "stable-create", expectedRevision: view.world.revision,
    name: "World Test Stable", personIds: ids.slice(0, 3),
  });
  ok(retry.world.revision === created.world.revision && retry.stables.length === created.stables.length,
    "replayed creation changed World revision or duplicated stable");

  await rejects(() => mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "duplicate-stable-name", expectedRevision: created.world.revision,
    name: "world test stable", personIds: [ids[0]!, ids[1]!, ids[3]!],
  }), "already has that name");
  await rejects(() => mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "stable-too-small", expectedRevision: created.world.revision,
    name: "Two Wrestlers", personIds: ids.slice(3, 5),
  }), "3–12 distinct wrestlers");
  await rejects(() => mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "stable-overlapping", expectedRevision: created.world.revision,
    name: "Second Stable", personIds: [ids[0]!, ids[3]!, ids[4]!],
  }), "already belongs to an active stable");
  await rejects(() => mutateAlphaStable(repository, worldId, "player-b", {
    action: "ADD", requestId: "not-owner", expectedRevision: created.world.revision,
    stableId: stable.stableId, personId: ids[3]!,
  }), "Take control of a promotion");
  await rejects(() => mutateAlphaStable(repository, worldId, "player-a", {
    action: "ADD", requestId: "stale-client", expectedRevision: view.world.revision,
    stableId: stable.stableId, personId: ids[3]!,
  }), "stale World revision");

  const added = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "ADD", requestId: "join", expectedRevision: created.world.revision,
    stableId: stable.stableId, personId: ids[3]!,
  });
  ok(added.stables[0]?.currentMembers.length === 4, "joining wrestler did not appear");
  const removed = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "REMOVE", requestId: "leave", expectedRevision: added.world.revision,
    stableId: stable.stableId, personId: ids[3]!,
  });
  const record = removed.stables[0]!.memberHistory.find((member) => member.personId === ids[3]);
  ok(record?.active === false && record.leftDate !== null, "member departure erased history");
  ok(removed.stables[0]?.currentMembers.length === 3, "removed member stayed active");

  const disbanded = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "DISBAND", requestId: "disband", expectedRevision: removed.world.revision,
    stableId: stable.stableId,
  });
  const archived = disbanded.stables[0]!;
  ok(archived.status === "DISBANDED" && archived.disbandedDate !== null
    && archived.currentMembers.length === 0 && archived.memberHistory.length === 4,
    "disband destroyed history or left current members");
  ok(disbanded.roster.every((p) => p.stableId === null), "disband kept roster members locked in group");
  const after = await repository.load(worldId);
  ok(after.state.contracts.length === contractsBefore, "stable actions manufactured contracts");
  ok(after.state.workingChemistry.length === chemistryBefore, "stable actions manufactured chemistry");
  ok(after.state.ledger.length >= ledgerBefore + 4, "stable actions did not write immutable history");
  ok((after.state.stables ?? []).length === 1 && (after.state.stableMemberships ?? []).length === 4,
    "stable state did not survive persistence");
});

await test("Completed stable story creates an owner-only follow-through choice; membership changes only on explicit command", async () => {
  const { repository, worldId, view } = await fixture(73343);
  const wrestlers = view.roster.slice(0, 5).map((person) => person.personId);
  const created = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "story-stable-formed",
    expectedRevision: view.world.revision, name: "The Spotlight",
    personIds: wrestlers.slice(0, 3),
  });
  const stable = created.stables.find((entry) => entry.name === "The Spotlight")!;
  const proposed = wrestlers[3]!;
  const invitationEvent = "story-show-completed";
  await repository.transact(worldId, null, (aggregate) => {
    const state = aggregate.state;
    const market = state.markets.find((entry) => entry.id === state.promotions.find(
      (entry) => entry.id === created.player.promotionId)?.homeMarketId) ?? state.markets[0]!;
    const venue = state.venues.find((entry) => entry.marketId === market.id) ?? state.venues[0]!;
    state.events.push({
      id: invitationEvent, worldId: state.world.id,
      promotionId: created.player.promotionId!, marketId: market.id, venueId: venue.id,
      date: { ...state.world.currentDate }, type: "REGULAR", status: "COMPLETED",
      ticketStrategy: "STANDARD", expectedDemand: 100, attendance: 100,
      ticketYield: 25, gateRevenue: 2500, totalCost: 2000, netResult: 500,
      eventImportance: 60, matchCount: 0, averageMatchRating: 0, bestMatchRating: 0,
      crowdResponse: 65,
    });
    state.ledger.push({
      id: "completed-stable-invitation", worldId: state.world.id, date: { ...state.world.currentDate },
      order: 16001, type: "SHOW_SEGMENT_COMPLETED",
      significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
      entityIds: [invitationEvent, stable.stableId, proposed],
      payload: {
        eventId: invitationEvent, promotionId: created.player.promotionId!,
        stableId: stable.stableId, targetPersonId: proposed,
        segmentType: "STABLE_INVITATION", stableInvitationOutcome: "ACCEPTED",
      },
    });
  });
  const pending = await loadAlphaStableRoster(repository, worldId, "player-a");
  ok(pending.storyFollowThrough.length === 1, "completed accepted invitation was not surfaced to its owner");
  ok(pending.storyFollowThrough[0]?.action === "ADD"
    && pending.storyFollowThrough[0]?.status === "READY"
    && pending.storyFollowThrough[0]?.personId === proposed,
    "follow-through did not identify the correct wrestler or canonical action");
  ok(pending.stables.find((entry) => entry.stableId === stable.stableId)?.currentMembers.length === 3,
    "the scripted acceptance silently created actual stable membership");
  const accepted = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "ADD", stableId: stable.stableId, personId: proposed,
    requestId: "player-confirms-televised-invitation", expectedRevision: pending.world.revision,
  });
  ok(accepted.storyFollowThrough.length === 0, "confirmed membership still appeared as an unresolved story");
  ok(accepted.stables.find((entry) => entry.stableId === stable.stableId)?.currentMembers.length === 4,
    "explicit confirmation didn't add the real wrestler");

  await repository.transact(worldId, null, (aggregate) => {
    aggregate.state.ledger.push({
      id: "completed-stable-exit", worldId: aggregate.state.world.id,
      date: { ...aggregate.state.world.currentDate }, order: 16002,
      type: "SHOW_SEGMENT_COMPLETED",
      significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
      entityIds: [invitationEvent, stable.stableId, proposed],
      payload: {
        eventId: invitationEvent, promotionId: created.player.promotionId!,
        stableId: stable.stableId, targetPersonId: proposed,
        segmentType: "STABLE_EXIT", stableExitOutcome: "EXPELLED",
      },
    });
  });
  const exit = await loadAlphaStableRoster(repository, worldId, "player-a");
  ok(exit.storyFollowThrough.length === 1
    && exit.storyFollowThrough[0]?.action === "REMOVE"
    && exit.storyFollowThrough[0]?.sourceSegmentId === "completed-stable-exit",
    "latest completed expulsion didn't supersede the prior membership story");
  ok(exit.roster.find((person) => person.personId === proposed)?.stableId === stable.stableId,
    "scripted expulsion removed a real roster member before player confirmation");
  const removed = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "REMOVE", stableId: stable.stableId, personId: proposed,
    requestId: "player-confirms-televised-exit", expectedRevision: exit.world.revision,
  });
  ok(removed.storyFollowThrough.length === 0
    && removed.roster.find((person) => person.personId === proposed)?.stableId === null,
    "explicit departure left roster and storyline inconsistent");
  ok(removed.stables[0]!.memberHistory.find((entry) => entry.personId === proposed)?.leftDate !== null,
    "explicit departure did not create permanent historical membership evidence");
});

await test("A later refusal cancels the earlier story task; drafts and unperformed events do not create follow-through", async () => {
  const { repository, worldId, view } = await fixture(73344);
  const members = view.roster.slice(0, 3).map((person) => person.personId);
  const recruit = view.roster[3]!.personId;
  const made = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "cancel-stable-formed",
    expectedRevision: view.world.revision, name: "The Reversal",
    personIds: members,
  });
  const stableId = made.stables[0]!.stableId;
  await repository.transact(worldId, null, (aggregate) => {
    const state = aggregate.state;
    const market = state.markets[0]!;
    const venue = state.venues.find((entry) => entry.marketId === market.id) ?? state.venues[0]!;
    state.events.push({
      id: "refusal-show", worldId, promotionId: made.player.promotionId!,
      marketId: market.id, venueId: venue.id, date: { ...state.world.currentDate },
      type: "REGULAR", status: "COMPLETED", ticketStrategy: "STANDARD",
      expectedDemand: 100, attendance: 100, ticketYield: 25,
      gateRevenue: 2500, totalCost: 2000, netResult: 500,
      eventImportance: 60, matchCount: 0, averageMatchRating: 0, bestMatchRating: 0, crowdResponse: 65,
    });
    for (const [id, order, outcome, eventId] of [
      ["accepted-then-superseded", 10001, "ACCEPTED", "refusal-show"],
      ["latest-refusal", 10002, "REFUSED", "refusal-show"],
      ["unperformed-offer", 10003, "ACCEPTED", "not-an-actual-show"],
    ] as const) state.ledger.push({
      id, worldId, date: { ...state.world.currentDate },
      order, type: "SHOW_SEGMENT_COMPLETED",
      significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
      entityIds: [stableId, recruit],
      payload: {
        eventId, promotionId: made.player.promotionId!, stableId, targetPersonId: recruit,
        segmentType: "STABLE_INVITATION", stableInvitationOutcome: outcome,
      },
    });
  });
  const projection = await loadAlphaStableRoster(repository, worldId, "player-a");
  ok(projection.storyFollowThrough.length === 0,
    "unperformed or subsequently refused invitation created a pending membership task");
  ok(projection.roster.find((person) => person.personId === recruit)?.stableId === null,
    "fictional acceptance mutated real membership");
});

await test("Completed stable reunion stays kayfabe until a player explicitly re-adds the former member", async () => {
  const { repository, worldId, view } = await fixture(73345);
  const ids = view.roster.slice(0, 3).map((entry) => entry.personId);
  const created = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "reunion-create", expectedRevision: view.world.revision,
    name: "The Reunion", personIds: ids,
  });
  const stableId = created.stables[0]!.stableId;
  const departed = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "REMOVE", requestId: "reunion-history", expectedRevision: created.world.revision,
    stableId, personId: ids[2]!,
  });
  ok(departed.stables[0]!.memberHistory.find((entry) => entry.personId === ids[2])?.active === false,
    "real former membership history was not created");
  await repository.transact(worldId, null, (aggregate) => {
    const state = aggregate.state;
    const market = state.markets[0]!;
    const venue = state.venues.find((entry) => entry.marketId === market.id) ?? state.venues[0]!;
    state.events.push({
      id: "reunion-completed-show", worldId, promotionId: departed.player.promotionId!,
      marketId: market.id, venueId: venue.id,
      date: { ...state.world.currentDate },
      type: "REGULAR", status: "COMPLETED", ticketStrategy: "STANDARD",
      expectedDemand: 100, attendance: 100, ticketYield: 25,
      gateRevenue: 2500, totalCost: 2000, netResult: 500,
      eventImportance: 60, matchCount: 0, averageMatchRating: 0, bestMatchRating: 0,
      crowdResponse: 65,
    });
    state.ledger.push({
      id: "reconciled-former-member", worldId, date: { ...state.world.currentDate },
      order: 19005, type: "SHOW_SEGMENT_COMPLETED",
      significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
      entityIds: [stableId, ids[2]!],
      payload: {
        eventId: "reunion-completed-show", promotionId: departed.player.promotionId!,
        stableId, targetPersonId: ids[2],
        segmentType: "STABLE_RECONCILIATION",
        stableReconciliationOutcome: "RECONCILED",
      },
    });
  });
  const pending = await loadAlphaStableRoster(repository, worldId, "player-a");
  ok(pending.storyFollowThrough.length === 1
    && pending.storyFollowThrough[0]?.action === "ADD"
    && pending.storyFollowThrough[0]?.storyType === "STABLE_RECONCILIATION",
    "performed reconciliation did not offer an explicit rejoin action");
  ok(pending.stables[0]!.currentMembers.length === 2,
    "on-screen reconciliation silently reinstated a member");
  const accepted = await mutateAlphaStable(repository, worldId, "player-a", {
    action: "ADD", requestId: "reunion-rejoin", expectedRevision: pending.world.revision,
    stableId, personId: ids[2]!,
  });
  ok(accepted.storyFollowThrough.length === 0
    && accepted.stables[0]!.currentMembers.length === 3,
    "booker-approved reunion did not reconcile canonical membership");
  ok(accepted.stables[0]!.memberHistory.filter((entry) => entry.personId === ids[2]).length === 2,
    "real rejoining should create another historical membership record, not rewrite the old one");
});

await test("World Lock rejects stable membership changes, even by the controlling booker", async () => {
  const { repository, worldId, view } = await fixture(73342);
  await repository.transact(worldId, null, (aggregate) => { aggregate.runtime.phase = "LOCKING"; });
  await rejects(() => mutateAlphaStable(repository, worldId, "player-a", {
    action: "CREATE", requestId: "locked-create", expectedRevision: view.world.revision,
    name: "This Must Not Exist", personIds: view.roster.slice(0, 3).map((p) => p.personId),
  }), "locking and cannot accept player mutations");
  const state = await repository.load(worldId);
  ok((state.state.stables ?? []).length === 0, "locked world permitted stable creation");
});

console.log(`\nStable-service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

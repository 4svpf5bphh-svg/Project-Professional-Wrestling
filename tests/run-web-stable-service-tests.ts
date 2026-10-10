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

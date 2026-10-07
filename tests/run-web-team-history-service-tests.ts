declare const process: { exitCode?: number };

import { claimAlphaPromotion, createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import {
  createAlphaTagTeam,
  loadAlphaTeamHistory,
} from "../packages/web-adapter/src/team-history-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";

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

await test("Team-history service loads the public team projection through the repository boundary", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73311, playerId: "player-a" });
  await repository.initialize(aggregate);
  const view = await loadAlphaTeamHistory(repository, aggregate.state.world.id, "player-a");
  ok(Array.isArray(view.teams), "service did not return a team collection");
  ok(view.world.worldId === aggregate.state.world.id, "service returned wrong World");
  ok(view.player.playerId === "player-a", "service returned wrong player context");
});

await test("Team-history service creates a named team without granting free experience", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73312, playerId: "player-a" });
  await repository.initialize(aggregate);
  const promotion = aggregate.state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE");
  if (!promotion) throw new Error("team-create fixture has no Independent promotion");
  await claimAlphaPromotion(repository, aggregate.state.world.id, "player-a", {
    promotionId: promotion.id,
    requestId: "team-create-claim",
  });
  const before = await repository.load(aggregate.state.world.id);
  const roster = before.state.contracts
    .filter((contract) => contract.promotionId === promotion.id && contract.status === "SIGNED")
    .map((contract) => contract.personId)
    .filter((personId, index, all) => all.indexOf(personId) === index);
  ok(roster.length >= 2, "team-create fixture has fewer than two roster wrestlers");
  const chemistryBefore = before.state.workingChemistry.length;

  const created = await createAlphaTagTeam(repository, aggregate.state.world.id, "player-a", {
    requestId: "team-create-001",
    expectedRevision: before.runtime.revision,
    name: "Service Test Team",
    personIds: [roster[0]!, roster[1]!],
  });
  const team = created.teams.find((candidate) => candidate.name === "Service Test Team");
  ok(team, "created team missing from returned team view");
  ok(team!.currentMembers.length === 2, "created team lost a member");
  ok(team!.experience?.band === "UNTESTED" && team!.experience.matchesTogether === 0, "new team received free experience");

  const after = await repository.load(aggregate.state.world.id);
  ok(after.state.workingChemistry.length === chemistryBefore, "service team creation manufactured chemistry");
  const retry = await createAlphaTagTeam(repository, aggregate.state.world.id, "player-a", {
    requestId: "team-create-001",
    expectedRevision: before.runtime.revision,
    name: "Service Test Team",
    personIds: [roster[0]!, roster[1]!],
  });
  ok(retry.world.revision === created.world.revision, "idempotent team retry advanced revision");
});

console.log(`\nWeb team-history-service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

declare const process: { exitCode?: number };

import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  claimAlphaPromotion,
  createAlphaWorldAggregate,
  saveAlphaCurrentWeekShowPlan,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaProgrammeContext,
  setAlphaProgrammeSegment,
  startAlphaProgramme,
} from "../packages/web-adapter/src/programme-service.js";
import {
  loadAlphaProgrammeManagement,
  startAlphaManagedProgramme,
} from "../packages/web-adapter/src/programme-management-service.js";

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

async function reservedShowFixture(seed: number) {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed, playerId: "alpha-player" });
  const independent = aggregate.state.promotions.find((promotion) => (
    promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE"
  ));
  if (!independent) throw new Error("test World has no active Independent promotion");
  independent.eventCadenceWeeks = 1;
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  const claimed = await claimAlphaPromotion(repository, worldId, "alpha-player", {
    promotionId: independent.id,
    requestId: `programme-claim-${seed}`,
  });
  const promotion = claimed.promotion;
  if (!promotion) throw new Error("claim did not expose controlled promotion");
  const market = promotion.showPlanning.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("show planner has no market/venue option");

  let participantIds = promotion.roster
    .filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0)
    .slice(0, Math.min(promotion.showPlanning.maxParticipants, Math.max(promotion.showPlanning.minParticipants, 4)))
    .map((person) => person.personId);
  if (participantIds.length % 2 !== 0) participantIds = participantIds.slice(0, -1);
  if (participantIds.length < promotion.showPlanning.minParticipants) {
    throw new Error("show planner has too few available wrestlers");
  }

  const planned = await saveAlphaCurrentWeekShowPlan(repository, worldId, "alpha-player", {
    requestId: `programme-show-${seed}`,
    expectedRevision: claimed.world.revision,
    expectedPlanVersion: promotion.showPlanning.workspaceVersion,
    day: 6,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD",
    participantIds,
  });
  return { repository, worldId, planned, participantIds };
}

await test("standalone Programme management uses the full controlled roster without requiring a show reservation", async () => {
  const playerId = "programme-manager-player";
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 62001, playerId });
  const independent = aggregate.state.promotions.find((promotion) => promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("Programme manager fixture has no Independent promotion");
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, playerId, {
    promotionId: independent.id,
    requestId: "programme-manager-claim",
  });

  const before = await loadAlphaProgrammeManagement(repository, worldId, playerId);
  ok(before.roster.length >= 2, "standalone Programme management did not expose the controlled roster");
  ok(before.programmes.length === 0, "fresh Programme manager unexpectedly has an active Programme");

  const started = await startAlphaManagedProgramme(repository, worldId, playerId, {
    requestId: "programme-manager-start",
    expectedRevision: before.world.revision,
    sideAIds: [before.roster[0]!.personId],
    sideBIds: [before.roster[1]!.personId],
    championshipId: null,
  });
  ok(started.programmes.length === 1, "standalone Programme start did not persist the story");
  ok(started.world.revision === before.world.revision + 1, "standalone Programme start did not advance revision once");

  const retry = await startAlphaManagedProgramme(repository, worldId, playerId, {
    requestId: "programme-manager-start",
    expectedRevision: before.world.revision,
    sideAIds: [before.roster[0]!.personId],
    sideBIds: [before.roster[1]!.personId],
    championshipId: null,
  });
  ok(retry.programmes.length === 1, "standalone Programme retry duplicated the story");
  ok(retry.world.revision === started.world.revision, "standalone Programme retry advanced revision");
});

await test("Alpha Programme context starts and persists an idempotent wrestler Programme", async () => {
  const fixture = await reservedShowFixture(62011);
  const before = await loadAlphaProgrammeContext(fixture.repository, fixture.worldId, "alpha-player");
  ok(before.programmes.length === 0, "fresh Alpha World unexpectedly has a player Programme");
  ok(before.participants.length === fixture.participantIds.length, "Programme context lost reserved show participants");
  ok(before.canEdit, "Programme context is unexpectedly read-only in an open World");

  const request = {
    requestId: "programme-start-001",
    expectedRevision: before.world.revision,
    draftId: before.draftId,
    sideAIds: [fixture.participantIds[0]!],
    sideBIds: [fixture.participantIds[1]!],
    championshipId: null,
  };
  const started = await startAlphaProgramme(fixture.repository, fixture.worldId, "alpha-player", request);
  ok(started.world.revision === before.world.revision + 1, "starting a Programme did not advance World revision exactly once");
  ok(started.programmes.length === 1, "started Programme was not exposed back to the booking context");
  ok(started.programmes[0]?.sideA.personIds[0] === fixture.participantIds[0], "Programme side A changed identity");
  ok(started.programmes[0]?.sideB.personIds[0] === fixture.participantIds[1], "Programme side B changed identity");

  const persisted = await fixture.repository.load(fixture.worldId);
  ok((persisted.state.programmes ?? []).length === 1, "Programme was not persisted in World state");
  ok(
    persisted.commands.receipts.some((receipt) => receipt.requestId === request.requestId && receipt.commandType === "START_PROGRAMME"),
    "Programme start did not use the idempotent World command path",
  );

  const retried = await startAlphaProgramme(fixture.repository, fixture.worldId, "alpha-player", request);
  ok(retried.world.revision === started.world.revision, "idempotent Programme retry advanced World revision again");
  const afterRetry = await fixture.repository.load(fixture.worldId);
  ok((afterRetry.state.programmes ?? []).length === 1, "idempotent Programme retry duplicated the Programme");
});

await test("Alpha Programme start rejects talent outside the reserved show without mutation", async () => {
  const fixture = await reservedShowFixture(62012);
  const before = await loadAlphaProgrammeContext(fixture.repository, fixture.worldId, "alpha-player");
  const aggregate = await fixture.repository.load(fixture.worldId);
  const outsider = aggregate.state.people.find((person) => (
    person.status !== "RETIRED" && !fixture.participantIds.includes(person.id)
  ));
  if (!outsider) throw new Error("fixture has no wrestler outside the reserved show");

  let rejected = false;
  try {
    await startAlphaProgramme(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "programme-outsider-reject",
      expectedRevision: before.world.revision,
      draftId: before.draftId,
      sideAIds: [fixture.participantIds[0]!],
      sideBIds: [outsider.id],
      championshipId: null,
    });
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("must be reserved for this show");
  }
  ok(rejected, "Programme accepted a wrestler outside the reserved show");

  const after = await fixture.repository.load(fixture.worldId);
  ok(after.runtime.revision === before.world.revision, "rejected Programme mutated World revision");
  ok((after.state.programmes ?? []).length === 0, "rejected Programme partially mutated World state");
});

await test("Alpha Programme context only surfaces active stories involving this show's talent", async () => {
  const fixture = await reservedShowFixture(62013);
  const before = await loadAlphaProgrammeContext(fixture.repository, fixture.worldId, "alpha-player");
  await startAlphaProgramme(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "programme-context-relevance",
    expectedRevision: before.world.revision,
    draftId: before.draftId,
    sideAIds: [fixture.participantIds[0]!],
    sideBIds: [fixture.participantIds[1]!],
    championshipId: before.championships[0]?.championshipId ?? null,
  });

  const context = await loadAlphaProgrammeContext(fixture.repository, fixture.worldId, "alpha-player", before.draftId);
  ok(context.programmes.length === 1, "active Programme involving reserved talent disappeared from booking context");
  ok(
    context.programmes[0]?.championshipName === (before.championships[0]?.name ?? null),
    "Programme context lost its championship story",
  );
});

await test("Alpha Programme segments are planned idempotently without becoming history before resolution", async () => {
  const fixture = await reservedShowFixture(62014);
  const before = await loadAlphaProgrammeContext(fixture.repository, fixture.worldId, "alpha-player");
  const started = await startAlphaProgramme(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "programme-segment-story",
    expectedRevision: before.world.revision,
    draftId: before.draftId,
    sideAIds: [fixture.participantIds[0]!],
    sideBIds: [fixture.participantIds[1]!],
    championshipId: null,
  });
  const programme = started.programmes[0];
  if (!programme) throw new Error("segment fixture did not start its Programme");

  const request = {
    requestId: "programme-segment-enable",
    expectedRevision: started.world.revision,
    expectedPlanVersion: started.workspaceVersion,
    draftId: started.draftId,
    programmeId: programme.programmeId,
    enabled: true,
  };
  const enabled = await setAlphaProgrammeSegment(fixture.repository, fixture.worldId, "alpha-player", request);
  ok(enabled.programmeSegments.length === 1, "enabled Programme segment was not exposed in booking context");
  ok(
    enabled.programmeSegments[0]?.participantIds.includes(fixture.participantIds[0]!)
      && enabled.programmeSegments[0]?.participantIds.includes(fixture.participantIds[1]!),
    "Programme segment did not retain reserved story participants",
  );

  const persisted = await fixture.repository.load(fixture.worldId);
  ok((persisted.state.programmeActivities ?? []).length === 0, "planned Programme segment leaked into factual history before show resolution");
  const draft = persisted.planning.workspaces[0]?.detailedShowDrafts.find((candidate) => candidate.draftId === started.draftId);
  ok(draft?.programmeSegments?.length === 1, "Programme segment was not persisted with the show draft");

  const retried = await setAlphaProgrammeSegment(fixture.repository, fixture.worldId, "alpha-player", request);
  ok(retried.workspaceVersion === enabled.workspaceVersion, "idempotent segment retry advanced the show plan version again");
  ok(retried.programmeSegments.length === 1, "idempotent segment retry duplicated the planned segment");

  const disabled = await setAlphaProgrammeSegment(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "programme-segment-disable",
    expectedRevision: retried.world.revision,
    expectedPlanVersion: retried.workspaceVersion,
    draftId: retried.draftId,
    programmeId: programme.programmeId,
    enabled: false,
  });
  ok(disabled.programmeSegments.length === 0, "removing a Programme segment left stale show-plan activity behind");
});

console.log(`\nWeb Programme service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

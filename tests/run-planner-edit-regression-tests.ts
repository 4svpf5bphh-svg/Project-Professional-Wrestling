declare const process: { exitCode?: number };

import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  claimAlphaPromotion,
  createAlphaWorldAggregate,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaPlayerPlanner,
  saveAlphaPlannerShowPlan,
} from "../packages/web-adapter/src/planner-service.js";

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

await test("future reservation roster swaps clear only card content that uses the removed wrestler", async () => {
  const playerId = "planner-swap-player";
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61991, playerId });
  const promotion = aggregate.state.promotions.find((candidate) => (
    candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("planner swap fixture has no Independent promotion");
  promotion.eventCadenceWeeks = 2;
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, playerId, {
    promotionId: promotion.id,
    requestId: "planner-swap-claim",
  });

  const before = await loadAlphaPlayerPlanner(repository, worldId, playerId);
  const controlled = before.promotion;
  if (!controlled) throw new Error("planner swap fixture did not expose the controlled promotion");
  const week = controlled.weeks.find((candidate) => candidate.offset > 0 && candidate.showRequired);
  if (!week) throw new Error("planner swap fixture has no future operating week");
  const market = controlled.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("planner swap fixture has no market/venue");

  let participantIds = week.eligibleParticipants
    .slice(0, Math.min(week.maxParticipants, Math.max(week.minParticipants, 6)))
    .map((person) => person.personId);
  if (participantIds.length % 2 !== 0) participantIds = participantIds.slice(0, -1);
  if (participantIds.length < Math.max(4, week.minParticipants)) {
    throw new Error("planner swap fixture has too few eligible participants");
  }

  await saveAlphaPlannerShowPlan(repository, worldId, playerId, {
    requestId: "planner-swap-initial",
    expectedRevision: before.world.revision,
    expectedPlanVersion: controlled.workspaceVersion,
    year: week.year,
    week: week.week,
    day: 6,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD",
    participantIds,
  });

  const removedId = participantIds[0]!;
  const preservedIds = [participantIds[2]!, participantIds[3]!];
  await repository.transact(worldId, null, (current) => {
    const workspace = current.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id);
    const draft = workspace?.detailedShowDrafts.find((candidate) => (
      candidate.targetDate.year === week.year && candidate.targetDate.week === week.week
    ));
    if (!workspace || !draft) throw new Error("future draft disappeared before swap regression setup");
    draft.matches.push(
      {
        draftMatchId: "swap-cleared-match",
        type: "SINGLES",
        sideAIds: [removedId],
        sideBIds: [participantIds[1]!],
        intendedWinnerSide: "A",
        intent: "COMPETITIVE",
        plannedLengthMinutes: 12,
      },
      {
        draftMatchId: "swap-preserved-match",
        type: "SINGLES",
        sideAIds: [preservedIds[0]!],
        sideBIds: [preservedIds[1]!],
        intendedWinnerSide: "B",
        intent: "TECHNICAL",
        plannedLengthMinutes: 14,
      },
    );
    workspace.version += 1;
  });

  const beforeSwap = await loadAlphaPlayerPlanner(repository, worldId, playerId);
  const swapWeek = beforeSwap.promotion?.weeks.find((candidate) => (
    candidate.year === week.year && candidate.week === week.week
  ));
  const replacement = swapWeek?.eligibleParticipants.find((candidate) => !participantIds.includes(candidate.personId));
  if (!replacement) throw new Error("planner swap fixture has no replacement wrestler");
  const swappedParticipantIds = [replacement.personId, ...participantIds.slice(1)];

  await saveAlphaPlannerShowPlan(repository, worldId, playerId, {
    requestId: "planner-swap-edit",
    expectedRevision: beforeSwap.world.revision,
    expectedPlanVersion: beforeSwap.promotion!.workspaceVersion,
    year: week.year,
    week: week.week,
    day: 6,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD",
    participantIds: swappedParticipantIds,
  });

  const persisted = await repository.load(worldId);
  const workspace = persisted.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id);
  const draft = workspace?.detailedShowDrafts.find((candidate) => (
    candidate.targetDate.year === week.year && candidate.targetDate.week === week.week
  ));
  if (!draft) throw new Error("edited future draft was not persisted");
  ok(!draft.participantIds.includes(removedId), "removed wrestler remained selected after reservation edit");
  ok(draft.participantIds.includes(replacement.personId), "replacement wrestler was not selected after reservation edit");
  ok(!draft.matches.some((match) => match.draftMatchId === "swap-cleared-match"), "match using removed wrestler survived the roster swap");
  ok(draft.matches.some((match) => match.draftMatchId === "swap-preserved-match"), "unaffected future match was unnecessarily cleared");

  const reservation = persisted.planning.showReservations.find((candidate) => candidate.sourceDraftId === draft.draftId);
  ok(reservation?.participants.some((participant) => participant.personId === replacement.personId), "replacement wrestler was not reserved");
  ok(!reservation?.participants.some((participant) => participant.personId === removedId), "removed wrestler remained reserved");
});

console.log(`\nPlanner edit regression tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

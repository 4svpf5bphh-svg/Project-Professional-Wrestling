declare const process: { exitCode?: number };

import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  advanceAlphaWorldWeek,
  claimAlphaPromotion,
  createAlphaWorldAggregate,
  saveAlphaCurrentWeekShowPlan,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaCurrentWeekCard,
  saveAlphaCurrentWeekCard,
  type AlphaCardMatchView,
} from "../packages/web-adapter/src/card-service.js";
import {
  actualMatchFinish,
  plannedMatchFinish,
} from "../packages/sim-core/src/match-finishes.js";

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

async function fixture(seed: number) {
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
    requestId: `finish-claim-${seed}`,
  });
  const promotion = claimed.promotion;
  if (!promotion) throw new Error("claim did not expose controlled promotion");
  const market = promotion.showPlanning.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("show planner has no market/venue option");

  let participantIds = promotion.roster
    .filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0)
    .slice(0, promotion.showPlanning.maxParticipants)
    .map((person) => person.personId);
  if (participantIds.length % 2 !== 0) participantIds = participantIds.slice(0, -1);
  if (participantIds.length < promotion.showPlanning.minParticipants) {
    throw new Error("show planner has too few available wrestlers");
  }

  await saveAlphaCurrentWeekShowPlan(repository, worldId, "alpha-player", {
    requestId: `finish-show-${seed}`,
    expectedRevision: claimed.world.revision,
    expectedPlanVersion: promotion.showPlanning.workspaceVersion,
    day: 6,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD",
    participantIds,
  });

  return { repository, worldId, promotionId: promotion.promotionId, participantIds };
}

function singlesCard(participantIds: string[], legacy = false): AlphaCardMatchView[] {
  const matches: AlphaCardMatchView[] = [];
  for (let index = 0; index < participantIds.length; index += 2) {
    const matchIndex = matches.length;
    const match: AlphaCardMatchView = {
      draftMatchId: `finish-match-${matchIndex + 1}`,
      type: "SINGLES",
      sideAIds: [participantIds[index]!],
      sideBIds: [participantIds[index + 1]!],
      intendedWinnerSide: "A",
      intent: matchIndex === 0 && legacy ? "TECHNICAL" : "COMPETITIVE",
      plannedLengthMinutes: 12 + matchIndex,
    };
    if (!legacy) match.plannedFinish = matchIndex === 0 ? "FLASH_PIN" : "CLEAN_PIN";
    matches.push(match);
  }
  return matches;
}

await test("browser-booked match finish persists through show materialization and resolution", async () => {
  const setup = await fixture(61101);
  const before = await loadAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player");
  const card = singlesCard(setup.participantIds);
  const saved = await saveAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player", {
    requestId: "web-card-finish-explicit",
    expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: card,
    championshipAssignments: [],
  });

  ok(saved.matches[0]?.plannedFinish === "FLASH_PIN", "saved card lost the explicit flash-pin finish");
  const persisted = await setup.repository.load(setup.worldId);
  ok(
    persisted.planning.workspaces[0]?.detailedShowDrafts[0]?.matches[0]?.plannedFinish === "FLASH_PIN",
    "planning state lost the explicit match finish",
  );

  await advanceAlphaWorldWeek(setup.repository, setup.worldId, "alpha-player", {
    expectedRevision: saved.world.revision,
  });
  const resolved = await setup.repository.load(setup.worldId);
  const event = resolved.state.events
    .filter((candidate) => candidate.promotionId === setup.promotionId && candidate.status === "COMPLETED")
    .sort((left, right) => right.date.week - left.date.week || right.date.day - left.date.day)[0];
  if (!event) throw new Error("resolved World has no completed player show");
  const firstMatch = resolved.state.matches
    .filter((match) => match.eventId === event.id && match.status === "COMPLETED")
    .sort((left, right) => left.order - right.order)[0];
  if (!firstMatch) throw new Error("resolved player show has no first match");

  ok(plannedMatchFinish(firstMatch) === "FLASH_PIN", "materialized match lost the planned flash-pin finish");
  ok(
    actualMatchFinish(firstMatch) === (firstMatch.finishChangedDueToInjury ? "INJURY_STOPPAGE" : "FLASH_PIN"),
    "resolved match did not honor the booked finish or explain the injury override",
  );
});

await test("legacy browser card without finish derives and persists the intent default", async () => {
  const setup = await fixture(61102);
  const before = await loadAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player");
  const legacyCard = singlesCard(setup.participantIds, true);
  ok(legacyCard[0]?.plannedFinish === undefined, "legacy fixture unexpectedly supplied a finish");

  const saved = await saveAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player", {
    requestId: "web-card-finish-legacy",
    expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: legacyCard,
    championshipAssignments: [],
  });
  ok(saved.matches[0]?.plannedFinish === "SUBMISSION", "technical legacy match did not derive a submission finish");

  const persisted = await setup.repository.load(setup.worldId);
  ok(
    persisted.planning.workspaces[0]?.detailedShowDrafts[0]?.matches[0]?.plannedFinish === "SUBMISSION",
    "derived legacy finish was not persisted back into planning state",
  );
});

console.log(`\nWeb card finish tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

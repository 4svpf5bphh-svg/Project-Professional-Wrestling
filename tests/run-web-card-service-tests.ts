declare const process: { exitCode?: number };

import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  advanceAlphaWorldWeek,
  claimAlphaPromotion,
  createAlphaWorldAggregate,
  loadAlphaPlayerSession,
  saveAlphaCurrentWeekShowPlan,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaCurrentWeekCard,
  saveAlphaCurrentWeekCard,
  type AlphaCardMatchView,
} from "../packages/web-adapter/src/card-service.js";

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
    requestId: `card-claim-${seed}`,
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

  const planned = await saveAlphaCurrentWeekShowPlan(repository, worldId, "alpha-player", {
    requestId: `card-show-${seed}`,
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

function singlesCard(participantIds: string[]): AlphaCardMatchView[] {
  const matches: AlphaCardMatchView[] = [];
  for (let index = 0; index < participantIds.length; index += 2) {
    matches.push({
      draftMatchId: `manual-match-${matches.length + 1}`,
      type: "SINGLES",
      sideAIds: [participantIds[index]!],
      sideBIds: [participantIds[index + 1]!],
      intendedWinnerSide: "A",
      intent: matches.length === 0 ? "SHOWCASE" : "COMPETITIVE",
      plannedLengthMinutes: 12 + matches.length,
    });
  }
  return matches;
}

await test("Alpha browser card booking persists a complete card and materializes it into the reserved show", async () => {
  const fixture = await reservedShowFixture(61011);
  const beforeCard = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(beforeCard.matches.length === 0, "fresh reserved show unexpectedly has a manual card");
  ok(beforeCard.canEdit, "reserved show card is not editable");
  ok(beforeCard.participants.length === fixture.participantIds.length, "card planner lost reserved participants");

  const request = {
    requestId: "web-card-save-001",
    expectedRevision: beforeCard.world.revision,
    expectedPlanVersion: beforeCard.workspaceVersion,
    matches: singlesCard(fixture.participantIds),
  };
  const saved = await saveAlphaCurrentWeekCard(
    fixture.repository,
    fixture.worldId,
    "alpha-player",
    request,
  );
  ok(saved.matches.length === fixture.participantIds.length / 2, "saved card has the wrong match count");
  ok(saved.workspaceVersion === beforeCard.workspaceVersion + 1, "card save did not advance plan version exactly once");
  ok(saved.world.revision === beforeCard.world.revision + 2, "card save plus reservation refresh did not advance revision twice");

  const persisted = await fixture.repository.load(fixture.worldId);
  ok(persisted.planning.showReservations.length === 1, "card save duplicated or dropped the show reservation");
  ok(persisted.planning.workspaces[0]?.detailedShowDrafts[0]?.matches.length === saved.matches.length, "manual card was not persisted on the show draft");

  const retry = await saveAlphaCurrentWeekCard(
    fixture.repository,
    fixture.worldId,
    "alpha-player",
    request,
  );
  ok(retry.world.revision === saved.world.revision, "idempotent card retry advanced World revision again");
  const afterRetry = await fixture.repository.load(fixture.worldId);
  ok(afterRetry.planning.showReservations.length === 1, "idempotent card retry duplicated reservation");

  const afterWeek = await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
    expectedRevision: saved.world.revision,
  });
  ok(afterWeek.promotion?.lastResolvedShow?.matchCount === saved.matches.length, "weekly materialization did not use the player-booked card");
  const resolved = await fixture.repository.load(fixture.worldId);
  ok(
    resolved.state.ledger.some((entry) => entry.type === "HUMAN_MATCH_CARD_PREPARED"),
    "manual card preparation was not written to World history",
  );
  ok(
    resolved.state.ledger.some((entry) => entry.type === "PLANNED_SHOW_MATERIALIZED" && entry.payload.cardMaterialized === true),
    "reserved show did not report the manual card as materialized",
  );
});

await test("Alpha browser card booking rejects incomplete cards without damaging the reservation", async () => {
  const fixture = await reservedShowFixture(61012);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const incomplete = singlesCard(fixture.participantIds).slice(0, -1);
  let rejected = false;
  try {
    await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "web-card-incomplete",
      expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: incomplete,
    });
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("every wrestler reserved");
  }
  ok(rejected, "incomplete card was not rejected");

  const after = await fixture.repository.load(fixture.worldId);
  ok(after.runtime.revision === before.world.revision, "rejected card mutated World revision");
  ok(after.planning.showReservations.length === 1, "rejected card damaged the existing reservation");
  ok(after.planning.workspaces[0]?.detailedShowDrafts[0]?.matches.length === 0, "rejected card partially mutated the show draft");
});

console.log(`\nAlpha web card service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

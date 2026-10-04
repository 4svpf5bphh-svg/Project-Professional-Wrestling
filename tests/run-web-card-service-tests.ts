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
  loadAlphaShowCard,
  saveAlphaCurrentWeekCard,
  saveAlphaShowCard,
  type AlphaCardMatchView,
} from "../packages/web-adapter/src/card-service.js";
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

await test("Alpha browser card booking persists a complete card, title assignment and materializes both", async () => {
  const fixture = await reservedShowFixture(61011);
  const beforeCard = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(beforeCard.matches.length === 0, "fresh reserved show unexpectedly has a manual card");
  ok(beforeCard.canEdit, "reserved show card is not editable");
  ok(beforeCard.participants.length === fixture.participantIds.length, "card planner lost reserved participants");
  ok(beforeCard.targetDate.week === beforeCard.world.week, "current-week card target does not match current week");
  const singlesTitle = beforeCard.championships.find((championship) => championship.division === "SINGLES");
  ok(singlesTitle, "Alpha card did not expose the promotion singles championship");
  ok(singlesTitle?.holderName === null, "fresh Alpha championship should begin vacant");

  const card = singlesCard(fixture.participantIds);
  const request = {
    requestId: "web-card-save-001",
    expectedRevision: beforeCard.world.revision,
    expectedPlanVersion: beforeCard.workspaceVersion,
    matches: card,
    championshipAssignments: [{
      draftMatchId: card[0]!.draftMatchId,
      championshipId: singlesTitle!.championshipId,
    }],
  };
  const saved = await saveAlphaCurrentWeekCard(
    fixture.repository,
    fixture.worldId,
    "alpha-player",
    request,
  );
  ok(saved.matches.length === fixture.participantIds.length / 2, "saved card has the wrong match count");
  ok(saved.championshipAssignments.length === 1, "saved card lost the championship assignment");
  ok(saved.workspaceVersion === beforeCard.workspaceVersion + 1, "card save did not advance plan version exactly once");
  ok(saved.world.revision === beforeCard.world.revision + 2, "card save plus reservation refresh did not advance revision twice");

  const persisted = await fixture.repository.load(fixture.worldId);
  ok(persisted.planning.showReservations.length === 1, "card save duplicated or dropped the show reservation");
  ok(persisted.planning.workspaces[0]?.detailedShowDrafts[0]?.matches.length === saved.matches.length, "manual card was not persisted on the show draft");
  ok(
    persisted.planning.workspaces[0]?.detailedShowDrafts[0]?.championshipAssignments.length === 1,
    "championship assignment was not persisted on the show draft",
  );

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
    resolved.state.ledger.some((entry) => entry.type === "HUMAN_CHAMPIONSHIP_MATCH_BOOKED"),
    "manual championship assignment was not materialized into the show",
  );
  ok(
    resolved.state.ledger.some((entry) => (
      entry.type === "PLANNED_SHOW_MATERIALIZED"
      && entry.payload.cardMaterialized === true
      && entry.payload.championshipAssignmentsApplied === 1
    )),
    "reserved show did not report the manual card and title assignment as materialized",
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
      championshipAssignments: [],
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

await test("Alpha browser card booking rejects a championship on the wrong match division without mutation", async () => {
  const fixture = await reservedShowFixture(61013);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const tagTitle = before.championships.find((championship) => championship.division === "TAG");
  ok(tagTitle, "Alpha card did not expose the promotion tag championship");
  const card = singlesCard(fixture.participantIds);

  let rejected = false;
  try {
    await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "web-card-wrong-title-division",
      expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: card,
      championshipAssignments: [{
        draftMatchId: card[0]!.draftMatchId,
        championshipId: tagTitle!.championshipId,
      }],
    });
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("division does not match");
  }
  ok(rejected, "wrong-division championship assignment was not rejected");

  const after = await fixture.repository.load(fixture.worldId);
  ok(after.runtime.revision === before.world.revision, "rejected championship assignment mutated World revision");
  ok(after.planning.showReservations.length === 1, "rejected championship assignment damaged the reservation");
  ok(after.planning.workspaces[0]?.detailedShowDrafts[0]?.matches.length === 0, "rejected championship assignment partially saved the card");
  ok(
    after.planning.workspaces[0]?.detailedShowDrafts[0]?.championshipAssignments.length === 0,
    "rejected championship assignment partially saved title state",
  );
});

await test("Alpha six-week card booking targets the selected future draft without changing the current card", async () => {
  const fixture = await reservedShowFixture(61014);
  const currentBefore = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(currentBefore.matches.length === 0, "future-card fixture current show unexpectedly has a card");

  const plannerBefore = await loadAlphaPlayerPlanner(fixture.repository, fixture.worldId, "alpha-player");
  const promotion = plannerBefore.promotion;
  if (!promotion) throw new Error("future-card fixture lost controlled promotion");
  const futureWeek = promotion.weeks[1];
  if (!futureWeek || !futureWeek.showRequired) throw new Error("future-card fixture has no operating week at +1");
  const market = promotion.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("future-card planner has no market/venue option");

  let futureParticipantIds = futureWeek.eligibleParticipants
    .slice(0, Math.min(futureWeek.maxParticipants, Math.max(futureWeek.minParticipants, 4)))
    .map((person) => person.personId);
  if (futureParticipantIds.length % 2 !== 0) futureParticipantIds = futureParticipantIds.slice(0, -1);
  if (futureParticipantIds.length < futureWeek.minParticipants) throw new Error("future-card fixture has too few eligible wrestlers");

  const plannerAfter = await saveAlphaPlannerShowPlan(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "future-card-show",
    expectedRevision: plannerBefore.world.revision,
    expectedPlanVersion: promotion.workspaceVersion,
    year: futureWeek.year,
    week: futureWeek.week,
    day: 5,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD",
    participantIds: futureParticipantIds,
  });
  const futureDraft = plannerAfter.promotion?.weeks[1]?.shows[0];
  if (!futureDraft?.reservationId) throw new Error("future-card show was not reserved");

  const futureBefore = await loadAlphaShowCard(
    fixture.repository,
    fixture.worldId,
    "alpha-player",
    futureDraft.draftId,
  );
  ok(futureBefore.targetDate.week === futureWeek.week, "future card loader returned the wrong PPW week");
  ok(futureBefore.matches.length === 0, "fresh future show unexpectedly has a manual card");

  const futureCard = singlesCard(futureParticipantIds).map((match, index) => ({
    ...match,
    draftMatchId: `${futureDraft.draftId}:manual:${index + 1}`,
  }));
  const request = {
    requestId: "future-card-save",
    expectedRevision: futureBefore.world.revision,
    expectedPlanVersion: futureBefore.workspaceVersion,
    draftId: futureDraft.draftId,
    matches: futureCard,
    championshipAssignments: [],
  };
  const saved = await saveAlphaShowCard(fixture.repository, fixture.worldId, "alpha-player", request);
  ok(saved.draftId === futureDraft.draftId, "future card save returned another draft");
  ok(saved.matches.length === futureParticipantIds.length / 2, "future card saved the wrong match count");
  ok(saved.targetDate.week === futureWeek.week, "future card save shifted target week");

  const currentAfter = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(currentAfter.draftId === currentBefore.draftId, "future card save changed the current draft identity");
  ok(currentAfter.matches.length === 0, "future card save contaminated the current-week card");

  const retry = await saveAlphaShowCard(fixture.repository, fixture.worldId, "alpha-player", request);
  ok(retry.world.revision === saved.world.revision, "future card idempotent retry advanced revision again");
  const reloaded = await loadAlphaShowCard(fixture.repository, fixture.worldId, "alpha-player", futureDraft.draftId);
  ok(reloaded.matches.length === saved.matches.length, "future card did not survive reload");

  let strangerRejected = false;
  try {
    await loadAlphaShowCard(fixture.repository, fixture.worldId, "stranger", futureDraft.draftId);
  } catch (error) {
    strangerRejected = error instanceof Error && error.message.includes("Take control");
  }
  ok(strangerRejected, "non-controller could read a future match card by draft ID");
});

console.log(`\nAlpha web card service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

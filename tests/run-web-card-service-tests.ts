declare const process: { exitCode?: number };

import { materializePersistedCurrentWeekReservations } from "../packages/application/src/index.js";
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
  type AlphaCardSegmentView,
} from "../packages/web-adapter/src/card-service.js";
import { wrestlerAlignmentForPromotion } from "../packages/sim-core/src/alignment.js";
import { startAlphaManagedProgramme } from "../packages/web-adapter/src/programme-management-service.js";
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
  ok(beforeCard.recentMeetings.length === 0, "fresh Alpha World unexpectedly exposed prior opponent history");
  ok(beforeCard.canEdit, "reserved show card is not editable");
  ok(beforeCard.participants.length === fixture.participantIds.length, "card planner lost reserved participants");
  ok(beforeCard.participants.every((person) => Number.isFinite(person.fatigue) && Number.isFinite(person.wear)), "card planner omitted wrestler physical condition");
  ok(beforeCard.participants.every((person) => Number.isFinite(person.skills.stamina) && Number.isFinite(person.skills.safety)), "card planner omitted wrestler readiness skills");
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

  const nextPromotion = afterWeek.promotion;
  if (!nextPromotion) throw new Error("resolved World lost the controlled promotion");
  const available = new Set(
    nextPromotion.roster
      .filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0)
      .map((person) => person.personId),
  );
  const repeatMatch = card.find((match) => available.has(match.sideAIds[0]!) && available.has(match.sideBIds[0]!));
  if (!repeatMatch) throw new Error("recent-opponent fixture has no repeatable completed pairing");
  const nextTargetCount = Math.min(
    nextPromotion.showPlanning.maxParticipants,
    Math.max(nextPromotion.showPlanning.minParticipants, 4),
  );
  const nextParticipantIds = [repeatMatch.sideAIds[0]!, repeatMatch.sideBIds[0]!];
  for (const person of nextPromotion.roster) {
    if (nextParticipantIds.length >= nextTargetCount) break;
    if (person.status !== "ACTIVE" || person.datesRemaining <= 0 || nextParticipantIds.includes(person.personId)) continue;
    nextParticipantIds.push(person.personId);
  }
  if (nextParticipantIds.length % 2 !== 0) nextParticipantIds.pop();
  if (nextParticipantIds.length < nextPromotion.showPlanning.minParticipants) {
    throw new Error("recent-opponent fixture cannot reserve enough talent next week");
  }
  const nextMarket = nextPromotion.showPlanning.markets[0];
  const nextVenue = nextMarket?.venues[0];
  if (!nextMarket || !nextVenue) throw new Error("recent-opponent fixture lost market/venue options");
  await saveAlphaCurrentWeekShowPlan(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "recent-opponent-next-show",
    expectedRevision: afterWeek.world.revision,
    expectedPlanVersion: nextPromotion.showPlanning.workspaceVersion,
    day: 6,
    marketId: nextMarket.marketId,
    venueId: nextVenue.venueId,
    ticketStrategy: "STANDARD",
    participantIds: nextParticipantIds,
  });
  const nextCard = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const recent = nextCard.recentMeetings.find((meeting) => (
    (meeting.personAId === repeatMatch.sideAIds[0] && meeting.personBId === repeatMatch.sideBIds[0])
    || (meeting.personAId === repeatMatch.sideBIds[0] && meeting.personBId === repeatMatch.sideAIds[0])
  ));
  ok(recent?.weeksAgo === 1, "card did not expose the previous week's opponent context");
  ok((recent?.winnerPersonIds.length ?? 0) > 0, "recent opponent context did not expose the prior winning side");
});

await test("Show Builder persists an interleaved Programme segment with wrestlers who also work matches", async () => {
  const fixture = await reservedShowFixture(61021);
  const beforeProgramme = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const [first, second] = fixture.participantIds;
  if (!first || !second) throw new Error("segment fixture lacks Programme wrestlers");

  await startAlphaManagedProgramme(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "card-segment-programme",
    expectedRevision: beforeProgramme.world.revision,
    sideAIds: [first],
    sideBIds: [second],
    championshipId: null,
  });

  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(before.programmes.length === 1, "Show Builder did not expose the active Programme");
  const programme = before.programmes[0]!;
  ok(programme.participantIds.includes(first) && programme.participantIds.includes(second), "card Programme lost its wrestlers");

  const card = singlesCard(fixture.participantIds);
  const segment: AlphaCardSegmentView = {
    draftSegmentId: "card-segment-1",
    type: "CONFRONTATION",
    participantIds: [first, second],
    programmeId: programme.programmeId,
    plannedLengthMinutes: 7,
  };
  const order = [
    { kind: "MATCH" as const, refId: card[0]!.draftMatchId },
    { kind: "SEGMENT" as const, refId: segment.draftSegmentId },
    ...card.slice(1).map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
  ];

  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "web-card-segment-save",
    expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: card,
    segments: [segment],
    runningOrder: order,
    championshipAssignments: [],
  });

  ok(saved.segments.length === 1 && saved.segments[0]?.type === "CONFRONTATION", "typed card segment was not persisted");
  ok(saved.segments[0]?.programmeId === programme.programmeId, "segment lost its Programme attachment");
  ok(saved.runningOrder[1]?.kind === "SEGMENT" && saved.runningOrder[1]?.refId === segment.draftSegmentId, "interleaved running order was not preserved");
  ok(saved.participants.length === fixture.participantIds.length, "wrestlers working both match and segment were double-counted in the reservation");

  const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(reloaded.segments[0]?.participantIds.includes(first), "segment did not survive reload");
  ok(reloaded.runningOrder[1]?.kind === "SEGMENT", "segment slot moved after reload");
});

await test("Alpha browser card booking derives the reservation from the wrestlers actually booked", async () => {
  const fixture = await reservedShowFixture(61012);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const reduced = singlesCard(fixture.participantIds).slice(0, -1);
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "web-card-derived-roster",
    expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: reduced,
    championshipAssignments: [],
  });

  const usedIds = new Set(reduced.flatMap((match) => [...match.sideAIds, ...match.sideBIds]));
  ok(saved.participants.length === usedIds.size, "saved card did not derive its show roster from booked matches");

  const after = await fixture.repository.load(fixture.worldId);
  const reservation = after.planning.showReservations[0];
  ok(reservation, "card save dropped the show reservation");
  ok(reservation!.participants.length === usedIds.size, "reservation did not shrink to the booked card");
  ok(
    reservation!.participants.every((participant) => usedIds.has(participant.personId)),
    "reservation retained a wrestler who was removed from the card",
  );
});

await test("a logistics-only show draft opens in the builder and the first valid card creates its talent reservation", async () => {
  const playerId = "slot-builder-player";
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61022, playerId });
  const independent = aggregate.state.promotions.find((promotion) => (
    promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE"
  ));
  if (!independent) throw new Error("slot-builder fixture has no Independent promotion");
  independent.eventCadenceWeeks = 1;
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await claimAlphaPromotion(repository, worldId, playerId, {
    promotionId: independent.id,
    requestId: "slot-builder-claim",
  });
  const plannerBefore = await loadAlphaPlayerPlanner(repository, worldId, playerId);
  const promotion = plannerBefore.promotion;
  if (!promotion) throw new Error("slot-builder fixture lost controlled promotion");
  const week = promotion.weeks[0]!;
  const market = promotion.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("slot-builder fixture has no venue");

  const planned = await saveAlphaPlannerShowPlan(repository, worldId, playerId, {
    requestId: "slot-builder-logistics",
    expectedRevision: plannerBefore.world.revision,
    expectedPlanVersion: promotion.workspaceVersion,
    year: week.year,
    week: week.week,
    day: 6,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD",
  });
  const show = planned.promotion?.weeks[0]?.shows[0];
  if (!show) throw new Error("logistics-only show draft was not created");
  ok(show.reservationId === null, "logistics-only show should not reserve wrestlers before booking");

  const builder = await loadAlphaShowCard(repository, worldId, playerId, show.draftId);
  ok(builder.reservationId === null, "unbooked show builder unexpectedly had a reservation");
  ok(builder.availableParticipants.length >= builder.minParticipants, "builder did not expose enough contracted talent");

  const selectedIds = builder.availableParticipants
    .slice(0, builder.minParticipants % 2 === 0 ? builder.minParticipants : builder.minParticipants + 1)
    .map((person) => person.personId);
  if (selectedIds.length % 2 !== 0 || selectedIds.length < builder.minParticipants) {
    throw new Error("slot-builder fixture could not form a valid match card");
  }
  const card = singlesCard(selectedIds).map((match, index) => ({
    ...match,
    draftMatchId: `${show.draftId}:slot:${index + 1}`,
  }));
  const saved = await saveAlphaShowCard(repository, worldId, playerId, {
    requestId: "slot-builder-first-card",
    expectedRevision: builder.world.revision,
    expectedPlanVersion: builder.workspaceVersion,
    draftId: show.draftId,
    matches: card,
    championshipAssignments: [],
  });
  ok(saved.reservationId !== null, "first valid card did not create the shared-World talent reservation");

  const persisted = await repository.load(worldId);
  const reservation = persisted.planning.showReservations.find((candidate) => candidate.sourceDraftId === show.draftId);
  ok(reservation?.participants.length === selectedIds.length, "first card reservation did not match the booked wrestlers");
});

await test("current-week unsafe style is refused before lock", async () => {
  const fixture = await reservedShowFixture(61025);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const firstId = fixture.participantIds[0]!;
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const person = aggregate.state.people.find((candidate) => candidate.id === firstId)!;
    person.fatigue = 88;
    person.wear = 82;
    person.skills.safety = Math.min(person.skills.safety, 42);
    person.skills.stamina = Math.min(person.skills.stamina, 44);
  });
  const afterConditionChange = await fixture.repository.load(fixture.worldId);

  const card = singlesCard(fixture.participantIds);
  card[0] = {
    ...card[0]!,
    style: {
      competitiveness: 90,
      technical: 75,
      story: 55,
      intensity: 96,
      risk: 100,
      epic: 88,
    },
    plannedLengthMinutes: 42,
  };

  let refused = false;
  try {
    await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "readiness-current-refusal",
      expectedRevision: afterConditionChange.runtime.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: card,
      championshipAssignments: [],
    });
  } catch (error) {
    refused = error instanceof Error && error.message.includes("refuses this match style");
  }
  ok(refused, "unsafe current-week style was not blocked before lock");
});

await test("materialized current-week show remains editable until lock and replaces its card safely", async () => {
  const fixture = await reservedShowFixture(61023);
  const beforeMaterialization = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const materializedPass = await materializePersistedCurrentWeekReservations(
    fixture.repository,
    fixture.worldId,
    beforeMaterialization.world.revision,
  );
  ok(materializedPass.pass.materialized.length === 1, "fixture show did not materialize");

  const materialized = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(materialized.planningState === "MATERIALIZED", "incomplete materialized show did not expose MATERIALIZED state");
  ok(materialized.canEdit, "materialized current-week card was read-only");
  ok(
    materialized.availableParticipants.length === fixture.participantIds.length,
    "materialized builder exposed wrestlers outside the committed show roster",
  );

  const firstCard = singlesCard(fixture.participantIds);
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "materialized-card-first-save",
    expectedRevision: materialized.world.revision,
    expectedPlanVersion: materialized.workspaceVersion,
    matches: firstCard,
    championshipAssignments: [],
  });
  ok(saved.planningState === "READY_TO_LOCK", "saved materialized card was not ready to lock");
  ok(saved.canEdit, "ready current-week card froze before World lock");
  ok(saved.world.revision === materialized.world.revision + 1, "materialized card save advanced revision unexpectedly");

  const afterFirst = await fixture.repository.load(fixture.worldId);
  const event = afterFirst.state.events.find((candidate) => (
    candidate.promotionId === saved.promotion.promotionId
    && candidate.status === "SCHEDULED"
    && candidate.date.year === saved.world.year
    && candidate.date.week === saved.world.week
  ));
  if (!event) throw new Error("materialized card fixture lost its scheduled event");
  const firstActualIds = afterFirst.state.matches
    .filter((match) => match.eventId === event.id && match.status === "SCHEDULED")
    .map((match) => match.id);
  ok(firstActualIds.length === firstCard.length, "first materialized card did not create scheduled matches");

  const revisedStyle = {
    competitiveness: 72,
    technical: 91,
    story: 44,
    intensity: 63,
    risk: 28,
    epic: 57,
  };
  const revisedCard = saved.matches.map((match, index) => (
    index === 0
      ? { ...match, intent: "TECHNICAL" as const, style: revisedStyle, plannedLengthMinutes: 19 }
      : { ...match }
  ));
  const revisedRequest = {
    requestId: "materialized-card-revision",
    expectedRevision: saved.world.revision,
    expectedPlanVersion: saved.workspaceVersion,
    matches: revisedCard,
    championshipAssignments: [],
  };
  const revised = await saveAlphaCurrentWeekCard(
    fixture.repository,
    fixture.worldId,
    "alpha-player",
    revisedRequest,
  );
  ok(revised.canEdit && revised.planningState === "READY_TO_LOCK", "revised card froze before lock");
  ok(revised.matches[0]?.style?.technical === 91, "revised card response dropped match style");

  const afterRevision = await fixture.repository.load(fixture.worldId);
  const revisedMatches = afterRevision.state.matches
    .filter((match) => match.eventId === event.id && match.status === "SCHEDULED")
    .sort((left, right) => left.order - right.order);
  ok(revisedMatches.length === revisedCard.length, "card revision duplicated or dropped scheduled matches");
  ok(revisedMatches[0]?.intent === "TECHNICAL", "card revision did not replace match intent");
  ok(revisedMatches[0]?.style?.technical === 91 && revisedMatches[0]?.style?.risk === 28, "card revision did not replace match style");
  ok(revisedMatches[0]?.plannedLengthMinutes === 19, "card revision did not replace match length");
  ok(
    revisedMatches.every((match) => !firstActualIds.includes(match.id)),
    "card revision left stale scheduled matches attached to the event",
  );

  const retry = await saveAlphaCurrentWeekCard(
    fixture.repository,
    fixture.worldId,
    "alpha-player",
    revisedRequest,
  );
  ok(retry.world.revision === revised.world.revision, "idempotent materialized card retry advanced revision");
  const afterRetry = await fixture.repository.load(fixture.worldId);
  const retryIds = afterRetry.state.matches
    .filter((match) => match.eventId === event.id && match.status === "SCHEDULED")
    .map((match) => match.id);
  ok(retryIds.join(",") === revisedMatches.map((match) => match.id).join(","), "idempotent retry replaced the card again");
});

await test("Show Builder persists and resolves a TURN segment into promotion alignment history", async () => {
  const fixture = await reservedShowFixture(61024);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const personId = fixture.participantIds[0]!;
  const current = before.availableParticipants.find((person) => person.personId === personId)?.alignment
    ?? before.participants.find((person) => person.personId === personId)?.alignment;
  if (!current) throw new Error("turn fixture could not resolve current alignment");
  const target = current === "HEEL" ? "FACE" : "HEEL";
  const card = singlesCard(fixture.participantIds);
  const turn: AlphaCardSegmentView = {
    draftSegmentId: "turn-slot",
    type: "TURN",
    participantIds: [personId],
    programmeId: null,
    plannedLengthMinutes: 5,
    turnPersonId: personId,
    turnTargetAlignment: target,
  };
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "web-card-turn-save",
    expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: card,
    segments: [turn],
    runningOrder: [
      { kind: "SEGMENT", refId: turn.draftSegmentId },
      ...card.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
    ],
    championshipAssignments: [],
  });
  ok(saved.segments[0]?.type === "TURN" && saved.segments[0]?.turnTargetAlignment === target, "turn segment did not survive card save");

  await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
    expectedRevision: saved.world.revision,
  });
  const resolved = await fixture.repository.load(fixture.worldId);
  ok(wrestlerAlignmentForPromotion(resolved.state, saved.promotion.promotionId, personId) === target, "resolved turn did not change promotion alignment");
  ok(resolved.state.ledger.some((entry) => entry.type === "SHOW_SEGMENT_COMPLETED" && entry.payload.segmentType === "TURN"), "turn was not frozen into show history");
  ok(resolved.state.ledger.some((entry) => entry.type === "PROMOTION_ALIGNMENT_CHANGED" && entry.payload.method === "TURN"), "turn did not create alignment-change history");
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
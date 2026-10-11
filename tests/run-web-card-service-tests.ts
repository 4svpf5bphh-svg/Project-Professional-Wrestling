declare const process: { exitCode?: number };

import {
  buildPlayerAttention,
  lockScheduledShowCommitments,
  resolveScheduledWorldCycle,
  lockPersistedWorldForResolution,
  materializePersistedCurrentWeekReservations,
  resolvePersistedWorldWeek,
} from "../packages/application/src/index.js";
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
  requestAlphaShowCreativeConsent,
  withdrawAlphaShowCreativeAmendment,
  type AlphaCardMatchView,
  type AlphaCardSegmentView,
} from "../packages/web-adapter/src/card-service.js";
import { wrestlerAlignmentForPromotion } from "../packages/sim-core/src/alignment.js";
import { mutateAlphaStable } from "../packages/web-adapter/src/stable-service.js";
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

function sameDivisionParticipantIds(
  state: { people: Array<{ id: string; division?: "MEN" | "WOMEN" }> },
  candidates: Array<{ personId: string }>,
  minParticipants: number,
  maxParticipants: number,
): string[] {
  const divisionById = new Map(state.people.map((person) => [person.id, person.division ?? "MEN"]));
  const groups = (["MEN", "WOMEN"] as const)
    .map((division) => candidates.filter((person) => divisionById.get(person.personId) === division))
    .sort((left, right) => right.length - left.length);
  const minimumEven = minParticipants % 2 === 0 ? minParticipants : minParticipants + 1;
  const group = groups.find((candidate) => candidate.length >= minimumEven);
  if (!group) throw new Error("fixture has no single division with enough wrestlers");
  let count = Math.min(group.length, maxParticipants);
  if (count % 2 !== 0) count -= 1;
  if (count < minimumEven) throw new Error("fixture cannot form an even same-division roster");
  return group.slice(0, count).map((person) => person.personId);
}

async function reservedShowFixture(seed: number) {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed, playerId: "alpha-player" });
  const independent = aggregate.state.promotions.find((promotion) => (
    promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE"
  ));
  if (!independent) throw new Error("test World has no active takeover-eligible promotion");
  const flagship = aggregate.state.showSeries?.find((series) => (
    series.promotionId === independent.id && series.role === "FLAGSHIP"
  ));
  if (!flagship) throw new Error("card fixture is missing its Flagship show identity");
  flagship.cadenceWeeks = 1;
  flagship.anchorWeek = 0;
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

  const participantIds = sameDivisionParticipantIds(
    aggregate.state,
    promotion.roster.filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0),
    promotion.showPlanning.minParticipants,
    promotion.showPlanning.maxParticipants,
  );

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

await test("Show Builder exposes established teams as tag-booking shortcuts", async () => {
  const fixture = await reservedShowFixture(61010);
  const [first, second] = fixture.participantIds;
  if (!first || !second) throw new Error("team shortcut fixture lacks two wrestlers");

  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    aggregate.state.teams ??= [];
    aggregate.state.teamMemberships ??= [];
    aggregate.state.teams.push({
      id: "card-shortcut-team",
      worldId: aggregate.state.world.id,
      name: "Card Shortcut Team",
      status: "ACTIVE",
      formedDate: { ...aggregate.state.world.currentDate },
      disbandedDate: null,
    });
    for (const [index, personId] of [first, second].entries()) {
      aggregate.state.teamMemberships.push({
        id: `card-shortcut-membership-${index + 1}`,
        worldId: aggregate.state.world.id,
        teamId: "card-shortcut-team",
        personId,
        joinedDate: { ...aggregate.state.world.currentDate },
        leftDate: null,
        active: true,
      });
    }
  });

  const card = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const team = card.availableTeams.find((candidate) => candidate.teamId === "card-shortcut-team");
  ok(team?.name === "Card Shortcut Team", "Show Builder did not expose the established team shortcut");
  ok(
    [...(team?.memberIds ?? [])].sort().join(":") === [first, second].sort().join(":"),
    "Show Builder team shortcut did not preserve the team's two wrestler participants",
  );
});

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
    sideA: [{ kind: "PERSON", entityId: first }],
    sideB: [{ kind: "PERSON", entityId: second }],
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

for (const [kind, seed] of [["CHALLENGE", 61100], ["CONFRONTATION", 61101]] as const) {
  await test(`Card saves directed ${kind.toLowerCase()} roles without changing match reservations`, async () => {
    const fixture = await reservedShowFixture(seed);
    const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const [first, second] = fixture.participantIds;
    if (!first || !second) throw new Error("directed fixture needs two wrestlers");
    const angle: AlphaCardSegmentView = {
      draftSegmentId: `card-directed-${kind.toLowerCase()}`,
      type: kind,
      participantIds: [first, second],
      programmeId: null,
      plannedLengthMinutes: 5,
      initiatorPersonId: second,
      targetPersonId: first,
    };
    let invalid = false;
    try {
      await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
        requestId: `card-directed-invalid-${kind}`,
        expectedRevision: before.world.revision,
        expectedPlanVersion: before.workspaceVersion,
        matches: singlesCard(fixture.participantIds),
        segments: [{ ...angle, targetPersonId: first, initiatorPersonId: null }],
        championshipAssignments: [],
      });
    } catch (error) {
      invalid = String(error).includes("distinct initiator and target");
    }
    ok(invalid, "Card accepted a partly specified directed angle");
    const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `card-directed-save-${kind}`,
      expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: singlesCard(fixture.participantIds),
      segments: [angle],
      championshipAssignments: [],
    });
    ok(saved.segments[0]?.initiatorPersonId === second && saved.segments[0]?.targetPersonId === first, "saved roles were reordered");
    const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(reloaded.segments[0]?.initiatorPersonId === second && reloaded.segments[0]?.targetPersonId === first, "directed roles lost on reload");
  });
}

await test("RESCUE Card preserves all three named roles through reload", async () => {
  const fixture = await reservedShowFixture(61104);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const [aggressor, victim, rescuer] = fixture.participantIds;
  if (!aggressor || !victim || !rescuer) throw new Error("rescue fixture needs three people");
  const segment: AlphaCardSegmentView = {
    draftSegmentId: "card-rescue", type: "RESCUE",
    participantIds: [victim, aggressor, rescuer], programmeId: null,
    plannedLengthMinutes: 6,
    attackerPersonId: aggressor, victimPersonId: victim, rescuerPersonId: rescuer,
  };
  let refused = false;
  try {
    await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "card-invalid-rescue", expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: singlesCard(fixture.participantIds), segments: [{ ...segment, rescuerPersonId: victim }],
      championshipAssignments: [],
    });
  } catch (error) {
    refused = String(error).includes("distinct rescuer");
  }
  ok(refused, "Card allowed the victim to rescue themselves");
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "card-rescue-valid", expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: singlesCard(fixture.participantIds), segments: [segment],
    championshipAssignments: [],
  });
  ok(saved.segments[0]?.attackerPersonId === aggressor
    && saved.segments[0]?.victimPersonId === victim
    && saved.segments[0]?.rescuerPersonId === rescuer, "Card reordered rescue roles");
  const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(reloaded.segments[0]?.type === "RESCUE" && reloaded.segments[0]?.rescuerPersonId === rescuer,
    "Card reload lost the rescuer");
});

await test("RESCUE allows a booked outsider to save a wrestler in an active Programme", async () => {
  const fixture = await reservedShowFixture(61105);
  const beforeProgramme = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const [attacker, victim, rescuer] = fixture.participantIds;
  if (!attacker || !victim || !rescuer) throw new Error("outsider save fixture needs three people");
  await startAlphaManagedProgramme(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "outsider-save-programme",
    expectedRevision: beforeProgramme.world.revision,
    sideA: [{ kind: "PERSON", entityId: attacker }],
    sideB: [{ kind: "PERSON", entityId: victim }],
    championshipId: null,
  });
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const programme = before.programmes[0]!;
  ok(!programme.participantIds.includes(rescuer), "rescuer should not start as a Programme participant");
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "outsider-save-booking", expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: singlesCard(fixture.participantIds),
    segments: [{ draftSegmentId: "outsider-rescue", type: "RESCUE",
      participantIds: [attacker, victim, rescuer],
      attackerPersonId: attacker, victimPersonId: victim, rescuerPersonId: rescuer,
      programmeId: programme.programmeId, plannedLengthMinutes: 5 }],
    championshipAssignments: [],
  });
  ok(saved.segments[0]?.programmeId === programme.programmeId
    && saved.segments[0]?.rescuerPersonId === rescuer, "outsider save lost programme link");
  const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(reloaded.segments[0]?.rescuerPersonId === rescuer, "outsider rescuer disappeared on reload");
});

await test("Run-in saves, reloads, resolves and records the actual finish without changing the intended winner", async () => {
  const fixture = await reservedShowFixture(61118);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const card = singlesCard(fixture.participantIds);
  if (card.length < 2) throw new Error("run-in fixture requires at least two matches");
  const interferer = card[1]!.sideAIds[0]!;
  const planned = card.map((match, index) => index === 0
    ? { ...match, interfererPersonId: interferer, interferenceSide: "A" as const, plannedFinish: "CLEAN_PIN" as const }
    : match);
  const invalid = planned.map((match, index) => index === 0
    ? { ...match, interfererPersonId: match.sideAIds[0]! } : match);
  let rejected = false;
  try {
    await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "run-in-invalid-competitor", expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion, matches: invalid, championshipAssignments: [],
    });
  } catch (error) {
    rejected = String(error).includes("cannot compete in the same match");
  }
  ok(rejected, "the booked match winner could interfere in their own match");
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "run-in-valid", expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion, matches: planned, championshipAssignments: [],
  });
  ok(saved.matches[0]?.interfererPersonId === interferer && saved.matches[0]?.interferenceSide === "A",
    "run-in intent was lost on save");
  const loaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(loaded.matches[0]?.interfererPersonId === interferer && loaded.matches[0]?.interferenceSide === "A",
    "run-in booking was lost on reload");
  await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
    expectedRevision: saved.world.revision,
  });
  const finished = await fixture.repository.load(fixture.worldId);
  const relevant = finished.state.matches.find((match) => match.promotionId === saved.promotion.promotionId
    && match.order === 1 && match.status === "COMPLETED" && match.interference?.personId === interferer);
  ok(relevant, "run-in was not preserved on the completed match");
  ok(relevant?.actualWinnerSide === "A", "run-in reversed the player's winner choice");
  ok(relevant?.interference?.outcome === "SUCCESS" || relevant?.interference?.outcome === "ABORTED",
    "simulation changed the scripted run-in outcome");
  const evidence = finished.state.ledger.find((entry) => entry.type === "MATCH_COMPLETED"
    && entry.entityIds.includes(relevant!.id));
  ok(evidence?.payload.interferencePersonId === interferer
    && evidence.payload.interferenceAidedSide === "A"
    && evidence.payload.interferenceOutcome === relevant?.interference?.outcome,
    "match ledger does not agree with run-in result");
  if (relevant?.interference?.outcome === "SUCCESS") {
    ok(evidence?.payload.actualFinish === "PROTECTED_FINISH", "successful interference did not protect the finish");
  }
  const show = finished.state.events.find((event) => event.id === relevant?.eventId)!;
  const appearance = finished.state.scheduledAppearances.find((entry) => entry.eventId === show.id
    && entry.personId === interferer);
  ok(appearance?.status === "COMPLETED", "run-in wrestler did not fulfil their booked appearance");
});

for (const [outcome, seed] of [["RECONCILED", 61146], ["REBUFFED", 61147]] as const) {
  await test(`Card freezes scripted stable ${outcome} and preserves former-member history`, async () => {
    const fixture = await reservedShowFixture(seed);
    const [representative, former, third] = fixture.participantIds;
    if (!representative || !former || !third) throw new Error("reunion fixture needs three wrestlers");
    const first = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const created = await mutateAlphaStable(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `reunion-create-${seed}`, expectedRevision: first.world.revision,
      action: "CREATE", name: "Former Member Stable",
      personIds: [representative, former, third],
    });
    const stableId = created.stables[0]!.stableId;
    const removed = await mutateAlphaStable(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `reunion-history-${seed}`, expectedRevision: created.world.revision,
      action: "REMOVE", stableId, personId: former,
    });
    ok(removed.stables[0]?.memberHistory.some((member) =>
      member.personId === former && !member.active), "World membership history was not retained");
    const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(before.availableStables.some((stable) => stable.stableId === stableId
      && stable.memberIds.includes(representative)
      && stable.formerMemberIds.includes(former)), "Card cannot identify former stable members");
    const segment: AlphaCardSegmentView = {
      draftSegmentId: "reconciliation-segment", type: "STABLE_RECONCILIATION",
      participantIds: [former, representative],
      initiatorPersonId: representative, targetPersonId: former,
      stableId, stableReconciliationOutcome: outcome, programmeId: null,
      plannedLengthMinutes: 6,
    };
    const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `reunion-save-${seed}`, expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: singlesCard(fixture.participantIds),
      segments: [segment], championshipAssignments: [],
    });
    const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(reloaded.segments[0]?.stableReconciliationOutcome === outcome
      && reloaded.segments[0]?.stableId === stableId
      && reloaded.segments[0]?.targetPersonId === former,
      "Card reload changed the authored reconciliation");
    await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const finished = await fixture.repository.load(fixture.worldId);
    const entry = finished.state.ledger.find((item) => item.type === "SHOW_SEGMENT_COMPLETED"
      && item.payload.draftSegmentId === segment.draftSegmentId);
    ok(entry?.payload.stableReconciliationOutcome === outcome
      && entry.payload.stableId === stableId && entry.payload.stableName === "Former Member Stable"
      && entry.payload.initiatorPersonId === representative
      && entry.payload.targetPersonId === former,
      "World Lock rewrote the authored reunion outcome");
    ok((finished.state.stableMemberships ?? []).some((member) =>
      member.stableId === stableId && member.personId === former && !member.active),
      "scripted reconciliation silently reinstated a former member");
    ok(!(finished.state.stableMemberships ?? []).some((member) =>
      member.stableId === stableId && member.personId === former && member.active),
      "sim created active stable membership from a scripted segment");
  });
}

for (const [outcome, seed] of [["EXPELLED", 61144], ["WALKED_OUT", 61145]] as const) {
  await test(`Card preserves scripted stable exit ${outcome} without removing members`, async () => {
    const fixture = await reservedShowFixture(seed);
    const [representative, departing, third] = fixture.participantIds;
    if (!representative || !departing || !third) throw new Error("stable exit fixture needs three wrestlers");
    const first = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const created = await mutateAlphaStable(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `stable-exit-create-${seed}`, expectedRevision: first.world.revision,
      action: "CREATE", name: "Scripted Exit Stable",
      personIds: [representative, departing, third],
    });
    const stableId = created.stables[0]!.stableId;
    const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const angle: AlphaCardSegmentView = {
      draftSegmentId: "booked-stable-exit", type: "STABLE_EXIT",
      participantIds: [departing, representative],
      initiatorPersonId: representative, targetPersonId: departing,
      stableId, stableExitOutcome: outcome, programmeId: null, plannedLengthMinutes: 6,
    };
    const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `stable-exit-save-${seed}`,
      expectedRevision: before.world.revision, expectedPlanVersion: before.workspaceVersion,
      matches: singlesCard(fixture.participantIds), segments: [angle], championshipAssignments: [],
    });
    const again = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(again.segments[0]?.stableExitOutcome === outcome
      && again.segments[0]?.stableId === stableId && again.segments[0]?.targetPersonId === departing,
      "Card reload changed the authored stable exit");
    await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const finished = await fixture.repository.load(fixture.worldId);
    const entry = finished.state.ledger.find((item) => item.type === "SHOW_SEGMENT_COMPLETED"
      && item.payload.draftSegmentId === angle.draftSegmentId);
    ok(entry?.payload.stableExitOutcome === outcome
      && entry.payload.stableId === stableId && entry.payload.stableName === "Scripted Exit Stable"
      && entry.payload.initiatorPersonId === representative
      && entry.payload.targetPersonId === departing,
      "World Lock rewrote the on-screen stable exit");
    ok((finished.state.stableMemberships ?? []).some((member) =>
      member.stableId === stableId && member.personId === departing && member.active),
      "World Lock silently removed the wrestler from the real stable");
    ok(typeof entry?.payload.segmentCrowdResponse === "number",
      "scripted stable exit did not receive an execution rating");
  });
}

for (const [response, seed] of [["ACCEPTED", 61142], ["REFUSED", 61143]] as const) {
  await test(`Card saves ${response} stable invitation and World Lock preserves the roster`, async () => {
    const fixture = await reservedShowFixture(seed);
    const [representative, recruit, memberTwo, memberThree] = fixture.participantIds;
    if (!representative || !recruit || !memberTwo || !memberThree) throw new Error("stable fixture requires four wrestlers");
    const earlier = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const created = await mutateAlphaStable(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `create-actual-stable-${seed}`,
      expectedRevision: earlier.world.revision,
      action: "CREATE", name: "Onscreen Inviting Stable",
      personIds: [representative, memberTwo, memberThree],
    });
    const stableId = created.stables[0]!.stableId;
    const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(before.availableStables.some((stable) => stable.stableId === stableId
      && stable.memberIds.includes(representative)), "Card did not expose the real stable");
    const angle: AlphaCardSegmentView = {
      draftSegmentId: "stable-story", type: "STABLE_INVITATION",
      participantIds: [representative, recruit], initiatorPersonId: representative,
      targetPersonId: recruit, stableId, stableInvitationOutcome: response,
      programmeId: null, plannedLengthMinutes: 6,
    };
    const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `save-stable-angle-${seed}`,
      expectedRevision: before.world.revision, expectedPlanVersion: before.workspaceVersion,
      matches: singlesCard(fixture.participantIds), segments: [angle], championshipAssignments: [],
    });
    const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(reloaded.segments[0]?.stableId === stableId
      && reloaded.segments[0]?.stableInvitationOutcome === response
      && reloaded.segments[0]?.targetPersonId === recruit, "Card changed scripted invitation");
    await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const finished = await fixture.repository.load(fixture.worldId);
    const entry = finished.state.ledger.find((item) => item.type === "SHOW_SEGMENT_COMPLETED"
      && item.payload.draftSegmentId === angle.draftSegmentId);
    ok(entry?.payload.stableId === stableId
      && entry.payload.stableName === "Onscreen Inviting Stable"
      && entry.payload.stableInvitationOutcome === response,
      "World Ledger lost the authored stable invitation");
    ok(!(finished.state.stableMemberships ?? []).some((member) =>
      member.stableId === stableId && member.personId === recruit && member.active),
      "on-screen acceptance silently changed real stable membership");
    ok(typeof entry?.payload.segmentCrowdResponse === "number", "stable invitation did not receive a rating");
  });
}

for (const [outcome, seed] of [
  ["INTERRUPTER_PREVAILS", 61135], ["SPEAKER_PREVAILS", 61136], ["BRAWL", 61137],
] as const) {
  await test(`Card preserves authored ${outcome} interruption through World Lock`, async () => {
    const fixture = await reservedShowFixture(seed);
    const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const [speaker, interrupter] = fixture.participantIds;
    if (!speaker || !interrupter) throw new Error("interruption needs two wrestlers");
    const segment: AlphaCardSegmentView = {
      draftSegmentId: "planned-interruption", type: "INTERRUPTION",
      participantIds: [speaker, interrupter], initiatorPersonId: interrupter,
      targetPersonId: speaker, interruptionOutcome: outcome,
      programmeId: null, plannedLengthMinutes: 6,
    };
    const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `scripted-interruption-${seed}`,
      expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: singlesCard(fixture.participantIds),
      segments: [segment], championshipAssignments: [],
    });
    ok(saved.segments[0]?.interruptionOutcome === outcome, "save changed scripted interruption");
    const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(reloaded.segments[0]?.interruptionOutcome === outcome
      && reloaded.segments[0]?.initiatorPersonId === interrupter
      && reloaded.segments[0]?.targetPersonId === speaker,
      "Card reload lost the scripted ending or directed roles");
    await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const finished = await fixture.repository.load(fixture.worldId);
    const entry = finished.state.ledger.find((e) => e.type === "SHOW_SEGMENT_COMPLETED"
      && e.payload.draftSegmentId === segment.draftSegmentId);
    ok(entry?.payload.segmentType === "INTERRUPTION"
      && entry.payload.interruptionOutcome === outcome
      && entry.payload.initiatorPersonId === interrupter
      && entry.payload.targetPersonId === speaker,
      "World Lock changed the authored interruption result");
    ok(typeof entry?.payload.segmentCrowdResponse === "number",
      "no crowd evaluation for scripted interruption");
  });
}

for (const [response, seed] of [["ACCEPTED", 61130], ["REFUSED", 61131], ["LEFT_OPEN", 61132]] as const) {
  await test(`Card persists scripted CHALLENGE ${response} through World Lock`, async () => {
    const fixture = await reservedShowFixture(seed);
    const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const [target, challenger] = fixture.participantIds;
    if (!challenger || !target) throw new Error("challenge response needs two wrestlers");
    const segment: AlphaCardSegmentView = {
      draftSegmentId: "scripted-challenge", type: "CHALLENGE", participantIds: [target, challenger],
      initiatorPersonId: challenger, targetPersonId: target, challengeResponse: response,
      programmeId: null, plannedLengthMinutes: 5,
    };
    const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `challenge-response-${seed}`, expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion, matches: singlesCard(fixture.participantIds),
      segments: [segment], championshipAssignments: [],
    });
    ok(saved.segments[0]?.challengeResponse === response, "save replaced scripted response");
    const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(reloaded.segments[0]?.challengeResponse === response
      && reloaded.segments[0]?.initiatorPersonId === challenger
      && reloaded.segments[0]?.targetPersonId === target,
      "Card reload lost authored reply or roles");
    await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const finished = await fixture.repository.load(fixture.worldId);
    const event = finished.state.ledger.find((entry) => entry.type === "SHOW_SEGMENT_COMPLETED"
      && entry.payload.draftSegmentId === segment.draftSegmentId);
    ok(event?.payload.challengeResponse === response
      && event.payload.initiatorPersonId === challenger && event.payload.targetPersonId === target,
      "World Lock changed the scripted challenge reply");
  });
}

for (const [signingOutcome, seed] of [["SIGNED", 61128], ["BRAWL", 61129]] as const) {
  await test(`Card preserves the scripted ${signingOutcome} signing through World Lock`, async () => {
    const fixture = await reservedShowFixture(seed);
    const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    const [responder, proposer] = fixture.participantIds;
    if (!responder || !proposer) throw new Error("signing fixture needs two wrestlers");
    const angle: AlphaCardSegmentView = {
      draftSegmentId: "scripted-signing", type: "CONTRACT_SIGNING",
      participantIds: [responder, proposer], initiatorPersonId: proposer,
      targetPersonId: responder, signingOutcome, programmeId: null, plannedLengthMinutes: 7,
    };
    const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: `signing-save-${seed}`, expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion, matches: singlesCard(fixture.participantIds),
      segments: [angle], championshipAssignments: [],
    });
    ok(saved.segments[0]?.signingOutcome === signingOutcome,
      "save changed the authored signing outcome");
    const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
    ok(reloaded.segments[0]?.initiatorPersonId === proposer
      && reloaded.segments[0]?.targetPersonId === responder
      && reloaded.segments[0]?.signingOutcome === signingOutcome,
      "Card reload changed signing story or participant direction");
    await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const finished = await fixture.repository.load(fixture.worldId);
    const frozen = finished.state.ledger.find((entry) => entry.type === "SHOW_SEGMENT_COMPLETED"
      && entry.payload.draftSegmentId === angle.draftSegmentId);
    ok(frozen?.payload.segmentType === "CONTRACT_SIGNING"
      && frozen.payload.signingOutcome === signingOutcome,
      "World simulation rewrote contract signing");
    ok(frozen?.payload.initiatorPersonId === proposer && frozen.payload.targetPersonId === responder,
      "World history lost the role order");
  });
}

await test("Card post-match assault links to completed match without changing its finish", async () => {
  const fixture = await reservedShowFixture(61106);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const card = singlesCard(fixture.participantIds);
  if (card.length < 2) throw new Error("match-linked fixture needs two matches");
  const victim = card[0]!.sideAIds[0]!;
  const attacker = card[1]!.sideAIds[0]!;
  const segment: AlphaCardSegmentView = {
    draftSegmentId: "after-match-assault", type: "POST_MATCH_ASSAULT",
    participantIds: [attacker, victim], attackerPersonId: attacker,
    victimPersonId: victim, sourceDraftMatchId: card[0]!.draftMatchId,
    programmeId: null, plannedLengthMinutes: 5,
  };
  const validOrder = [
    { kind: "MATCH" as const, refId: card[0]!.draftMatchId },
    { kind: "SEGMENT" as const, refId: segment.draftSegmentId },
    ...card.slice(1).map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
  ];
  let rejected = false;
  try {
    await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "assault-wrong-order", expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion, matches: card, segments: [segment],
      runningOrder: [...card.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
        { kind: "SEGMENT" as const, refId: segment.draftSegmentId }],
      championshipAssignments: [],
    });
  } catch (error) {
    rejected = String(error).includes("immediately follow");
  }
  ok(rejected, "Card allowed aftermath detached from source match");
  rejected = false;
  try {
    await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "assault-wrong-victim", expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion, matches: card,
      segments: [{ ...segment, victimPersonId: card[1]!.sideBIds[0],
        participantIds: [attacker, card[1]!.sideBIds[0]!] }],
      runningOrder: validOrder, championshipAssignments: [],
    });
  } catch (error) {
    rejected = String(error).includes("victim must compete");
  }
  ok(rejected, "Card accepted an assault against a different match's wrestler");
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "assault-correctly-linked", expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion, matches: card, segments: [segment],
    runningOrder: validOrder, championshipAssignments: [],
  });
  ok(saved.segments[0]?.sourceDraftMatchId === card[0]!.draftMatchId,
    "Card dropped source match identity");
  const loaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(loaded.runningOrder[1]?.kind === "SEGMENT" && loaded.segments[0]?.victimPersonId === victim,
    "Card moved aftermath or forgot the victim after reload");
  await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
    expectedRevision: saved.world.revision,
  });
  const finished = await fixture.repository.load(fixture.worldId);
  const frozen = finished.state.ledger.find((entry) => entry.type === "SHOW_SEGMENT_COMPLETED"
    && entry.payload.segmentType === "POST_MATCH_ASSAULT"
    && entry.payload.draftSegmentId === segment.draftSegmentId);
  ok(frozen, "match-linked assault did not enter the frozen show history");
  const sourceId = frozen?.payload.sourceMatchId;
  const sourceMatch = finished.state.matches.find((match) => match.id === sourceId);
  ok(sourceMatch?.status === "COMPLETED", "assault source points to an incomplete match");
  const victimAppearance = finished.state.matchParticipants.find((person) => (
    person.matchId === sourceId && person.personId === victim
  ));
  ok(victimAppearance, "assault victim was not in the actual source match");
  const actualOutcome = sourceMatch!.actualWinnerSide === null ? "DRAW"
    : victimAppearance!.side === sourceMatch!.actualWinnerSide ? "WON" : "LOST";
  ok(frozen?.payload.victimMatchOutcome === actualOutcome,
    "post-match assault fabricated the victim's match outcome");
});

await test("Post-match outsider aggressor can advance a feud without joining it", async () => {
  const fixture = await reservedShowFixture(61107);
  const beforeProgramme = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const card = singlesCard(fixture.participantIds);
  if (card.length < 2) throw new Error("outsider assault fixture needs two matches");
  const victim = card[0]!.sideAIds[0]!;
  const opponent = card[0]!.sideBIds[0]!;
  const attacker = card[1]!.sideAIds[0]!;
  await startAlphaManagedProgramme(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "outsider-assault-programme",
    expectedRevision: beforeProgramme.world.revision,
    sideA: [{ kind: "PERSON", entityId: victim }],
    sideB: [{ kind: "PERSON", entityId: opponent }],
    championshipId: null,
  });
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const programme = before.programmes[0]!;
  ok(!programme.participantIds.includes(attacker), "attacker should be outside the feud");
  const assault: AlphaCardSegmentView = {
    draftSegmentId: "post-match-outsider", type: "POST_MATCH_ASSAULT",
    participantIds: [attacker, victim], attackerPersonId: attacker, victimPersonId: victim,
    sourceDraftMatchId: card[0]!.draftMatchId,
    programmeId: programme.programmeId, plannedLengthMinutes: 5,
  };
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "outsider-assault-save", expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion, matches: card, segments: [assault],
    runningOrder: [{ kind: "MATCH", refId: card[0]!.draftMatchId },
      { kind: "SEGMENT", refId: assault.draftSegmentId },
      ...card.slice(1).map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId }))],
    championshipAssignments: [],
  });
  ok(saved.segments[0]?.attackerPersonId === attacker
    && saved.segments[0]?.programmeId === programme.programmeId, "outsider attack lost feud context");
  const reloaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(reloaded.segments[0]?.attackerPersonId === attacker, "outside aggressor did not survive Card reload");
  ok(!reloaded.programmes[0]?.participantIds.includes(attacker),
    "Card silently enrolled attacker into the feud");
});

await test("Card requires attack roles and preserves them on reload", async () => {
  const fixture = await reservedShowFixture(61098);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const [attacker, victim] = fixture.participantIds;
  if (!attacker || !victim) throw new Error("attack fixture requires two wrestlers");
  const attack: AlphaCardSegmentView = {
    draftSegmentId: "card-attack-1",
    type: "ATTACK",
    participantIds: [attacker, victim],
    programmeId: null,
    plannedLengthMinutes: 6,
    attackerPersonId: attacker,
    victimPersonId: victim,
    attackPresentation: "BEATDOWN",
    attackObjective: "BUILD_SYMPATHY",
  };
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "web-card-attack-roles",
    expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: singlesCard(fixture.participantIds),
    segments: [attack],
    championshipAssignments: [],
  });
  ok(saved.segments[0]?.attackerPersonId === attacker, "Card lost the attacker role");
  ok(saved.segments[0]?.victimPersonId === victim, "Card lost the victim role");
  ok(saved.segments[0]?.attackPresentation === "BEATDOWN", "Card lost the attack format");
  ok(saved.segments[0]?.attackObjective === "BUILD_SYMPATHY", "Card lost private booking objective");
  const loaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(loaded.segments[0]?.attackerPersonId === attacker && loaded.segments[0]?.victimPersonId === victim, "attack roles did not survive reload");
  ok(loaded.segments[0]?.attackPresentation === "BEATDOWN" && loaded.segments[0]?.attackObjective === "BUILD_SYMPATHY", "attack format/objective did not survive reload");
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
    promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE"
  ));
  if (!independent) throw new Error("slot-builder fixture has no takeover-eligible promotion");
  const flagship = aggregate.state.showSeries?.find((series) => (
    series.promotionId === independent.id && series.role === "FLAGSHIP"
  ));
  if (!flagship) throw new Error("card fixture is missing its Flagship show identity");
  flagship.cadenceWeeks = 1;
  flagship.anchorWeek = 0;
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

  const persistedForBuilder = await repository.load(worldId);
  const firstPickerPerson = builder.availableParticipants[0];
  if (!firstPickerPerson) throw new Error("builder did not expose a wrestler for picker division coverage");
  const firstPickerStatePerson = persistedForBuilder.state.people.find((person) => person.id === firstPickerPerson.personId);
  ok(
    firstPickerPerson.division === (firstPickerStatePerson?.division ?? null),
    "card picker projection did not expose the wrestler division",
  );
  const selectedIds = sameDivisionParticipantIds(
    persistedForBuilder.state,
    builder.availableParticipants,
    builder.minParticipants,
    builder.maxParticipants,
  );
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

await test("Betrayal Turn survives Card reload and resolves into factual public show history", async () => {
  const fixture = await reservedShowFixture(61086);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const [turner, betrayed] = fixture.participantIds;
  if (!turner || !betrayed) throw new Error("betrayal fixture requires two wrestlers");
  const current = before.availableParticipants.find((person) => person.personId === turner)?.alignment
    ?? before.participants.find((person) => person.personId === turner)?.alignment;
  if (!current) throw new Error("betrayal fixture lacks current alignment");
  const target = current === "HEEL" ? "FACE" : "HEEL";
  const card = singlesCard(fixture.participantIds);
  const segment: AlphaCardSegmentView = {
    draftSegmentId: "card-betrayal", type: "TURN",
    participantIds: [turner, betrayed], programmeId: null, plannedLengthMinutes: 6,
    turnPersonId: turner, turnTargetAlignment: target,
    turnPresentation: "BETRAYAL", betrayedPersonId: betrayed,
  };
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "card-betrayal-save", expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion, matches: card, segments: [segment],
    runningOrder: [{ kind: "SEGMENT", refId: segment.draftSegmentId }, ...card.map((match) => ({
      kind: "MATCH" as const, refId: match.draftMatchId,
    }))], championshipAssignments: [],
  });
  ok(saved.segments[0]?.turnPresentation === "BETRAYAL" && saved.segments[0]?.betrayedPersonId === betrayed, "Card dropped betrayal metadata");
  const loaded = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(loaded.segments[0]?.betrayedPersonId === betrayed, "reload dropped betrayed wrestler");
  await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
    expectedRevision: saved.world.revision,
  });
  const resolved = await fixture.repository.load(fixture.worldId);
  ok(wrestlerAlignmentForPromotion(resolved.state, saved.promotion.promotionId, turner) === target, "betrayer's alignment never changed");
  ok(resolved.state.ledger.some((entry) => entry.type === "SHOW_SEGMENT_COMPLETED"
    && entry.payload.turnPresentation === "BETRAYAL" && entry.payload.betrayedPersonId === betrayed), "show history lacks betrayal evidence");
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

  const persistedForFuture = await fixture.repository.load(fixture.worldId);
  const futureParticipantIds = sameDivisionParticipantIds(
    persistedForFuture.state,
    futureWeek.eligibleParticipants,
    Math.max(futureWeek.minParticipants, 4),
    futureWeek.maxParticipants,
  );

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


await test("unapproved protected losses hold a future reservation until an explicit wrestler decision", async () => {
  const fixture = await reservedShowFixture(61261);
  const loserId = fixture.participantIds[1]!;
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const controlled = aggregate.state.promotions.find((entry) => entry.controllerType === "HUMAN");
    const contract = aggregate.state.contracts.find((entry) =>
      entry.personId === loserId && entry.promotionId === controlled?.id && entry.status === "SIGNED"
    );
    if (!contract) throw new Error("fixture missing loser contract");
    contract.creativeControl = "PROTECTED_FINISHES";
    const person = aggregate.state.people.find((entry) => entry.id === loserId)!;
    person.morale = 100;
    person.fatigue = 0;
    person.priorities.loyalty = 100;
    person.priorities.role = 0;
  });
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const saved = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "protected-future-save",
    expectedRevision: before.world.revision,
    expectedPlanVersion: before.workspaceVersion,
    matches: singlesCard(fixture.participantIds),
    championshipAssignments: [],
  });
  ok(saved.creativeConcerns.some((c) => c.personId === loserId && c.requiresConsent && c.consent === "NOT_REQUESTED"),
    "saved protected loss did not report the contract objection");
  const beforeMaterialization = await fixture.repository.load(fixture.worldId);
  const countBefore = beforeMaterialization.state.events.length;
  const riskPass = await materializePersistedCurrentWeekReservations(
    fixture.repository, fixture.worldId, saved.world.revision,
  );
  ok(riskPass.pass.atRisk.some((r) => r.reasons.includes("CREATIVE_APPROVAL_REQUIRED")),
    "future reservation ignored unresolved creative rights");
  const waiting = await fixture.repository.load(fixture.worldId);
  ok(waiting.state.events.length === countBefore && waiting.planning.showReservations.length === 1,
    "unapproved future card was materialized or had its reservation silently discarded");

  const consentView = await requestAlphaShowCreativeConsent(
    fixture.repository, fixture.worldId, "alpha-player", {
      requestId: "protected-future-consent",
      expectedRevision: waiting.runtime.revision,
      expectedPlanVersion: saved.workspaceVersion,
      draftId: saved.draftId,
      draftMatchId: saved.matches[0]!.draftMatchId,
      personId: loserId,
    },
  );
  ok(consentView.creativeConcerns.some((c) => c.personId === loserId && c.consent === "APPROVED"),
    "granted wrestler consent did not appear on saved card");
  const approvedPass = await materializePersistedCurrentWeekReservations(
    fixture.repository, fixture.worldId, consentView.world.revision,
  );
  ok(approvedPass.pass.materialized.length === 1 && approvedPass.pass.materialized[0]!.cardMaterialized,
    "fully approved future card did not materialize normally");
});

await test("materialized card edits stay held until consent then apply the promoter's exact intended finish", async () => {
  const fixture = await reservedShowFixture(61262);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  await materializePersistedCurrentWeekReservations(fixture.repository, fixture.worldId, before.world.revision);
  const materialized = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const original = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "creative-current-original",
    expectedRevision: materialized.world.revision,
    expectedPlanVersion: materialized.workspaceVersion,
    matches: singlesCard(fixture.participantIds),
    championshipAssignments: [],
  });
  const loserId = fixture.participantIds[1]!;
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const contract = aggregate.state.contracts.find((entry) =>
      entry.personId === loserId && entry.promotionId === original.promotion.promotionId && entry.status === "SIGNED"
    );
    if (!contract) throw new Error("missing contracted losing wrestler");
    contract.creativeControl = "PROTECTED_FINISHES";
    const person = aggregate.state.people.find((entry) => entry.id === loserId)!;
    person.morale = 100; person.fatigue = 0;
    person.priorities.loyalty = 100; person.priorities.role = 0;
  });
  const prior = await fixture.repository.load(fixture.worldId);
  const event = prior.state.events.find((entry) => entry.promotionId === original.promotion.promotionId
    && entry.status === "SCHEDULED" && entry.date.week === prior.state.world.currentDate.week)!;
  const originalIds = prior.state.matches.filter((entry) => entry.eventId === event.id && entry.status === "SCHEDULED").map((entry) => entry.id);
  const requested = original.matches.map((match, index) =>
    index === 0 ? { ...match, plannedLengthMinutes: match.plannedLengthMinutes + 1, plannedFinish: "CLEAN_PIN" as const } : match);
  const proposed = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "creative-current-proposed",
    expectedRevision: original.world.revision,
    expectedPlanVersion: original.workspaceVersion,
    matches: requested,
    championshipAssignments: [],
  });
  ok(proposed.cardPendingConsent, "materialized card replacement did not expose pending creative approval");
  const parked = await fixture.repository.load(fixture.worldId);
  const parkedIds = parked.state.matches.filter((entry) => entry.eventId === event.id && entry.status === "SCHEDULED").map((entry) => entry.id);
  ok(parkedIds.join("|") === originalIds.join("|"), "unapproved proposal replaced a committed match");

  const approved = await requestAlphaShowCreativeConsent(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "creative-current-approve",
    expectedRevision: proposed.world.revision,
    expectedPlanVersion: proposed.workspaceVersion,
    draftId: proposed.draftId,
    draftMatchId: proposed.matches[0]!.draftMatchId,
    personId: loserId,
  });
  ok(!approved.cardPendingConsent, "approved booking still claims a contractual veto");
  const applied = await fixture.repository.load(fixture.worldId);
  const actual = applied.state.matches.filter((entry) => entry.eventId === event.id && entry.status === "SCHEDULED")
    .sort((a, b) => a.order - b.order);
  ok(actual[0]?.plannedLengthMinutes === requested[0]!.plannedLengthMinutes
    && actual[0]?.intendedWinnerSide === requested[0]!.intendedWinnerSide,
    "approved revision did not apply the promoter-authored match");
  ok(!originalIds.includes(actual[0]!.id), "original card was not replaced after consent");
  const retried = await requestAlphaShowCreativeConsent(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "creative-current-approve",
    expectedRevision: proposed.world.revision,
    expectedPlanVersion: proposed.workspaceVersion,
    draftId: proposed.draftId,
    draftMatchId: proposed.matches[0]!.draftMatchId,
    personId: loserId,
  });
  ok(retried.world.revision === approved.world.revision, "repeated approval advanced World revision");
});


await test("manual advance explains an unapproved show, but the scheduled lock records staff fallback", async () => {
  const fixture = await reservedShowFixture(61263);
  const loserId = fixture.participantIds[1]!;
  const first = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const contract = aggregate.state.contracts.find((entry) => entry.status === "SIGNED"
      && entry.personId === loserId && entry.promotionId === first.promotion.promotionId);
    if (!contract) throw new Error("missing controlled wrestler contract");
    contract.creativeControl = "PROTECTED_FINISHES";
  });
  const card = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "creative-lock-fallback-card",
    expectedRevision: first.world.revision,
    expectedPlanVersion: first.workspaceVersion,
    matches: singlesCard(fixture.participantIds),
    championshipAssignments: [],
  });
  ok(card.creativeConcerns.some((entry) => entry.personId === loserId && entry.consent === "NOT_REQUESTED"
    && entry.requiresConsent), "saved card did not identify unapproved wrestler");
  const revisionBeforeAdvance = card.world.revision;
  let blocked = false;
  try {
    await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
      expectedRevision: revisionBeforeAdvance,
    });
  } catch (error) {
    blocked = error instanceof Error && error.message.includes("Creative approval required");
  }
  ok(blocked, "manual week advancement did not explain the unresolved creative permission");
  const afterAttempt = await fixture.repository.load(fixture.worldId);
  ok(afterAttempt.runtime.revision === revisionBeforeAdvance
    && afterAttempt.planning.showReservations.length === 1
    && !afterAttempt.state.ledger.some((entry) => entry.type === "PLANNED_SHOW_CREATIVE_STAFF_FALLBACK"),
    "blocked manual advancement mutated World or prematurely released the show");

  const lockedRevision = await lockPersistedWorldForResolution(
    fixture.repository, fixture.worldId, revisionBeforeAdvance,
  );
  const afterLock = await fixture.repository.load(fixture.worldId);
  ok(afterLock.runtime.phase === "LOCKING", "scheduled lock did not progress after manual veto");
  ok(afterLock.state.ledger.some((entry) => entry.type === "PLANNED_SHOW_CREATIVE_STAFF_FALLBACK"
    && entry.entityIds.includes(first.promotion.promotionId)), "scheduled lock did not record staff takeover reason");
  ok(afterLock.planning.showReservations.length === 0, "released unapproved reservation still claims scarce wrestlers");
  await resolvePersistedWorldWeek(fixture.repository, fixture.worldId, lockedRevision);
  const resolved = await fixture.repository.load(fixture.worldId);
  ok(resolved.runtime.phase === "OPEN", "scheduled World was held hostage by another promoter's permission");
  const notices = buildPlayerAttention(resolved, "alpha-player");
  ok(notices.some((entry) => entry.title === "Unapproved booking handed to staff"),
    "player was not shown the scripted booking fallback in Attention");
});


await test("withdrawing a refused live-card amendment restores the last committed booking without touching its actual matches", async () => {
  const fixture = await reservedShowFixture(61271);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  await materializePersistedCurrentWeekReservations(fixture.repository, fixture.worldId, before.world.revision);
  const materialized = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const loserId = fixture.participantIds[1]!;
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const deal = aggregate.state.contracts.find((contract) =>
      contract.promotionId === materialized.promotion.promotionId && contract.personId === loserId
      && contract.status === "SIGNED");
    if (!deal) throw new Error("missing protected wrestler's agreement");
    deal.creativeControl = "PROTECTED_FINISHES";
  });
  const originalCard = singlesCard(fixture.participantIds).map((match, index) =>
    index === 0 ? { ...match, plannedFinish: "PROTECTED_FINISH" as const } : match);
  const original = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "withdraw-original",
    expectedRevision: materialized.world.revision,
    expectedPlanVersion: materialized.workspaceVersion,
    matches: originalCard,
    championshipAssignments: [],
  });
  ok(!original.cardPendingConsent, "contract-safe original show was unexpectedly pending approval");
  const initialWorld = await fixture.repository.load(fixture.worldId);
  const event = initialWorld.state.events.find((item) =>
    item.promotionId === original.promotion.promotionId && item.status === "SCHEDULED"
    && item.date.week === initialWorld.state.world.currentDate.week)!;
  const liveMatches = initialWorld.state.matches.filter((match) =>
    match.eventId === event.id && match.status === "SCHEDULED");
  const initialIds = liveMatches.map((match) => match.id);

  const proposed = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "withdraw-propose-clean-loss",
    expectedRevision: original.world.revision,
    expectedPlanVersion: original.workspaceVersion,
    matches: original.matches.map((match, index) => index === 0
      ? { ...match, plannedFinish: "CLEAN_PIN" as const, plannedLengthMinutes: match.plannedLengthMinutes + 5 }
      : match),
    championshipAssignments: [],
  });
  ok(proposed.cardPendingConsent, "new protected loss was applied instead of held");
  const stored = await fixture.repository.load(fixture.worldId);
  ok(stored.planning.pendingCardAmendments?.length === 1, "missing rollback checkpoint");
  ok(stored.planning.pendingCardAmendments?.[0]?.committedDraft.matches[0]?.plannedFinish === "PROTECTED_FINISH",
    "checkpoint did not keep previously committed finish");
  const sameIds = stored.state.matches.filter((match) => match.eventId === event.id
    && match.status === "SCHEDULED").map((match) => match.id);
  ok(sameIds.join(":") === initialIds.join(":"), "pending change damaged the committed match IDs");

  // Editing another pending proposal must never overwrite the first checkpoint.
  const amended = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "withdraw-propose-again",
    expectedRevision: proposed.world.revision,
    expectedPlanVersion: proposed.workspaceVersion,
    matches: proposed.matches.map((match, index) => index === 0
      ? { ...match, plannedLengthMinutes: match.plannedLengthMinutes + 1 } : match),
    championshipAssignments: [],
  });
  const afterSecondSave = await fixture.repository.load(fixture.worldId);
  ok(afterSecondSave.planning.pendingCardAmendments?.length === 1
    && afterSecondSave.planning.pendingCardAmendments[0]?.committedDraft.matches[0]?.plannedFinish === "PROTECTED_FINISH",
    "second proposed change overwrote the committed baseline");

  const restoreRequest = {
    requestId: "withdraw-test-request",
    expectedRevision: amended.world.revision,
    expectedPlanVersion: amended.workspaceVersion,
    draftId: amended.draftId,
  };
  let wrongControllerDenied = false;
  try {
    await withdrawAlphaShowCreativeAmendment(fixture.repository, fixture.worldId, "another-player", restoreRequest);
  } catch { wrongControllerDenied = true; }
  ok(wrongControllerDenied, "another player withdrew a promoter's pending card");

  const restored = await withdrawAlphaShowCreativeAmendment(
    fixture.repository, fixture.worldId, "alpha-player", restoreRequest);
  ok(!restored.cardPendingConsent, "restoration did not clear pending creative amendment");
  ok(restored.matches[0]?.plannedFinish === "PROTECTED_FINISH"
    && restored.matches[0]?.plannedLengthMinutes === original.matches[0]?.plannedLengthMinutes,
    "withdrawal did not restore prior authored finish and duration");
  ok(restored.creativeConcerns.filter((entry) => entry.requiresConsent).length === 0,
    "restored protected finish still raised a contractual veto");
  const resultWorld = await fixture.repository.load(fixture.worldId);
  ok(resultWorld.planning.pendingCardAmendments?.length === 0, "withdrawal retained stale rollback checkpoint");
  ok(resultWorld.state.matches.filter((match) => match.eventId === event.id
    && match.status === "SCHEDULED").map((match) => match.id).join(":") === initialIds.join(":"),
    "withdrawal replaced actual scheduled matches");
  const retry = await withdrawAlphaShowCreativeAmendment(
    fixture.repository, fixture.worldId, "alpha-player", restoreRequest);
  ok(retry.world.revision === restored.world.revision, "replay of withdrawal mutated World revision");

  let staleRejected = false;
  try {
    await withdrawAlphaShowCreativeAmendment(fixture.repository, fixture.worldId, "alpha-player", {
      ...restoreRequest, requestId: "withdraw-new-stale-request",
    });
  } catch { staleRejected = true; }
  ok(staleRejected, "new withdrawal against already restored card was accepted");
});

await test("withdrawal restores prior wrestler approval when a declined new finish replaces its consent record", async () => {
  const fixture = await reservedShowFixture(61272);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  await materializePersistedCurrentWeekReservations(fixture.repository, fixture.worldId, before.world.revision);
  const ready = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const loserId = fixture.participantIds[1]!;
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const deal = aggregate.state.contracts.find((contract) =>
      contract.promotionId === ready.promotion.promotionId && contract.personId === loserId
      && contract.status === "SIGNED");
    if (!deal) throw new Error("missing original protected contract");
    deal.creativeControl = "PROTECTED_FINISHES";
    const person = aggregate.state.people.find((entry) => entry.id === loserId)!;
    person.morale = 100; person.fatigue = 0; person.priorities.loyalty = 100; person.priorities.role = 0;
  });
  const first = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "previously-approved-card",
    expectedRevision: ready.world.revision,
    expectedPlanVersion: ready.workspaceVersion,
    matches: singlesCard(fixture.participantIds).map((match, index) =>
      index === 0 ? { ...match, plannedFinish: "CLEAN_PIN" as const } : match),
    championshipAssignments: [],
  });
  ok(first.cardPendingConsent, "original clean loss should require approval");
  const accepted = await requestAlphaShowCreativeConsent(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "accept-original-loss",
    expectedRevision: first.world.revision,
    expectedPlanVersion: first.workspaceVersion,
    draftId: first.draftId,
    draftMatchId: first.matches[0]!.draftMatchId,
    personId: loserId,
  });
  ok(!accepted.cardPendingConsent
    && accepted.creativeConcerns.some((entry) => entry.personId === loserId && entry.consent === "APPROVED"),
    "first approved card did not become committed");

  const changed = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "amend-approved-loss",
    expectedRevision: accepted.world.revision,
    expectedPlanVersion: accepted.workspaceVersion,
    matches: accepted.matches.map((match, index) => index === 0
      ? { ...match, plannedLengthMinutes: match.plannedLengthMinutes + 2 } : match),
    championshipAssignments: [],
  });
  ok(changed.cardPendingConsent, "amended previously approved loss should require fresh consent");
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const person = aggregate.state.people.find((entry) => entry.id === loserId)!;
    person.morale = 0; person.fatigue = 100; person.priorities.loyalty = 0; person.priorities.role = 100;
  });
  const declined = await requestAlphaShowCreativeConsent(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "decline-new-version",
    expectedRevision: changed.world.revision,
    expectedPlanVersion: changed.workspaceVersion,
    draftId: changed.draftId,
    draftMatchId: changed.matches[0]!.draftMatchId,
    personId: loserId,
  });
  ok(declined.cardPendingConsent
    && declined.creativeConcerns.some((entry) => entry.personId === loserId && entry.consent === "DECLINED"),
    "changed booking was not refused");
  const restored = await withdrawAlphaShowCreativeAmendment(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "restore-agreed-old-loss",
    expectedRevision: declined.world.revision,
    expectedPlanVersion: declined.workspaceVersion,
    draftId: declined.draftId,
  });
  ok(!restored.cardPendingConsent, "old committed approval did not restore accepted status");
  ok(restored.creativeConcerns.some((entry) => entry.personId === loserId && entry.consent === "APPROVED"),
    "withdrawal discarded an approval the wrestler had already granted for the live card");
  ok(restored.matches[0]?.plannedLengthMinutes === accepted.matches[0]?.plannedLengthMinutes,
    "withdrawal left the declined match duration on the live draft");
});


await test("the 06:00 daily commitment lock discards only an unapproved amendment and retains its original show", async () => {
  const fixture = await reservedShowFixture(61291);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  await materializePersistedCurrentWeekReservations(fixture.repository, fixture.worldId, before.world.revision);
  const materialized = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const loserId = fixture.participantIds[1]!;
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const contract = aggregate.state.contracts.find((entry) => entry.personId === loserId
      && entry.promotionId === materialized.promotion.promotionId && entry.status === "SIGNED");
    if (!contract) throw new Error("missing protected wrestler contract");
    contract.creativeControl = "PROTECTED_FINISHES";
  });
  const committed = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "daily-commit-original",
    expectedRevision: materialized.world.revision,
    expectedPlanVersion: materialized.workspaceVersion,
    matches: singlesCard(fixture.participantIds).map((match, index) =>
      index === 0 ? { ...match, plannedFinish: "PROTECTED_FINISH" as const } : match),
    championshipAssignments: [],
  });
  ok(!committed.cardPendingConsent, "original safe booking unexpectedly needs permission");
  const beforeProposal = await fixture.repository.load(fixture.worldId);
  const eventId = beforeProposal.state.events.find((event) =>
    event.promotionId === committed.promotion.promotionId
    && event.status === "SCHEDULED"
    && event.date.week === beforeProposal.state.world.currentDate.week)!.id;
  const originalMatchIds = beforeProposal.state.matches.filter((match) =>
    match.eventId === eventId && match.status === "SCHEDULED").map((match) => match.id);

  const pending = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "daily-commit-proposal",
    expectedRevision: committed.world.revision,
    expectedPlanVersion: committed.workspaceVersion,
    matches: committed.matches.map((match, index) => index === 0
      ? { ...match, plannedFinish: "CLEAN_PIN" as const } : match),
    championshipAssignments: [],
  });
  ok(pending.cardPendingConsent, "pending contractual amendment was silently applied");
  const lock = await lockScheduledShowCommitments(fixture.repository, fixture.worldId, "2026-10-11");
  ok(lock.status === "COMMITTED", "daily commitment lock did not run");
  const afterCommit = await fixture.repository.load(fixture.worldId);
  ok(afterCommit.planning.pendingCardAmendments?.length === 0, "unapproved amendment survived commitment lock");
  ok(afterCommit.runtime.phase === "OPEN", "commitment phase incorrectly locked all World commands");
  const liveCard = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(!liveCard.cardPendingConsent && liveCard.matches[0]?.plannedFinish === "PROTECTED_FINISH",
    "World Lock changed the already-committed script instead of restoring it");
  ok(afterCommit.state.matches.filter((match) => match.eventId === eventId
    && match.status === "SCHEDULED").map((match) => match.id).join(":") === originalMatchIds.join(":"),
    "commitment lock replaced original match records");
  ok(afterCommit.state.ledger.filter((entry) =>
    entry.type === "PLANNED_SHOW_UNAPPROVED_AMENDMENT_IGNORED_AT_LOCK"
    && entry.entityIds.includes(eventId)).length === 1,
    "ignored card amendment has no unique factual history record");
  ok(!afterCommit.state.ledger.some((entry) =>
    entry.type === "PLANNED_SHOW_CREATIVE_STAFF_FALLBACK"
    && entry.entityIds.includes(committed.promotion.promotionId)),
    "complete materialized show incorrectly triggered a staff fallback");

  const resolved = await resolveScheduledWorldCycle(fixture.repository, fixture.worldId, "2026-10-11");
  ok(resolved.status === "RESOLVED", "scheduled World could not resolve the original card");
  const world = await fixture.repository.load(fixture.worldId);
  ok(world.state.events.find((entry) => entry.id === eventId)?.status === "COMPLETED",
    "the intact player-authored event failed to run");
  const notices = buildPlayerAttention(world, "alpha-player");
  ok(notices.some((notice) => notice.title === "Your original card ran"),
    "promoter did not receive the correct no-staff-takeover notice");
});

await test("a proposal saved after the 06:00 logistics lock is reconciled by the 08:00 World Lock", async () => {
  const fixture = await reservedShowFixture(61292);
  const before = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  await materializePersistedCurrentWeekReservations(fixture.repository, fixture.worldId, before.world.revision);
  const ready = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  const loserId = fixture.participantIds[1]!;
  await fixture.repository.transact(fixture.worldId, null, (aggregate) => {
    const contract = aggregate.state.contracts.find((entry) => entry.personId === loserId
      && entry.promotionId === ready.promotion.promotionId && entry.status === "SIGNED");
    if (!contract) throw new Error("missing match-rights contract");
    contract.creativeControl = "PROTECTED_FINISHES";
  });
  const original = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "post-commit-original",
    expectedRevision: ready.world.revision,
    expectedPlanVersion: ready.workspaceVersion,
    matches: singlesCard(fixture.participantIds).map((match, index) =>
      index === 0 ? { ...match, plannedFinish: "PROTECTED_FINISH" as const } : match),
    championshipAssignments: [],
  });
  await lockScheduledShowCommitments(fixture.repository, fixture.worldId, "2026-10-12");
  const afterCommit = await loadAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player");
  ok(afterCommit.canEdit, "current rules should still allow match-only edits after logistics lock");
  const proposal = await saveAlphaCurrentWeekCard(fixture.repository, fixture.worldId, "alpha-player", {
    requestId: "post-commit-pending-proposal",
    expectedRevision: afterCommit.world.revision,
    expectedPlanVersion: afterCommit.workspaceVersion,
    matches: original.matches.map((match, index) => index === 0
      ? { ...match, plannedFinish: "SUBMISSION" as const } : match),
    championshipAssignments: [],
  });
  ok(proposal.cardPendingConsent, "after-commit draft was not held for wrestler permission");

  // A human advance should not treat a complete committed card as unready.
  const result = await advanceAlphaWorldWeek(fixture.repository, fixture.worldId, "alpha-player", {
    expectedRevision: proposal.world.revision,
  });
  ok(result.world.currentDate.week === 2, "unapproved *amendment* blocked manual advance of complete card");
  const world = await fixture.repository.load(fixture.worldId);
  ok(world.planning.pendingCardAmendments?.length === 0, "final lock did not clear late amendment");
  ok(world.state.ledger.some((entry) => entry.type === "PLANNED_SHOW_UNAPPROVED_AMENDMENT_IGNORED_AT_LOCK"),
    "final lock did not record the ignored late amendment");
  ok(world.runtime.phase === "OPEN" && world.state.world.currentDate.day === 1,
    "after-lock manual resolution left an inconsistent simulated date");
});
console.log(`\nAlpha web card service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
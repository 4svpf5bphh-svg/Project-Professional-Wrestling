declare const process: { exitCode?: number };

import {
  assessDetailedShowReservation,
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockPersistedWorldForResolution,
  materializeCurrentWeekReservations,
  materializePersistedCurrentWeekReservations,
  reserveDetailedShowDraftCommand,
  resolvePersistedWorldWeek,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldAggregate,
  type DetailedShowDraft,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { comparePpwDates } from "../packages/sim-core/src/clock.js";
import { humanWeekReadiness } from "../packages/sim-core/src/human-routine.js";
import { createWorld, ensureWorldChampionships } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

const pending: Promise<void>[] = [];
function asyncTest(name: string, fn: () => Promise<void>): void {
  const promise = fn().then(() => {
    passed += 1;
    console.log(`PASS ${name}`);
  }).catch((error) => {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  });
  pending.push(promise);
}

function fixture(seed: number): ApplicationWorldAggregate & { promotionId: string; playerId: string } {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  const planning = createWorldPlanningState(state.world.id);
  const playerId = "player-a";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: `claim-${seed}`,
    worldId: state.world.id,
    playerId,
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  return { state, ownership, commands, runtime, planning, promotionId: promotion.id, playerId };
}

function contractCovers(
  f: ReturnType<typeof fixture>,
  contract: (typeof f.state.contracts)[number],
): boolean {
  const date = f.state.world.currentDate;
  return contract.status === "SIGNED"
    && comparePpwDates(date, contract.startDate, f.state.ruleset.weeksPerYear) >= 0
    && comparePpwDates(date, contract.endDate, f.state.ruleset.weeksPerYear) <= 0
    && contract.datesUsed < contract.dateEntitlement;
}

function reservableRoster(f: ReturnType<typeof fixture>): string[] {
  const required = f.state.ruleset.minEventParticipants % 2 === 0
    ? f.state.ruleset.minEventParticipants
    : f.state.ruleset.minEventParticipants + 1;
  const ids: string[] = [];
  for (const contract of f.state.contracts) {
    if (contract.promotionId !== f.promotionId || !contractCovers(f, contract)) continue;
    const person = f.state.people.find((candidate) => candidate.id === contract.personId);
    if (!person || person.status !== "ACTIVE" || ids.includes(person.id)) continue;
    ids.push(person.id);
    if (ids.length >= required) break;
  }
  if (ids.length < required) throw new Error("fixture lacks reservable human roster");
  return ids;
}

function baseDraft(f: ReturnType<typeof fixture>, draftId = "current-show"): DetailedShowDraft {
  const market = f.state.markets.find((candidate) => candidate.id === f.state.promotions.find((p) => p.id === f.promotionId)!.homeMarketId)!;
  const venue = f.state.venues.find((candidate) => candidate.marketId === market.id)!;
  return {
    draftId,
    promotionId: f.promotionId,
    targetDate: { ...f.state.world.currentDate, day: 5 },
    marketId: market.id,
    venueId: venue.id,
    ticketStrategy: "STANDARD",
    participantIds: reservableRoster(f),
    matches: [],
    championshipAssignments: [],
  };
}

function saveAndReserve(f: ReturnType<typeof fixture>, draft: DetailedShowDraft) {
  upsertDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: `save-${draft.draftId}`,
    worldId: f.state.world.id,
    playerId: f.playerId,
    commandType: "UPSERT_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotionId, expectedPlanVersion: 0, draft },
  });
  return reserveDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: `reserve-${draft.draftId}`,
    worldId: f.state.world.id,
    playerId: f.playerId,
    commandType: "RESERVE_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotionId, expectedPlanVersion: 1, draftId: draft.draftId },
  });
}

function completeSinglesCard(f: ReturnType<typeof fixture>, draft: DetailedShowDraft): DetailedShowDraft {
  const matches = [];
  for (let index = 0; index < draft.participantIds.length; index += 2) {
    matches.push({
      draftMatchId: `draft-match-${index / 2 + 1}`,
      type: "SINGLES" as const,
      sideAIds: [draft.participantIds[index]!],
      sideBIds: [draft.participantIds[index + 1]!],
      intendedWinnerSide: "A" as const,
      intent: index === draft.participantIds.length - 2 ? "EPIC" as const : "COMPETITIVE" as const,
      plannedLengthMinutes: index === draft.participantIds.length - 2 ? 24 : 12,
    });
  }
  ensureWorldChampionships(f.state);
  const championship = (f.state.championships ?? []).find(
    (candidate) => candidate.promotionId === f.promotionId && candidate.division === "SINGLES" && candidate.status === "ACTIVE",
  );
  if (!championship) throw new Error("fixture lacks singles championship");
  championship.currentReignId = null;
  return {
    ...draft,
    matches,
    championshipAssignments: [{ draftMatchId: matches[0]!.draftMatchId, championshipId: championship.id }],
  };
}

test("due reservation materializes exact show resources once and releases reservation claims", () => {
  const f = fixture(16101);
  const draft = baseDraft(f);
  const reservation = saveAndReserve(f, draft);
  const pass = materializeCurrentWeekReservations(f.state, f.planning);
  ok(pass.materialized.length === 1, "ready reservation did not materialize");
  ok(f.planning.showReservations.length === 0, "materialized reservation still claims scarce resources");
  const event = f.state.events.find((candidate) => candidate.id === pass.materialized[0]!.eventId)!;
  ok(event.venueId === reservation.venueId && event.marketId === reservation.marketId, "materialized logistics changed");
  ok(event.date.day === reservation.targetDate.day, "materialized show day changed");
  ok(event.ticketStrategy === reservation.ticketStrategy, "materialized ticket strategy changed");
  const appearances = f.state.scheduledAppearances.filter((appearance) => appearance.eventId === event.id);
  ok(appearances.length === reservation.participants.length, "materialized roster size changed");
  for (const participant of reservation.participants) {
    const appearance = appearances.find((candidate) => candidate.personId === participant.personId);
    ok(appearance?.contractId === participant.contractId, "materialization did not honor reserved contract date");
  }
  const eventsAfter = f.state.events.length;
  const retry = materializeCurrentWeekReservations(f.state, f.planning);
  ok(retry.materialized.length === 0 && f.state.events.length === eventsAfter, "materialization was not exactly once");
});

test("complete reserved card materializes match intent and valid championship designation", () => {
  const f = fixture(16102);
  const draft = completeSinglesCard(f, baseDraft(f));
  saveAndReserve(f, draft);
  const result = materializeCurrentWeekReservations(f.state, f.planning).materialized[0]!;
  ok(result.cardMaterialized, "complete advance card did not materialize");
  ok(result.matchIds.length === draft.matches.length, "materialized match count changed");
  const matches = result.matchIds.map((id) => f.state.matches.find((candidate) => candidate.id === id)!);
  ok(matches[matches.length - 1]!.intent === "EPIC", "advance match intent was not preserved");
  ok(matches.every((match) => match.intendedWinnerSide === "A"), "advance intended winners were not preserved");
  ok(result.championshipAssignmentsApplied === 1, "valid advance championship assignment was not applied");
});

test("segment-only talent remains reserved and materializes without being forced into a match", () => {
  const f = fixture(16122);
  const full = completeSinglesCard(f, baseDraft(f));
  const finalMatch = full.matches[full.matches.length - 1]!;
  const segmentOnlyIds = [...finalMatch.sideAIds, ...finalMatch.sideBIds];
  const retainedMatches = full.matches.slice(0, -1);
  const draft: DetailedShowDraft = {
    ...full,
    matches: retainedMatches,
    championshipAssignments: full.championshipAssignments.filter((assignment) => (
      retainedMatches.some((match) => match.draftMatchId === assignment.draftMatchId)
    )),
    segments: [{
      draftSegmentId: "segment-only-slot",
      type: "INTERVIEW",
      participantIds: segmentOnlyIds,
      programmeId: null,
      plannedLengthMinutes: 6,
    }],
    runningOrder: [
      ...retainedMatches.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
      { kind: "SEGMENT" as const, refId: "segment-only-slot" },
    ],
  };

  saveAndReserve(f, draft);
  const result = materializeCurrentWeekReservations(f.state, f.planning).materialized[0]!;
  ok(result.cardMaterialized, "segment-only appearance made an otherwise complete card incomplete");
  ok(result.matchIds.length === retainedMatches.length, "segment-only talent was incorrectly forced into another match");

  const event = f.state.events.find((candidate) => candidate.id === result.eventId)!;
  const appearances = f.state.scheduledAppearances.filter((appearance) => appearance.eventId === event.id);
  ok(
    segmentOnlyIds.every((personId) => appearances.some((appearance) => appearance.personId === personId)),
    "segment-only talent did not retain its committed show appearance",
  );
});

test("advance-booked style is rechecked at materialization when wrestler condition changes", () => {
  const f = fixture(16123);
  const draft = completeSinglesCard(f, baseDraft(f));
  const firstMatch = draft.matches[0]!;
  firstMatch.style = {
    competitiveness: 90,
    technical: 75,
    story: 55,
    intensity: 96,
    risk: 100,
    epic: 88,
  };
  firstMatch.plannedLengthMinutes = 42;
  const reservation = saveAndReserve(f, draft);
  const person = f.state.people.find((candidate) => candidate.id === firstMatch.sideAIds[0])!;
  person.fatigue = 88;
  person.wear = 82;
  person.skills.safety = Math.min(person.skills.safety, 42);
  person.skills.stamina = Math.min(person.skills.stamina, 44);

  const assessment = assessDetailedShowReservation(f.state, f.planning, reservation);
  ok(assessment.status === "AT_RISK", "new style refusal did not put the due reservation at risk");
  ok(assessment.reasons.includes("MATCH_STYLE_REFUSAL"), "reservation risk did not identify style refusal");

  const eventsBefore = f.state.events.length;
  const pass = materializeCurrentWeekReservations(f.state, f.planning);
  ok(pass.materialized.length === 0, "style-refused advance card materialized anyway");
  ok(pass.atRisk.some((entry) => entry.reservationId === reservation.reservationId), "style-refused reservation was not returned as at risk");
  ok(f.state.events.length === eventsBefore, "style refusal left a partial materialized event");
  ok(f.planning.showReservations.some((entry) => entry.reservationId === reservation.reservationId), "style-refused reservation was removed before player could edit it");
});

test("incomplete advance card still materializes the show and leaves card responsibility unresolved", () => {
  const f = fixture(16103);
  const draft = baseDraft(f);
  saveAndReserve(f, draft);
  const result = materializeCurrentWeekReservations(f.state, f.planning).materialized[0]!;
  ok(!result.cardMaterialized, "empty draft card unexpectedly materialized matches");
  ok(humanWeekReadiness(f.state, f.promotionId).status === "CARD_REQUIRED", "materialized show did not expose card readiness requirement");
});

test("day-five show materializes using an unchanged final-week day-one contract", () => {
  const f = fixture(16113);
  const draft = baseDraft(f);
  const chosen = f.state.contracts.find(contract =>
    contract.promotionId === f.promotionId && contract.personId === draft.participantIds[0]
    && contract.status === "SIGNED");
  if (!chosen) throw new Error("no available signed contract for materialization boundary");
  chosen.endDate = { ...f.state.world.currentDate, day: 1 };
  const reservation = saveAndReserve(f, draft);
  ok(reservation.participants.some(entry => entry.contractId === chosen.id),
    "reservation did not allocate legacy final-week contract to the wrestler");
  const assessment = assessDetailedShowReservation(f.state, f.planning, reservation);
  ok(assessment.status === "READY",
    "valid final-week contract was marked at risk at materialization: " + assessment.reasons.join(", "));
  const materialized = materializeCurrentWeekReservations(f.state, f.planning);
  ok(materialized.materialized.length === 1 && materialized.atRisk.length === 0,
    "day-five show failed materialization for an in-term final-week contract");
  ok(f.state.scheduledAppearances.some(appearance =>
    appearance.contractId === chosen.id && appearance.personId === chosen.personId),
    "final-week contracted appearance was not committed to the actual event");
  ok(chosen.endDate.day === 1 && chosen.endDate.week === f.state.world.currentDate.week,
    "materialization secretly extended a legacy signed contract");
});

test("broken wrestler availability classifies a due reservation as at risk without partial materialization", () => {
  const f = fixture(16104);
  const reservation = saveAndReserve(f, baseDraft(f));
  const person = f.state.people.find((candidate) => candidate.id === reservation.participants[0]!.personId)!;
  person.status = "INJURED";
  const assessment = assessDetailedShowReservation(f.state, f.planning, reservation);
  ok(assessment.status === "AT_RISK", "injured reserved wrestler did not put plan at risk");
  ok(assessment.reasons.includes("WRESTLER_UNAVAILABLE"), "at-risk reason did not identify wrestler availability");
  const eventsBefore = f.state.events.length;
  const pass = materializeCurrentWeekReservations(f.state, f.planning);
  ok(pass.materialized.length === 0 && pass.atRisk.length === 1, "at-risk reservation materialized anyway");
  ok(f.state.events.length === eventsBefore, "at-risk materialization left partial event state");
  ok(f.planning.showReservations.length === 1, "at-risk reservation was removed before lock");
});

test("an intervening completed live appearance makes a reserved debut unsafe without rewriting the booking", () => {
  const f = fixture(16154);
  const full = completeSinglesCard(f, baseDraft(f));
  const subject = full.participantIds[0]!;
  const debutSlot = "future-live-debut";
  const draft: DetailedShowDraft = {
    ...full,
    segments: [{
      draftSegmentId: debutSlot,
      type: "LIVE_APPEARANCE",
      participantIds: [subject],
      programmeId: null,
      plannedLengthMinutes: 4,
      liveAppearanceKind: "DEBUT",
      liveAppearanceObjective: "ESTABLISH_STAR",
    }],
    runningOrder: [
      { kind: "SEGMENT", refId: debutSlot },
      ...full.matches.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
    ],
  };
  const reservation = saveAndReserve(f, draft);
  const before = assessDetailedShowReservation(f.state, f.planning, reservation);
  ok(!before.reasons.includes("LIVE_APPEARANCE_HISTORY_CHANGED"),
    "newly reserved genuine debut was incorrectly flagged as historically impossible");

  // An earlier live angle actually completes AFTER the future card was saved.
  // Its date is earlier than the booked show, without occupying the same slot.
  const priorDate = { ...draft.targetDate, day: 2 };
  const eventId = "completed-prior-appearance-16154";
  f.state.events.push({
    id: eventId,
    worldId: f.state.world.id,
    promotionId: f.promotionId,
    marketId: draft.marketId!,
    venueId: draft.venueId!,
    date: priorDate,
    type: "MAJOR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 100, attendance: 100, ticketYield: 20,
    gateRevenue: 2000, totalCost: 1500, netResult: 500,
    eventImportance: 30, matchCount: 0, averageMatchRating: 0,
    bestMatchRating: 0, crowdResponse: 55,
  });
  f.state.ledger.push({
    id: "completed-prior-angle-16154",
    worldId: f.state.world.id,
    date: priorDate,
    order: f.state.ledger.length + 1,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [eventId],
    payload: { eventId, promotionId: f.promotionId,
      segmentType: "PROMO", participantIds: subject },
  });

  const after = assessDetailedShowReservation(f.state, f.planning, reservation);
  ok(after.status === "AT_RISK", "invalidated debut reservation was not marked at risk");
  ok(after.reasons.includes("LIVE_APPEARANCE_HISTORY_CHANGED"),
    "due reservation did not explain the historical arrival conflict");
  const pass = materializeCurrentWeekReservations(f.state, f.planning);
  ok(pass.materialized.length === 0 && pass.atRisk.length === 1,
    "stale authored debut was materialized as a false first appearance");
  ok(f.planning.showReservations.length === 1,
    "history conflict silently removed the reservation before the commitment lock");
  ok(f.planning.workspaces[0]?.detailedShowDrafts[0]?.segments?.[0]?.liveAppearanceKind === "DEBUT",
    "history conflict silently rewrote the promoter's scripted debut");
});

asyncTest("standalone persisted materialization commits event and advances World revision", async () => {
  const f = fixture(16105);
  saveAndReserve(f, baseDraft(f));
  const repo = new InMemoryApplicationWorldRepository();
  await repo.initialize(f);
  const beforeRevision = f.runtime.revision;
  const committed = await materializePersistedCurrentWeekReservations(repo, f.state.world.id, beforeRevision);
  ok(committed.pass.materialized.length === 1, "persisted pass did not materialize reservation");
  ok(committed.revision === beforeRevision + 1, "materialization did not advance World revision");
  const loaded = await repo.load(f.state.world.id);
  ok(loaded.planning.showReservations.length === 0, "persisted materialization retained reservation");
  ok(loaded.state.events.some((event) => event.promotionId === f.promotionId && event.status === "SCHEDULED"), "persisted materialization did not store event");
});

asyncTest("week lock releases unresolved at-risk reservation and Routine Continuity can run the week", async () => {
  const f = fixture(16106);
  const reservation = saveAndReserve(f, baseDraft(f));
  const person = f.state.people.find((candidate) => candidate.id === reservation.participants[0]!.personId)!;
  person.status = "INJURED";
  const repo = new InMemoryApplicationWorldRepository();
  await repo.initialize(f);
  const lockedRevision = await lockPersistedWorldForResolution(repo, f.state.world.id, f.runtime.revision);
  const locked = await repo.load(f.state.world.id);
  ok(locked.runtime.phase === "LOCKING", "World did not lock after reservation closure");
  ok(locked.planning.showReservations.length === 0, "at-risk reservation leaked through lock");
  ok(locked.state.ledger.some((entry) => entry.type === "PLANNED_SHOW_RESERVATION_RELEASED_AT_LOCK"), "lock did not record released at-risk plan");

  await resolvePersistedWorldWeek(repo, f.state.world.id, lockedRevision);
  const resolved = await repo.load(f.state.world.id);
  ok(resolved.runtime.phase === "OPEN", "World did not reopen after at-risk week");
  ok(resolved.state.ledger.some((entry) => entry.type === "HUMAN_ROUTINE_CONTINUITY_TAKEOVER"), "Routine Continuity did not cover unresolved show work");
});

await Promise.all(pending);


test("materialized planned show preserves its reserved calendar identity", () => {
  const f = fixture(74021);
  const due = f.state.showSeries?.find((series) => (
    series.promotionId === f.promotionId
    && series.active
    && series.anchorWeek === 0
  ));
  if (!due) throw new Error("materialization fixture has no current-week show identity");

  const contracts = f.state.contracts
    .filter((contract) => contract.promotionId === f.promotionId && contract.status === "SIGNED")
    .slice(0, f.state.ruleset.minEventParticipants);
  const participantIds = contracts.map((contract) => contract.personId);
  const promotion = f.state.promotions.find((candidate) => candidate.id === f.promotionId)!;
  const market = f.state.markets.find((candidate) => candidate.id === promotion.homeMarketId)!;
  const venue = f.state.venues.find((candidate) => candidate.marketId === market.id)!;
  const draft: DetailedShowDraft = {
    draftId: "calendar-materialize",
    promotionId: f.promotionId,
    showSeriesId: due.id,
    targetDate: { ...f.state.world.currentDate, day: 6 },
    marketId: market.id,
    venueId: venue.id,
    ticketStrategy: "STANDARD",
    participantIds,
    matches: [],
    championshipAssignments: [],
  };
  upsertDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: "calendar-materialize-draft",
    worldId: f.state.world.id,
    playerId: f.playerId,
    commandType: "UPSERT_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotionId, expectedPlanVersion: 0, draft },
  });
  const workspace = f.planning.workspaces.find((entry) => entry.promotionId === f.promotionId)!;
  const reservation = reserveDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: "calendar-materialize-reserve",
    worldId: f.state.world.id,
    playerId: f.playerId,
    commandType: "RESERVE_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotionId, expectedPlanVersion: workspace.version, draftId: draft.draftId },
  });
  ok(reservation.showSeriesId === due.id, "reservation lost its selected show identity");
  const pass = materializeCurrentWeekReservations(f.state, f.planning);
  const event = f.state.events.find((candidate) => candidate.id === pass.materialized[0]?.eventId);
  ok(event?.showSeriesId === due.id, "materialized event used a different show identity");
});

console.log(`\nApplication materialization tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

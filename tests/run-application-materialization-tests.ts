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
import { createWorld } from "../packages/sim-core/src/index.js";

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

test("incomplete advance card still materializes the show and leaves card responsibility unresolved", () => {
  const f = fixture(16103);
  const draft = baseDraft(f);
  saveAndReserve(f, draft);
  const result = materializeCurrentWeekReservations(f.state, f.planning).materialized[0]!;
  ok(!result.cardMaterialized, "empty draft card unexpectedly materialized matches");
  ok(humanWeekReadiness(f.state, f.promotionId).status === "CARD_REQUIRED", "materialized show did not expose card readiness requirement");
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
console.log(`\nApplication materialization tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

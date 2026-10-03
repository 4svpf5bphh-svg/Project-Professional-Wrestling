declare const process: { exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  releaseDetailedShowReservationCommand,
  reservationForDraft,
  reserveDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  type DetailedShowDraft,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { addPpwWeeks, comparePpwDates, ppwDateToWeekIndex } from "../packages/sim-core/src/clock.js";
import { createSignedContract } from "../packages/sim-core/src/contracts.js";
import { createWorld } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

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

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  const planning = createWorldPlanningState(state.world.id);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotions = state.promotions.filter(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  ).slice(0, 2);
  const promotionA = promotions[0]!;
  const promotionB = promotions[1]!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: `claim-a-${seed}`,
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotionA.id },
  });
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: `claim-b-${seed}`,
    worldId: state.world.id,
    playerId: "player-b",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotionB.id },
  });
  return { state, ownership, commands, runtime, planning, promotionA, promotionB };
}

function commonRequiredDate(f: ReturnType<typeof fixture>, day = 5) {
  for (let offset = 0; offset < 6; offset += 1) {
    const date = addPpwWeeks(f.state.world.currentDate, offset, f.state.ruleset.weeksPerYear);
    const index = ppwDateToWeekIndex(date, f.state.ruleset.weeksPerYear);
    if (
      index % Math.max(1, f.promotionA.eventCadenceWeeks) === 0
      && index % Math.max(1, f.promotionB.eventCadenceWeeks) === 0
    ) return { ...date, day };
  }
  throw new Error("fixture could not find common required show week inside detailed planning horizon");
}

function contractCovers(f: ReturnType<typeof fixture>, contract: (typeof f.state.contracts)[number], date: ReturnType<typeof commonRequiredDate>) {
  return contract.status === "SIGNED"
    && comparePpwDates(date, contract.startDate, f.state.ruleset.weeksPerYear) >= 0
    && comparePpwDates(date, contract.endDate, f.state.ruleset.weeksPerYear) <= 0
    && contract.datesUsed < contract.dateEntitlement;
}

function rosterFor(f: ReturnType<typeof fixture>, promotionId: string, date: ReturnType<typeof commonRequiredDate>) {
  const required = f.state.ruleset.minEventParticipants % 2 === 0
    ? f.state.ruleset.minEventParticipants
    : f.state.ruleset.minEventParticipants + 1;
  const ids: string[] = [];
  for (const contract of f.state.contracts) {
    if (contract.promotionId !== promotionId || !contractCovers(f, contract, date)) continue;
    const person = f.state.people.find((candidate) => candidate.id === contract.personId);
    if (!person || person.status !== "ACTIVE" || ids.includes(person.id)) continue;
    ids.push(person.id);
    if (ids.length >= required) break;
  }
  if (ids.length < required) throw new Error(`fixture lacks ${required} reservable wrestlers for ${promotionId}`);
  return ids;
}

function venuePair(f: ReturnType<typeof fixture>) {
  for (const market of f.state.markets) {
    const venues = f.state.venues.filter((venue) => venue.marketId === market.id);
    if (venues.length >= 2) return { market, first: venues[0]!, second: venues[1]! };
  }
  throw new Error("fixture lacks a market with two venues");
}

function draftFor(
  f: ReturnType<typeof fixture>,
  promotionId: string,
  date: ReturnType<typeof commonRequiredDate>,
  draftId: string,
  venueId?: string,
): DetailedShowDraft {
  const pair = venuePair(f);
  const venue = venueId ? f.state.venues.find((candidate) => candidate.id === venueId)! : pair.first;
  return {
    draftId,
    promotionId,
    targetDate: { ...date },
    marketId: venue.marketId,
    venueId: venue.id,
    ticketStrategy: "STANDARD",
    participantIds: rosterFor(f, promotionId, date),
    matches: [],
    championshipAssignments: [],
  };
}

function saveDraft(
  f: ReturnType<typeof fixture>,
  playerId: "player-a" | "player-b",
  promotionId: string,
  requestId: string,
  expectedPlanVersion: number,
  draft: DetailedShowDraft,
) {
  return upsertDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId,
    worldId: f.state.world.id,
    playerId,
    commandType: "UPSERT_DETAILED_SHOW_DRAFT",
    payload: { promotionId, expectedPlanVersion, draft },
  });
}

function reserve(
  f: ReturnType<typeof fixture>,
  playerId: "player-a" | "player-b",
  promotionId: string,
  requestId: string,
  expectedPlanVersion: number,
  draftId: string,
) {
  return reserveDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId,
    worldId: f.state.world.id,
    playerId,
    commandType: "RESERVE_DETAILED_SHOW_DRAFT",
    payload: { promotionId, expectedPlanVersion, draftId },
  });
}

test("reserving a detailed show commits scarce resources without creating simulation entities", () => {
  const f = fixture(16001);
  const date = commonRequiredDate(f);
  const draft = draftFor(f, f.promotionA.id, date, "show-a");
  saveDraft(f, "player-a", f.promotionA.id, "save-a", 0, draft);
  const eventsBefore = f.state.events.length;
  const matchesBefore = f.state.matches.length;
  const appearancesBefore = f.state.scheduledAppearances.length;
  const reservation = reserve(f, "player-a", f.promotionA.id, "reserve-a", 1, draft.draftId);

  ok(reservation.participants.length === draft.participantIds.length, "reservation did not bind every selected wrestler");
  ok(reservation.participants.every((entry) => entry.contractId.length > 0), "reservation did not bind contract dates");
  ok(f.planning.showReservations.length === 1, "reservation was not stored in application planning state");
  ok(f.state.events.length === eventsBefore, "reservation prematurely created an event");
  ok(f.state.matches.length === matchesBefore, "reservation prematurely created matches");
  ok(f.state.scheduledAppearances.length === appearancesBefore, "reservation prematurely created appearances");
});

test("incomplete draft logistics cannot reserve multiplayer resources", () => {
  const f = fixture(16002);
  const date = commonRequiredDate(f);
  const draft = { ...draftFor(f, f.promotionA.id, date, "show-a"), venueId: null, marketId: null };
  saveDraft(f, "player-a", f.promotionA.id, "save-incomplete", 0, draft);
  const revisionBefore = f.runtime.revision;
  let rejected = false;
  try {
    reserve(f, "player-a", f.promotionA.id, "reserve-incomplete", 1, draft.draftId);
  } catch {
    rejected = true;
  }
  ok(rejected, "incomplete logistics acquired a reservation");
  ok(f.planning.showReservations.length === 0, "failed reservation left resource state behind");
  ok(f.runtime.revision === revisionBefore, "failed reservation advanced World revision");
});

test("first committed reservation wins a venue/day conflict across human promotions", () => {
  const f = fixture(16003);
  const date = commonRequiredDate(f);
  const venue = venuePair(f).first;
  const draftA = draftFor(f, f.promotionA.id, date, "show-a", venue.id);
  const draftB = draftFor(f, f.promotionB.id, date, "show-b", venue.id);
  saveDraft(f, "player-a", f.promotionA.id, "save-a", 0, draftA);
  saveDraft(f, "player-b", f.promotionB.id, "save-b", 0, draftB);
  reserve(f, "player-a", f.promotionA.id, "reserve-a", 1, draftA.draftId);
  let rejected = false;
  try {
    reserve(f, "player-b", f.promotionB.id, "reserve-b", 1, draftB.draftId);
  } catch (error) {
    rejected = String(error).includes("venue is already reserved");
  }
  ok(rejected, "second promotion stole an already reserved venue/day");
  ok(f.planning.showReservations.length === 1, "failed competing reservation mutated shared reservation state");
});

test("the same wrestler cannot be reserved by two promotions on the same PPW day", () => {
  const f = fixture(16004);
  const date = commonRequiredDate(f);
  const pair = venuePair(f);
  const draftA = draftFor(f, f.promotionA.id, date, "show-a", pair.first.id);
  const sharedPersonId = draftA.participantIds[0]!;
  const sharedPerson = f.state.people.find((person) => person.id === sharedPersonId)!;
  createSignedContract(f.state, sharedPerson, f.promotionB, {
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "REGULAR",
    startDate: { ...f.state.world.currentDate },
    endDate: addPpwWeeks(f.state.world.currentDate, 12, f.state.ruleset.weeksPerYear),
    dateEntitlement: 2,
    weeklyGuarantee: 0,
    appearanceFee: 0,
    signingBonus: 0,
  }, null, false);
  const draftB = draftFor(f, f.promotionB.id, date, "show-b", pair.second.id);
  draftB.participantIds[0] = sharedPersonId;
  draftB.participantIds = [...new Set(draftB.participantIds)];
  while (draftB.participantIds.length < f.state.ruleset.minEventParticipants) {
    const candidate = rosterFor(f, f.promotionB.id, date).find((id) => !draftB.participantIds.includes(id));
    if (!candidate) throw new Error("fixture could not refill promotion B roster");
    draftB.participantIds.push(candidate);
  }
  if (draftB.participantIds.length % 2 !== 0) draftB.participantIds.push(rosterFor(f, f.promotionB.id, date).find((id) => !draftB.participantIds.includes(id))!);
  saveDraft(f, "player-a", f.promotionA.id, "save-a", 0, draftA);
  saveDraft(f, "player-b", f.promotionB.id, "save-b", 0, draftB);
  reserve(f, "player-a", f.promotionA.id, "reserve-a", 1, draftA.draftId);
  let rejected = false;
  try {
    reserve(f, "player-b", f.promotionB.id, "reserve-b", 1, draftB.draftId);
  } catch (error) {
    rejected = String(error).includes("already committed on that PPW day");
  }
  ok(rejected, "same wrestler was reserved twice on one PPW day");
});

test("draft edits do not silently move a reservation until explicitly refreshed", () => {
  const f = fixture(16005);
  const date = commonRequiredDate(f);
  const pair = venuePair(f);
  const draft = draftFor(f, f.promotionA.id, date, "show-a", pair.first.id);
  saveDraft(f, "player-a", f.promotionA.id, "save-a", 0, draft);
  reserve(f, "player-a", f.promotionA.id, "reserve-a", 1, draft.draftId);

  const edited: DetailedShowDraft = { ...draft, marketId: pair.second.marketId, venueId: pair.second.id };
  saveDraft(f, "player-a", f.promotionA.id, "edit-a", 1, edited);
  ok(reservationForDraft(f.planning, f.promotionA.id, draft.draftId)?.venueId === pair.first.id, "draft edit silently moved committed venue");

  const refreshed = reserve(f, "player-a", f.promotionA.id, "refresh-a", 2, draft.draftId);
  ok(refreshed.venueId === pair.second.id, "explicit reservation refresh did not acquire edited venue");
  ok(f.planning.showReservations.length === 1, "reservation refresh duplicated commitment");
});

test("releasing a reservation frees its venue for another human promotion", () => {
  const f = fixture(16006);
  const date = commonRequiredDate(f);
  const venue = venuePair(f).first;
  const draftA = draftFor(f, f.promotionA.id, date, "show-a", venue.id);
  const draftB = draftFor(f, f.promotionB.id, date, "show-b", venue.id);
  saveDraft(f, "player-a", f.promotionA.id, "save-a", 0, draftA);
  saveDraft(f, "player-b", f.promotionB.id, "save-b", 0, draftB);
  reserve(f, "player-a", f.promotionA.id, "reserve-a", 1, draftA.draftId);
  releaseDetailedShowReservationCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: "release-a",
    worldId: f.state.world.id,
    playerId: "player-a",
    commandType: "RELEASE_DETAILED_SHOW_RESERVATION",
    payload: { promotionId: f.promotionA.id, draftId: draftA.draftId },
  });
  const second = reserve(f, "player-b", f.promotionB.id, "reserve-b", 1, draftB.draftId);
  ok(second.venueId === venue.id, "released venue was not available to the second promotion");
  ok(f.planning.showReservations.length === 1, "release/reserve sequence left incorrect commitment count");
});

test("reservation commands are ownership-authorized and idempotent", () => {
  const f = fixture(16007);
  const date = commonRequiredDate(f);
  const draft = draftFor(f, f.promotionA.id, date, "show-a");
  saveDraft(f, "player-a", f.promotionA.id, "save-a", 0, draft);
  let foreignRejected = false;
  try {
    reserve(f, "player-b", f.promotionA.id, "foreign-reserve", 1, draft.draftId);
  } catch {
    foreignRejected = true;
  }
  ok(foreignRejected, "non-owner reserved another promotion's show");

  const first = reserve(f, "player-a", f.promotionA.id, "reserve-retry", 1, draft.draftId);
  const revision = f.runtime.revision;
  const receiptCount = f.commands.receipts.length;
  const second = reserve(f, "player-a", f.promotionA.id, "reserve-retry", 1, draft.draftId);
  ok(first.reservationId === second.reservationId, "idempotent retry returned a different reservation");
  ok(f.runtime.revision === revision, "idempotent reservation retry advanced World revision");
  ok(f.commands.receipts.length === receiptCount, "idempotent reservation retry duplicated receipt");
  ok(f.planning.showReservations.length === 1, "idempotent reservation retry duplicated commitment");
});

console.log(`\nApplication reservation tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

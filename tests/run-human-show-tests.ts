declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  claimIndependentPromotionForHuman,
  createWorld,
  humanWeekReadiness,
  planWorldEvents,
  prepareHumanMatchCard,
  prepareHumanShow,
  promotionShowOccurrencesBetween,
  promotionShowSeriesSlot,
  resolveWorldWeek,
  validatePromotionShowSeriesState,
} from "../packages/sim-core/src/index.js";

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

function fixture(seed: number): {
  state: WorldState;
  promotionId: string;
  participantIds: string[];
  marketId: string;
  venueId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionForHuman(state, promotion.id, { name: "Player Wrestling" });

  const participantIds = [...new Set(
    activeContractsForPromotion(state, promotion.id)
      .map((contract) => contract.personId)
      .filter((personId) => state.people.find((person) => person.id === personId)?.status === "ACTIVE"),
  )].slice(0, 10);
  ok(participantIds.length === 10, `expected 10 available wrestlers, found ${participantIds.length}`);

  const marketId = promotion.homeMarketId;
  const venues = state.venues
    .filter((venue) => venue.marketId === marketId)
    .sort((a, b) => a.capacity - b.capacity);
  const venueId = venues[1]?.id ?? venues[0]!.id;

  return { state, promotionId: promotion.id, participantIds, marketId, venueId };
}

test("human promoter can prepare a current-week show from real roster and venue choices", () => {
  const { state, promotionId, participantIds, marketId, venueId } = fixture(10901);

  const event = prepareHumanShow(state, {
    promotionId,
    marketId,
    venueId,
    day: 5,
    ticketStrategy: "STANDARD",
    participantIds,
  });

  ok(event.status === "SCHEDULED", "prepared show was not scheduled");
  ok(event.promotionId === promotionId, "prepared show belongs to the wrong promotion");
  ok(event.marketId === marketId && event.venueId === venueId, "player market/venue choices were not preserved");
  ok(event.date.day === 5, "player show-day choice was not preserved");
  ok(event.ticketStrategy === "STANDARD", "player ticket strategy was not preserved");
  ok(Boolean(event.showSeriesId), "prepared show did not retain its promotion-owned show identity");
  const showSeries = state.showSeries?.find((candidate) => candidate.id === event.showSeriesId);
  ok(showSeries?.promotionId === promotionId, "prepared show references another promotion's show identity");
  ok(event.type === showSeries?.eventType, "prepared show type did not come from its show identity");
  ok(event.eventImportance === showSeries?.eventImportance, "prepared show importance did not come from its show identity");
  ok(Boolean(event.showOccurrenceId), "prepared show did not retain its dated calendar occurrence identity");
  const occurrence = promotionShowOccurrencesBetween(state, state.world.currentDate, 1, promotionId)
    .find((candidate) => candidate.id === event.showOccurrenceId);
  ok(occurrence?.eventId === event.id, "calendar occurrence did not link back to the scheduled event");
  ok(occurrence?.day === 5 && occurrence.marketId === marketId && occurrence.venueId === venueId, "calendar occurrence did not pick up booked location/date");
  ok(occurrence?.status === "SCHEDULED", "calendar occurrence did not expose scheduled event status");
  ok(event.expectedDemand > 0 && event.ticketYield > 0, "prepared show has no economic preview");

  const appearances = state.scheduledAppearances.filter((appearance) => appearance.eventId === event.id);
  ok(appearances.length === participantIds.length, "not every selected wrestler was committed to the show");
  ok(appearances.every((appearance) => appearance.status === "COMMITTED"), "prepared appearances were not committed");
  ok(
    JSON.stringify(appearances.map((appearance) => appearance.personId)) === JSON.stringify(participantIds),
    "show preparation did not preserve the selected roster",
  );

  const ledgerEvent = state.ledger[state.ledger.length - 1]!;
  ok(ledgerEvent.type === "HUMAN_EVENT_PREPARED", "prepared show was not recorded in World history");
});

test("a fully prepared human show resolves inside the normal living-World week", () => {
  const { state, promotionId, participantIds, marketId, venueId } = fixture(10902);
  const datesBefore = new Map(
    activeContractsForPromotion(state, promotionId).map((contract) => [contract.id, contract.datesUsed]),
  );
  const event = prepareHumanShow(state, {
    promotionId,
    marketId,
    venueId,
    day: 4,
    ticketStrategy: "ACCESSIBLE",
    participantIds,
  });
  prepareHumanMatchCard(state, event.id, [
    { type: "SINGLES", sideAIds: [participantIds[0]!], sideBIds: [participantIds[1]!], intendedWinnerSide: "A", intent: "COMPETITIVE", plannedLengthMinutes: 12 },
    { type: "SINGLES", sideAIds: [participantIds[2]!], sideBIds: [participantIds[3]!], intendedWinnerSide: "B", intent: "STORY", plannedLengthMinutes: 11 },
    { type: "SINGLES", sideAIds: [participantIds[4]!], sideBIds: [participantIds[5]!], intendedWinnerSide: "A", intent: "TECHNICAL", plannedLengthMinutes: 15 },
    { type: "SINGLES", sideAIds: [participantIds[6]!], sideBIds: [participantIds[7]!], intendedWinnerSide: "B", intent: "SHOWCASE", plannedLengthMinutes: 10 },
    { type: "SINGLES", sideAIds: [participantIds[8]!], sideBIds: [participantIds[9]!], intendedWinnerSide: "A", intent: "EPIC", plannedLengthMinutes: 20 },
  ]);

  resolveWorldWeek(state);

  ok(event.status === "COMPLETED", `prepared human show finished as ${event.status}`);
  ok(event.matchCount === 5, "human show did not resolve its prepared match card");
  ok(event.attendance > 0 && event.gateRevenue > 0, "human show produced no live business result");
  ok(state.world.currentDate.week === 2, "World did not advance after resolving the prepared show");
  ok(
    state.financialTransactions.some((transaction) => transaction.category === "GATE_REVENUE" && transaction.source === event.id),
    "human show did not enter normal promotion finances",
  );
  ok(
    state.matches.some((match) => match.eventId === event.id),
    "human show did not enter normal match history",
  );

  const completedAppearances = state.scheduledAppearances.filter(
    (appearance) => appearance.eventId === event.id && appearance.status === "COMPLETED",
  );
  ok(completedAppearances.length >= state.ruleset.minEventParticipants, "human show used too few selected wrestlers");
  ok(completedAppearances.every((appearance) => {
    const contract = state.contracts.find((candidate) => candidate.id === appearance.contractId)!;
    return contract.datesUsed === (datesBefore.get(contract.id) ?? 0) + 1;
  }), "human show did not consume purchased contract dates exactly once");
});

test("ticket strategy creates a real human demand-versus-yield decision", () => {
  const accessible = fixture(10903);
  const prestige = fixture(10903);

  const accessibleEvent = prepareHumanShow(accessible.state, {
    promotionId: accessible.promotionId,
    marketId: accessible.marketId,
    venueId: accessible.venueId,
    day: 5,
    ticketStrategy: "ACCESSIBLE",
    participantIds: accessible.participantIds,
  });
  const prestigeEvent = prepareHumanShow(prestige.state, {
    promotionId: prestige.promotionId,
    marketId: prestige.marketId,
    venueId: prestige.venueId,
    day: 5,
    ticketStrategy: "PRESTIGE",
    participantIds: prestige.participantIds,
  });

  ok(accessibleEvent.expectedDemand > prestigeEvent.expectedDemand, "accessible pricing did not improve expected demand");
  ok(accessibleEvent.ticketYield < prestigeEvent.ticketYield, "premium pricing did not increase ticket yield");
});

test("human show preparation rejects wrestlers without a usable promotion contract", () => {
  const { state, promotionId, participantIds, marketId, venueId } = fixture(10904);
  const contracted = new Set(activeContractsForPromotion(state, promotionId).map((contract) => contract.personId));
  const outsider = state.people.find((person) => person.status === "ACTIVE" && !contracted.has(person.id))!;
  const invalidRoster = [...participantIds];
  invalidRoster[0] = outsider.id;

  let rejected = false;
  try {
    prepareHumanShow(state, {
      promotionId,
      marketId,
      venueId,
      day: 3,
      ticketStrategy: "STANDARD",
      participantIds: invalidRoster,
    });
  } catch {
    rejected = true;
  }
  ok(rejected, "an uncontracted wrestler could be committed to the human show");
  ok(state.events.length === 0, "invalid show preparation partially mutated the event list");
});

test("human promotion cannot prepare two shows for the same required week", () => {
  const { state, promotionId, participantIds, marketId, venueId } = fixture(10905);
  prepareHumanShow(state, {
    promotionId,
    marketId,
    venueId,
    day: 2,
    ticketStrategy: "STANDARD",
    participantIds,
  });

  let rejected = false;
  try {
    prepareHumanShow(state, {
      promotionId,
      marketId,
      venueId,
      day: 6,
      ticketStrategy: "STANDARD",
      participantIds,
    });
  } catch {
    rejected = true;
  }
  ok(rejected, "human promotion could prepare a second show in the same required week");
  ok(state.events.filter((event) => event.promotionId === promotionId).length === 1, "duplicate show mutated World state");
});



test("show calendar allows alternating regular identities but rejects same-slot collisions", () => {
  const state = createWorld(88221, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.lifecycle === "ACTIVE")!;
  const flagshipIndex = state.showSeries!.findIndex((series) => series.promotionId === promotion.id && series.role === "FLAGSHIP");
  const flagship = state.showSeries![flagshipIndex]!;
  state.showSeries![flagshipIndex] = { ...flagship, cadenceWeeks: 2, anchorWeek: 0 };

  const secondary = {
    ...flagship,
    id: `${flagship.id}:alternate`,
    name: `${promotion.name} Alternate`,
    role: "SECONDARY" as const,
    cadenceWeeks: 2,
    anchorWeek: 1,
  };
  state.showSeries!.push(secondary);

  let errors = validatePromotionShowSeriesState(state);
  ok(!errors.some((error) => error.includes("two regular show identities")), "alternating regular identities were incorrectly rejected");

  state.showSeries![state.showSeries!.length - 1] = { ...secondary, anchorWeek: 0 };
  errors = validatePromotionShowSeriesState(state);
  ok(errors.some((error) => error.includes("two regular show identities")), "same-week regular identity collision was not rejected");
});

test("human PPV week requires regular and special slots but never two normal shows", () => {
  const { state, promotionId, participantIds, marketId, venueId } = fixture(10915);
  const regular = state.showSeries!.find((series) => series.promotionId === promotionId && promotionShowSeriesSlot(series) === "REGULAR")!;
  const specialIndex = state.showSeries!.findIndex((series) => series.promotionId === promotionId && promotionShowSeriesSlot(series) === "SPECIAL");
  const special = state.showSeries![specialIndex]!;
  state.showSeries![specialIndex] = { ...special, cadenceWeeks: 52, anchorWeek: 0 };

  const regularRoster = participantIds.slice(0, 6);
  const specialRoster = participantIds.slice(4, 10);
  for (const personId of participantIds.slice(4, 6)) {
    const person = state.people.find((candidate) => candidate.id === personId)!;
    person.careerStage = "PRIME";
    person.skills.stamina = 100;
    person.fatigue = 0;
  }
  prepareHumanShow(state, {
    promotionId,
    showSeriesId: regular.id,
    marketId,
    venueId,
    day: 4,
    ticketStrategy: "STANDARD",
    participantIds: regularRoster,
  });
  ok(humanWeekReadiness(state, promotionId).status === "SHOW_REQUIRED", "one prepared slot incorrectly satisfied a two-show PPV week");

  const alternateVenue = state.venues.find((venue) => venue.marketId === marketId && venue.id !== venueId)?.id ?? venueId;
  prepareHumanShow(state, {
    promotionId,
    showSeriesId: special.id,
    marketId,
    venueId: alternateVenue,
    day: 7,
    ticketStrategy: "PREMIUM",
    participantIds: specialRoster,
  });
  ok(state.events.filter((event) => event.promotionId === promotionId).length === 2, "regular plus special show did not coexist");
  ok(humanWeekReadiness(state, promotionId).status === "CARD_REQUIRED", "both show slots were not recognised after preparation");

  let duplicateRegularRejected = false;
  try {
    prepareHumanShow(state, {
      promotionId,
      showSeriesId: regular.id,
      marketId,
      venueId,
      day: 5,
      ticketStrategy: "STANDARD",
      participantIds: regularRoster,
    });
  } catch {
    duplicateRegularRejected = true;
  }
  ok(duplicateRegularRejected, "a second regular show was allowed in the same PPW week");
});

test("AI scheduling creates at most one event per weekly slot even when planning is retried", () => {
  const state = createWorld(10916, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.controllerType === "AI" && candidate.lifecycle === "ACTIVE")!;
  const specialIndex = state.showSeries!.findIndex((series) => series.promotionId === promotion.id && promotionShowSeriesSlot(series) === "SPECIAL");
  const special = state.showSeries![specialIndex]!;
  state.showSeries![specialIndex] = { ...special, cadenceWeeks: 52, anchorWeek: 0 };

  planWorldEvents(state);
  const first = state.events.filter((event) => event.promotionId === promotion.id && event.status !== "CANCELLED");
  ok(first.length === 2, `expected regular + special AI shows, found ${first.length}`);
  ok(new Set(first.map((event) => event.date.day)).size === 2, "AI scheduled regular and special shows on the same PPW day");

  planWorldEvents(state);
  const second = state.events.filter((event) => event.promotionId === promotion.id && event.status !== "CANCELLED");
  ok(second.length === 2, "AI planning retry flooded the week with duplicate shows");
});



test("AI protects a capacity-one headliner for the Special show in a two-show week", () => {
  const state = createWorld(10917, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.controllerType === "AI" && candidate.lifecycle === "ACTIVE")!;
  const specialIndex = state.showSeries!.findIndex((series) => series.promotionId === promotion.id && promotionShowSeriesSlot(series) === "SPECIAL");
  const special = state.showSeries![specialIndex]!;
  state.showSeries![specialIndex] = { ...special, cadenceWeeks: 52, anchorWeek: 0 };

  const rosterIds = [...new Set(
    activeContractsForPromotion(state, promotion.id)
      .map((contract) => contract.personId)
      .filter((personId) => state.people.find((person) => person.id === personId)?.status === "ACTIVE"),
  )];
  const headliner = state.people.find((person) => person.id === rosterIds[0]);
  if (!headliner) throw new Error("AI priority fixture has no active contracted wrestler");
  headliner.careerStage = "SPECIAL_ATTRACTION";
  headliner.recognition = 100;
  headliner.popularity = 100;
  headliner.momentum = 100;
  headliner.skills.inRingQuality = 100;
  headliner.skills.matchCraft = 100;
  headliner.skills.presentation = 100;
  headliner.skills.stamina = 50;
  headliner.fatigue = 0;

  planWorldEvents(state);
  const events = state.events.filter((event) => event.promotionId === promotion.id && event.status !== "CANCELLED");
  const major = events.find((event) => event.type === "MAJOR");
  const regular = events.find((event) => event.type === "REGULAR");
  if (!major || !regular) throw new Error("AI priority fixture did not create both weekly slots");
  const majorIds = new Set(
    state.scheduledAppearances.filter((appearance) => appearance.eventId === major.id).map((appearance) => appearance.personId),
  );
  const regularIds = new Set(
    state.scheduledAppearances.filter((appearance) => appearance.eventId === regular.id).map((appearance) => appearance.personId),
  );

  ok(majorIds.has(headliner.id), "Special show did not receive the capacity-one headliner");
  ok(!regularIds.has(headliner.id), "Regular show consumed the capacity-one headliner before the Special show");
});

console.log(`\nHuman show tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

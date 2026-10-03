declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  claimIndependentPromotionForHuman,
  createWorld,
  prepareHumanMatchCard,
  prepareHumanShow,
  resolveWorldWeek,
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

console.log(`\nHuman show tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

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

async function fixture(seed: number) {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed, playerId: "alpha-player" });
  const independent = aggregate.state.promotions.find((promotion) => (
    promotion.playerTakeoverEligibility === "STANDARD" && promotion.lifecycle === "ACTIVE"
  ));
  if (!independent) throw new Error("test World has no active takeover-eligible promotion");
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

  const participantIds = sameDivisionParticipantIds(
    aggregate.state,
    promotion.roster.filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0),
    promotion.showPlanning.minParticipants,
    promotion.showPlanning.maxParticipants,
  );

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

for (const [finish, seed] of [["DISQUALIFICATION", 61103], ["FOREIGN_OBJECT", 61104]] as const) {
  await test(`booked ${finish} stays authored and appears in authoritative show history`, async () => {
    const setup = await fixture(seed);
    const before = await loadAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player");
    const card = singlesCard(setup.participantIds);
    card[0]!.plannedFinish = finish;
    const saved = await saveAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player", {
      requestId: `web-card-finish-${finish}`,
      expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion,
      matches: card,
      championshipAssignments: [],
    });
    ok(saved.matches[0]?.plannedFinish === finish, "card validation rewrote the authored finish");
    await advanceAlphaWorldWeek(setup.repository, setup.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const resolved = await setup.repository.load(setup.worldId);
    const show = resolved.state.events.find((event) =>
      event.promotionId === setup.promotionId && event.status === "COMPLETED")!;
    const match = resolved.state.matches.find((candidate) =>
      candidate.eventId === show.id && candidate.order === 1)!;
    ok(actualMatchFinish(match) === (match.finishChangedDueToInjury ? "INJURY_STOPPAGE" : finish),
      "resolution invented or silently reversed the player-authored finish");
    ok(match.actualWinnerSide === (match.finishChangedDueToInjury ? "B" : "A"),
      "cheating detection randomly reversed the booked winner");
    ok(resolved.state.ledger.some((entry) => entry.type === "MATCH_COMPLETED"
      && entry.entityIds[0] === match.id && entry.payload.actualFinish === actualMatchFinish(match)),
      "completed match history lost its recorded finish");
  });
}

for (const [finish, seed] of [["FOREIGN_OBJECT", 61121], ["DISQUALIFICATION", 61122]] as const) {
  await test(`tag-team ${finish} records the selected cheating wrestler, not an invented teammate`, async () => {
    const setup = await fixture(seed);
    const before = await loadAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player");
    const singles = singlesCard(setup.participantIds);
    const winnerIds = [setup.participantIds[0]!, setup.participantIds[1]!];
    const losingIds = [setup.participantIds[2]!, setup.participantIds[3]!];
    const culprit = finish === "DISQUALIFICATION" ? losingIds[1]! : winnerIds[1]!;
    const tag: AlphaCardMatchView = {
      ...singles[0]!, type: "TAG", sideAIds: winnerIds, sideBIds: losingIds,
      intendedWinnerSide: "A", plannedFinish: finish, finishCheaterPersonId: culprit,
    };
    const card = [tag, ...singles.slice(2)];
    let rejected = false;
    try {
      await saveAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player", {
        requestId: `tag-missing-cheater-${seed}`, expectedRevision: before.world.revision,
        expectedPlanVersion: before.workspaceVersion,
        matches: [{ ...tag, finishCheaterPersonId: null }, ...card.slice(1)],
        championshipAssignments: [],
      });
    } catch { rejected = true; }
    ok(rejected, "tag match accepted an unnamed cheating wrestler");
    rejected = false;
    try {
      await saveAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player", {
        requestId: `tag-wrong-cheater-${seed}`, expectedRevision: before.world.revision,
        expectedPlanVersion: before.workspaceVersion,
        matches: [{ ...tag, finishCheaterPersonId: finish === "DISQUALIFICATION" ? winnerIds[1] : losingIds[1] }, ...card.slice(1)],
        championshipAssignments: [],
      });
    } catch { rejected = true; }
    ok(rejected, "tag match credited cheating to wrestler on wrong side");
    const saved = await saveAlphaCurrentWeekCard(setup.repository, setup.worldId, "alpha-player", {
      requestId: `tag-identified-cheater-${seed}`, expectedRevision: before.world.revision,
      expectedPlanVersion: before.workspaceVersion, matches: card, championshipAssignments: [],
    });
    ok(saved.matches[0]?.finishCheaterPersonId === culprit, "Card did not save selected culprit");
    await advanceAlphaWorldWeek(setup.repository, setup.worldId, "alpha-player", {
      expectedRevision: saved.world.revision,
    });
    const resolved = await setup.repository.load(setup.worldId);
    const event = resolved.state.events.find((show) => show.promotionId === setup.promotionId && show.status === "COMPLETED")!;
    const match = resolved.state.matches.find((item) => item.eventId === event.id && item.order === 1)!;
    ok(match.finishCheaterPersonId === culprit, "authoritative match lost tag cheating attribution");
    const recorded = actualMatchFinish(match);
    const entry = resolved.state.ledger.find((item) => item.type === "MATCH_COMPLETED" && item.entityIds[0] === match.id);
    if (recorded === finish) {
      ok(entry?.payload.finishCheaterPersonId === culprit, "completed match ledger lost real culprit");
    } else {
      ok(recorded === "INJURY_STOPPAGE" && entry?.payload.finishCheaterPersonId === undefined,
        "injury stoppage falsely attributed a cheating finish");
    }
  });
}

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

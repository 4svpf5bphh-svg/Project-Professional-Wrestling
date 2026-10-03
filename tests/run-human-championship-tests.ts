declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { MatchIntent, MatchSide, MatchType } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  activeTeamMemberIds,
  bookHumanChampionshipMatch,
  claimIndependentPromotionForHuman,
  createWorld,
  ensureWorldChampionships,
  prepareHumanMatchCard,
  prepareHumanShow,
  resolveWorldWeek,
  unbookHumanChampionshipMatch,
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

function plan(
  type: MatchType,
  sideAIds: string[],
  sideBIds: string[],
  intendedWinnerSide: MatchSide,
  intent: MatchIntent,
  plannedLengthMinutes: number,
) {
  return { type, sideAIds, sideBIds, intendedWinnerSide, intent, plannedLengthMinutes };
}

function card(ids: string[]) {
  return [
    plan("SINGLES", [ids[0]!], [ids[1]!], "A", "COMPETITIVE", 11),
    plan("SINGLES", [ids[2]!], [ids[3]!], "B", "STORY", 13),
    plan("SINGLES", [ids[4]!], [ids[5]!], "A", "TECHNICAL", 17),
    plan("TAG", [ids[6]!, ids[7]!], [ids[8]!, ids[9]!], "B", "EPIC", 21),
  ];
}

function fixture(seed: number) {
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
  const venues = state.venues
    .filter((venue) => venue.marketId === promotion.homeMarketId)
    .sort((a, b) => a.capacity - b.capacity);
  const event = prepareHumanShow(state, {
    promotionId: promotion.id,
    marketId: promotion.homeMarketId,
    venueId: venues[1]?.id ?? venues[0]!.id,
    day: 5,
    ticketStrategy: "STANDARD",
    participantIds,
  });
  const matches = prepareHumanMatchCard(state, event.id, card(participantIds));
  ensureWorldChampionships(state);
  const singles = state.championships!.find(
    (championship) => championship.promotionId === promotion.id && championship.division === "SINGLES",
  )!;
  const tag = state.championships!.find(
    (championship) => championship.promotionId === promotion.id && championship.division === "TAG",
  )!;
  return { state, promotion, participantIds, event, matches, singles, tag };
}

test("human promoter can explicitly crown singles and tag champions from the booked card", () => {
  const { state, event, matches, singles, tag } = fixture(11201);
  const singlesMatch = matches[2]!;
  const tagMatch = matches[3]!;

  bookHumanChampionshipMatch(state, event.id, singlesMatch.id, singles.id);
  bookHumanChampionshipMatch(state, event.id, tagMatch.id, tag.id);
  ok(state.championshipMatchBookings?.length === 2, "live title bookings were not recorded before resolution");
  resolveWorldWeek(state);

  const singlesContest = state.championshipContests!.find(
    (contest) => contest.championshipId === singles.id && contest.matchId === singlesMatch.id,
  );
  const tagContest = state.championshipContests!.find(
    (contest) => contest.championshipId === tag.id && contest.matchId === tagMatch.id,
  );
  ok(Boolean(singlesContest), "booked singles championship match did not become a title contest");
  ok(Boolean(tagContest), "booked tag championship match did not become a title contest");
  ok(Boolean(singles.currentReignId), "singles championship did not crown a champion");
  ok(Boolean(tag.currentReignId), "tag championship did not crown champions");
  ok((state.championshipMatchBookings ?? []).length === 0, "resolved title bookings were retained as live planning state");

  const singlesParticipants = state.matchParticipants.filter((participant) => participant.matchId === singlesMatch.id);
  const singlesWinner = singlesParticipants.find((participant) => participant.side === singlesMatch.actualWinnerSide)!;
  ok(singlesContest!.winnerHolderId === singlesWinner.personId, "singles title lineage ignored the actual match winner");

  const tagWinnerIds = state.matchParticipants
    .filter((participant) => participant.matchId === tagMatch.id && participant.side === tagMatch.actualWinnerSide)
    .map((participant) => participant.personId)
    .sort();
  ok(
    JSON.stringify(activeTeamMemberIds(state, tagContest!.winnerHolderId).sort()) === JSON.stringify(tagWinnerIds),
    "tag title lineage ignored the actual winning team",
  );
});

test("human promotion receives no automatic title match without explicit designation", () => {
  const { state, event } = fixture(11202);
  event.type = "MAJOR";

  resolveWorldWeek(state);

  const contests = (state.championshipContests ?? []).filter((contest) => contest.eventId === event.id);
  ok(contests.length === 0, "human major event received an AI-selected championship contest");
});

test("championship division must match the manually booked match type", () => {
  const { state, event, matches, tag } = fixture(11203);
  let rejected = false;
  try {
    bookHumanChampionshipMatch(state, event.id, matches[0]!.id, tag.id);
  } catch {
    rejected = true;
  }
  ok(rejected, "tag championship could be assigned to a singles match");
  ok(
    !(state.championshipMatchBookings ?? []).some((booking) => booking.championshipId === tag.id),
    "rejected title booking partially mutated live booking state",
  );
  ok(
    !state.ledger.some((entry) => entry.type === "HUMAN_CHAMPIONSHIP_MATCH_BOOKED" && entry.payload.championshipId === tag.id),
    "rejected title booking partially mutated World history",
  );
});

test("reigning champion must be included in a manually booked defense", () => {
  const first = fixture(11204);
  bookHumanChampionshipMatch(first.state, first.event.id, first.matches[2]!.id, first.singles.id);
  resolveWorldWeek(first.state);
  const reign = first.state.championshipReigns!.find((candidate) => candidate.id === first.singles.currentReignId)!;
  ok(reign.holderType === "PERSON", "singles championship did not create a person reign");

  resolveWorldWeek(first.state);
  const championId = reign.holderId;
  const promotion = first.promotion;
  const available = [...new Set(
    activeContractsForPromotion(first.state, promotion.id)
      .map((contract) => contract.personId)
      .filter((personId) => first.state.people.find((person) => person.id === personId)?.status === "ACTIVE"),
  )];
  const nextIds = [championId, ...available.filter((personId) => personId !== championId)].slice(0, 10);
  ok(nextIds.length === 10, "expected enough wrestlers for the next human show");
  const venues = first.state.venues
    .filter((venue) => venue.marketId === promotion.homeMarketId)
    .sort((a, b) => a.capacity - b.capacity);
  const nextEvent = prepareHumanShow(first.state, {
    promotionId: promotion.id,
    marketId: promotion.homeMarketId,
    venueId: venues[1]?.id ?? venues[0]!.id,
    day: 5,
    ticketStrategy: "STANDARD",
    participantIds: nextIds,
  });
  const nextMatches = prepareHumanMatchCard(first.state, nextEvent.id, card(nextIds));
  const nonChampionMatch = nextMatches.find((match) => !first.state.matchParticipants.some(
    (participant) => participant.matchId === match.id && participant.personId === championId,
  ))!;

  let rejected = false;
  try {
    bookHumanChampionshipMatch(first.state, nextEvent.id, nonChampionMatch.id, first.singles.id);
  } catch {
    rejected = true;
  }
  ok(rejected, "championship defense could be booked without the reigning champion");
});

test("one championship and one match cannot be double-assigned on the same event", () => {
  const { state, event, matches, singles, tag } = fixture(11205);
  bookHumanChampionshipMatch(state, event.id, matches[2]!.id, singles.id);

  let sameTitleRejected = false;
  try {
    bookHumanChampionshipMatch(state, event.id, matches[1]!.id, singles.id);
  } catch {
    sameTitleRejected = true;
  }
  ok(sameTitleRejected, "same championship could be assigned to two matches on one event");

  let sameMatchRejected = false;
  try {
    bookHumanChampionshipMatch(state, event.id, matches[2]!.id, tag.id);
  } catch {
    sameMatchRejected = true;
  }
  ok(sameMatchRejected, "one match could be assigned to two championships");
});

test("unbooking and rebooking changes live title intent without rewriting history", () => {
  const { state, event, matches, singles } = fixture(11206);
  const firstMatch = matches[2]!;
  const replacementMatch = matches[1]!;

  bookHumanChampionshipMatch(state, event.id, firstMatch.id, singles.id);
  unbookHumanChampionshipMatch(state, event.id, singles.id);
  bookHumanChampionshipMatch(state, event.id, replacementMatch.id, singles.id);

  const live = state.championshipMatchBookings ?? [];
  ok(live.length === 1, `expected one live title booking after edit, found ${live.length}`);
  ok(live[0]!.matchId === replacementMatch.id, "replacement title match was not the live source of truth");
  ok(
    state.ledger.filter((entry) => entry.type === "HUMAN_CHAMPIONSHIP_MATCH_BOOKED" && entry.payload.championshipId === singles.id).length === 2,
    "historical booking decisions were rewritten instead of appended",
  );
  ok(
    state.ledger.some((entry) => entry.type === "HUMAN_CHAMPIONSHIP_MATCH_UNBOOKED" && entry.payload.championshipId === singles.id),
    "unbooking was not retained as historical audit output",
  );

  resolveWorldWeek(state);

  ok(
    state.championshipContests!.some((contest) => contest.championshipId === singles.id && contest.matchId === replacementMatch.id),
    "competition resolution ignored the replacement live title booking",
  );
  ok(
    !state.championshipContests!.some((contest) => contest.championshipId === singles.id && contest.matchId === firstMatch.id),
    "competition resolution incorrectly treated old Ledger history as live booking intent",
  );
  ok((state.championshipMatchBookings ?? []).length === 0, "resolved edited booking remained live after the event");
});

console.log(`\nHuman championship tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

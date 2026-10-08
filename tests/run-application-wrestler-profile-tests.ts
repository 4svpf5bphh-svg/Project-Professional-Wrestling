declare const process: { exitCode?: number };

import {
  buildPlayerWrestlerProfileView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { activeContractsForPromotion, createWorld } from "../packages/sim-core/src/index.js";

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
  aggregate: ApplicationWorldAggregate;
  promotionAId: string;
  promotionBId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotions = state.promotions.filter((promotion) => (
    promotion.controllerType === "AI"
    && promotion.tier === "INDEPENDENT"
    && promotion.lifecycle === "ACTIVE"
  )).slice(0, 2);
  if (promotions.length < 2) throw new Error("profile fixture needs two Independent promotions");
  claimIndependentPromotionForPlayer(state, ownership, "player-a", promotions[0]!.id);
  claimIndependentPromotionForPlayer(state, ownership, "player-b", promotions[1]!.id);
  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
    },
    promotionAId: promotions[0]!.id,
    promotionBId: promotions[1]!.id,
  };
}

test("wrestler profile exposes own roster relationship and own contract terms", () => {
  const { aggregate, promotionAId } = fixture(73101);
  const ownContract = activeContractsForPromotion(aggregate.state, promotionAId)[0];
  ok(ownContract, "fixture promotion has no active roster contract");
  ownContract!.weeklyGuarantee = 55_555_551;
  const person = aggregate.state.people.find((candidate) => candidate.id === ownContract!.personId);
  ok(person, "own roster person is missing");
  person!.morale = 67;
  person!.fatigue = 23;
  person!.wear = 31;

  const view = buildPlayerWrestlerProfileView(aggregate, "player-a", ownContract!.personId);
  ok(view.relationship?.employmentStatus === "OUR_ROSTER", "own wrestler was not identified as our roster");
  ok(view.relationship?.ourContract?.weeklyGuarantee === 55_555_551, "own contract money was not visible");
  ok(view.relationship?.morale === 67, "own wrestler morale was not visible");
  ok(view.relationship?.fatigue === 23, "own wrestler fatigue was not visible");
  ok(view.relationship?.wear === 31, "own wrestler Wear was not visible");
});

test("wrestler profile does not leak a rival's private contract or internal condition", () => {
  const { aggregate, promotionAId, promotionBId } = fixture(73102);
  const ownPeople = new Set(activeContractsForPromotion(aggregate.state, promotionAId).map((contract) => contract.personId));
  const rivalContract = activeContractsForPromotion(aggregate.state, promotionBId)
    .find((contract) => !ownPeople.has(contract.personId));
  ok(rivalContract, "fixture has no rival-only contract");
  rivalContract!.family = "EXCLUSIVE";
  rivalContract!.exclusivity = "EXCLUSIVE";
  rivalContract!.weeklyGuarantee = 999_888_777;
  rivalContract!.appearanceFee = 888_777_666;
  const rival = aggregate.state.people.find((person) => person.id === rivalContract!.personId);
  ok(rival, "rival wrestler is missing");
  rival!.morale = 13;
  rival!.fatigue = 87;
  rival!.wear = 79;

  const view = buildPlayerWrestlerProfileView(aggregate, "player-a", rivalContract!.personId);
  ok(view.relationship?.employmentStatus === "EXCLUSIVE_ELSEWHERE", "rival exclusive employment was not represented safely");
  ok(view.relationship?.ourContract === null, "rival contract was exposed as our contract");
  ok(view.relationship?.morale === null && view.relationship?.fatigue === null && view.relationship?.wear === null, "rival internal condition leaked");
  const serialized = JSON.stringify(view);
  ok(!serialized.includes("999888777"), "rival weekly guarantee leaked into profile");
  ok(!serialized.includes("888777666"), "rival appearance fee leaked into profile");
  ok(!serialized.includes(rivalContract!.id), "rival contract ID leaked into profile");
});

test("wrestler profile derives team, championship and recent match history from existing World records", () => {
  const { aggregate, promotionAId } = fixture(73103);
  const ownContract = activeContractsForPromotion(aggregate.state, promotionAId)[0];
  ok(ownContract, "fixture promotion has no active roster contract");
  const personId = ownContract!.personId;
  const partner = aggregate.state.people.find((person) => person.id !== personId && person.status !== "RETIRED");
  const opponent = aggregate.state.people.find((person) => person.id !== personId && person.id !== partner?.id && person.status !== "RETIRED");
  ok(partner && opponent, "fixture needs partner and opponent wrestlers");
  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === promotionAId);
  ok(promotion, "fixture promotion is missing");
  const venue = aggregate.state.venues.find((candidate) => candidate.marketId === promotion!.homeMarketId);
  ok(venue, "fixture promotion has no home-market venue");

  aggregate.state.teams = aggregate.state.teams ?? [];
  aggregate.state.teamMemberships = aggregate.state.teamMemberships ?? [];
  aggregate.state.championships = aggregate.state.championships ?? [];
  aggregate.state.championshipReigns = aggregate.state.championshipReigns ?? [];
  aggregate.state.championshipContests = aggregate.state.championshipContests ?? [];
  aggregate.state.teams.push({
    id: "profile-team",
    worldId: aggregate.state.world.id,
    name: "Profile Test Team",
    status: "ACTIVE",
    formedDate: { ...aggregate.state.world.currentDate },
    disbandedDate: null,
  });
  aggregate.state.teamMemberships.push(
    {
      id: "profile-member-a",
      worldId: aggregate.state.world.id,
      teamId: "profile-team",
      personId,
      joinedDate: { ...aggregate.state.world.currentDate },
      leftDate: null,
      active: true,
    },
    {
      id: "profile-member-b",
      worldId: aggregate.state.world.id,
      teamId: "profile-team",
      personId: partner!.id,
      joinedDate: { ...aggregate.state.world.currentDate },
      leftDate: null,
      active: true,
    },
  );
  aggregate.state.championships.push({
    id: "profile-title",
    worldId: aggregate.state.world.id,
    promotionId: promotionAId,
    name: "Profile Tag Championship",
    division: "TAG",
    status: "ACTIVE",
    prestige: 50,
    currentReignId: "profile-reign",
    createdDate: { ...aggregate.state.world.currentDate },
  });
  aggregate.state.championshipReigns.push({
    id: "profile-reign",
    worldId: aggregate.state.world.id,
    championshipId: "profile-title",
    holderType: "TEAM",
    holderId: "profile-team",
    status: "ACTIVE",
    startDate: { ...aggregate.state.world.currentDate },
    endDate: null,
    wonMatchId: "profile-match",
    lostMatchId: null,
    defenses: 2,
    endReason: null,
  });
  aggregate.state.events.push({
    id: "profile-event",
    worldId: aggregate.state.world.id,
    promotionId: promotionAId,
    marketId: promotion!.homeMarketId,
    venueId: venue!.id,
    date: { ...aggregate.state.world.currentDate },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 100,
    attendance: 90,
    ticketYield: 25,
    gateRevenue: 2_250,
    totalCost: 1_000,
    netResult: 1_250,
    eventImportance: 50,
    matchCount: 1,
    averageMatchRating: 4.25,
    bestMatchRating: 4.25,
    crowdResponse: 81,
  });
  aggregate.state.matches.push({
    id: "profile-match",
    worldId: aggregate.state.world.id,
    eventId: "profile-event",
    promotionId: promotionAId,
    order: 1,
    type: "TAG",
    status: "COMPLETED",
    intent: "COMPETITIVE",
    plannedLengthMinutes: 15,
    actualLengthMinutes: 16,
    intendedWinnerSide: "A",
    actualWinnerSide: "A",
    finishChangedDueToInjury: false,
    executionQuality: 84,
    criticalRatingStars: 4.25,
    crowdResponse: 81,
  });
  aggregate.state.matchParticipants.push(
    { id: "profile-participant-a", worldId: aggregate.state.world.id, matchId: "profile-match", eventId: "profile-event", personId, side: "A", won: true },
    { id: "profile-participant-b", worldId: aggregate.state.world.id, matchId: "profile-match", eventId: "profile-event", personId: partner!.id, side: "A", won: true },
    { id: "profile-participant-c", worldId: aggregate.state.world.id, matchId: "profile-match", eventId: "profile-event", personId: opponent!.id, side: "B", won: false },
  );
  aggregate.state.championshipContests.push({
    id: "profile-contest",
    worldId: aggregate.state.world.id,
    championshipId: "profile-title",
    matchId: "profile-match",
    eventId: "profile-event",
    date: { ...aggregate.state.world.currentDate },
    previousHolderId: null,
    winnerHolderId: "profile-team",
    titleChanged: true,
  });

  const view = buildPlayerWrestlerProfileView(aggregate, "player-a", personId);
  ok(view.activeTeams.some((team) => team.teamId === "profile-team" && team.partners.includes(partner!.name)), "active team/partner did not appear on profile");
  ok(view.currentChampionships.some((title) => title.championshipId === "profile-title" && title.defenses === 2), "current team championship did not appear on profile");
  const recent = view.recentMatches.find((match) => match.matchId === "profile-match");
  ok(recent?.won === true, "recent match result did not record the win");
  ok(recent?.partners.includes(partner!.name), "recent tag partner did not appear");
  ok(recent?.opponents.includes(opponent!.name), "recent opponent did not appear");
  ok(recent?.championshipNames.includes("Profile Tag Championship"), "recent title match did not identify the championship");
  ok(view.careerStats.completedMatches >= 1 && view.careerStats.wins >= 1 && view.careerStats.tagMatches >= 1, "career match stats were not derived from match history");
});

test("wrestler profile rejects unknown wrestlers and non-members", () => {
  const { aggregate } = fixture(73104);
  let unknownRejected = false;
  try {
    buildPlayerWrestlerProfileView(aggregate, "player-a", "missing-wrestler");
  } catch (error) {
    unknownRejected = error instanceof Error && error.message.includes("unknown wrestler");
  }
  ok(unknownRejected, "unknown wrestler profile did not reject");

  const known = aggregate.state.people[0];
  ok(known, "fixture has no wrestlers");
  let strangerRejected = false;
  try {
    buildPlayerWrestlerProfileView(aggregate, "stranger", known!.id);
  } catch (error) {
    strangerRejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(strangerRejected, "non-member could read wrestler profile");
});

console.log(`\nApplication wrestler-profile tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

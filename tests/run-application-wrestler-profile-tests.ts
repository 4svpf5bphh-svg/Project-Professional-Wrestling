declare const process: { exitCode?: number };

import {
  buildPlayerWrestlerProfileView,
  cloneApplicationWorld,
  createWorldEngagementState,
  setWrestlerCreativeProfileCommand,
  wrestlerCreativeProfileFor,
  defaultWrestlerCreativeFields,
  wrestlerCreativeInterestFor,
  wrestlerCreativeInterestScores,
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
  ok(view.relationship?.bookingEvidence?.contractId === ownContract!.id
    && view.relationship?.bookingEvidence?.roleExpectation === ownContract!.roleExpectation,
    "own wrestler expectation evidence not available on their profile");
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
  ok(view.relationship?.bookingEvidence === null, "a rival's private contract-role expectations leaked");
  ok(view.person.baselinePresentation.ringName === rival!.name
    && view.person.baselinePresentation.gimmickArchetype === "AUTHENTIC"
    && view.person.baselinePresentation.finishingMove === null,
    "all wrestlers need a neutral public presentation without invented finishing moves");
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


test("Creative gimmicks and finishers are promotion-scoped, persistent and have no sim effect", () => {
  const { aggregate, promotionAId, promotionBId } = fixture(73120);
  const contract = activeContractsForPromotion(aggregate.state,promotionAId)[0]!;
  const person = aggregate.state.people.find((entry)=>entry.id===contract.personId)!;
  const beforeState = JSON.stringify(aggregate.state);
  const original = defaultWrestlerCreativeFields(person);
  const next = { ...original,
    ringName:"The Midnight Mechanic",
    gimmickArchetype:"MYSTERY" as const,
    gimmickDescription:"A calculating ring general with unfinished business.",
    primaryStyle:"TECHNICAL" as const,
    secondaryStyle:"STRIKER" as const,
    signatureMove:{name:"Midnight Driver",category:"GRAPPLE" as const},
    finishingMove:{name:"Final Chapter",category:"SUBMISSION" as const},
  };
  aggregate.engagement=createWorldEngagementState(aggregate.state.world.id);
  const args=[aggregate.state,aggregate.engagement,aggregate.ownership,aggregate.commands,aggregate.runtime] as const;
  const command={requestId:"character-first-edit",worldId:aggregate.state.world.id,playerId:"player-a",
    commandType:"SET_WRESTLER_CREATIVE_PROFILE" as const,
    payload:{promotionId:promotionAId,personId:person.id,fields:next}};
  const record=setWrestlerCreativeProfileCommand(...args,command);
  ok(record?.history.length===1 && record.fields.finishingMove?.name==="Final Chapter","first edit not stored");
  ok(JSON.stringify(aggregate.state)===beforeState,"aesthetic changes modified authoritative simulation state");
  const view=buildPlayerWrestlerProfileView(aggregate,"player-a",person.id);
  ok(view.creativeProfile?.fields.ringName==="The Midnight Mechanic"
    && view.creativeProfile.fields.signatureMove?.name==="Midnight Driver"
    && view.creativeProfile.history.length===1, "profile did not expose editable presentation and history");
  const rivalView=buildPlayerWrestlerProfileView(aggregate,"player-b",person.id);
  ok(rivalView.creativeProfile===null || rivalView.creativeProfile.promotionId===promotionBId,
    "rival controller could see our promotion's internal character-edit history");
  ok(wrestlerCreativeProfileFor(aggregate.engagement,promotionBId,person).ringName===person.name,
    "one promotion's ring name overwrote the rival presentation");
  const revision=aggregate.runtime.revision;
  setWrestlerCreativeProfileCommand(...args,command);
  ok(aggregate.runtime.revision===revision
    && aggregate.engagement.wrestlerCreativeProfiles?.[0]?.history.length===1,
    "retry duplicated the same edit or changed World revision");
  const saved=cloneApplicationWorld(aggregate);
  const restored=buildPlayerWrestlerProfileView(saved,"player-a",person.id);
  ok(restored.creativeProfile?.fields.finishingMove?.name==="Final Chapter"
    && restored.creativeProfile.history[0]?.previous.ringName===person.name,
    "character changes did not survive a persistent World roundtrip");
});

test("Creative presentation requires control and an actual current roster contract", () => {
  const {aggregate,promotionAId,promotionBId}=fixture(73121);
  const contract=activeContractsForPromotion(aggregate.state,promotionAId)[0]!;
  aggregate.engagement=createWorldEngagementState(aggregate.state.world.id);
  const args=[aggregate.state,aggregate.engagement,aggregate.ownership,aggregate.commands,aggregate.runtime] as const;
  const fields=defaultWrestlerCreativeFields(aggregate.state.people.find(p=>p.id===contract.personId)!);
  const checks=[
    {playerId:"player-b",promotionId:promotionAId,personId:contract.personId},
    {playerId:"player-a",promotionId:promotionBId,personId:contract.personId},
    {playerId:"player-a",promotionId:promotionAId,personId:"wrestler-does-not-exist"},
  ];
  for (const [index,entry] of checks.entries()) {
    let denied=false;
    try{setWrestlerCreativeProfileCommand(...args,{
      requestId:"reject-creative-"+index,worldId:aggregate.state.world.id,playerId:entry.playerId,
      commandType:"SET_WRESTLER_CREATIVE_PROFILE",
      payload:{promotionId:entry.promotionId,personId:entry.personId,fields},
    });}catch{denied=true;}
    ok(denied,"unauthorised creative edit succeeded");
  }
  const existing=aggregate.state.people.find(p=>p.id===contract.personId)!;
  let deniedInvalid=false;
  try{setWrestlerCreativeProfileCommand(...args,{
    requestId:"reject-same-style",worldId:aggregate.state.world.id,playerId:"player-a",
    commandType:"SET_WRESTLER_CREATIVE_PROFILE",
    payload:{promotionId:promotionAId,personId:existing.id,fields:{...fields,secondaryStyle:fields.primaryStyle}},
  });}catch{deniedInvalid=true;}
  ok(deniedInvalid,"invalid secondary style was saved");
  ok(aggregate.engagement.wrestlerCreativeProfiles?.length===0,"failed edits left partial records");
});


test("Mic ability and backstage tendency are deterministic, independent descriptive foundations",()=>{
  const {aggregate,promotionAId,promotionBId}=fixture(73141);
  const wrestler=activeContractsForPromotion(aggregate.state,promotionAId)[0]!;
  const original=JSON.stringify(aggregate.state);
  const one=buildPlayerWrestlerProfileView(aggregate,"player-a",wrestler.personId);
  const p=one.person.personality;
  ok(p.microphoneAbility>=0&&p.microphoneAbility<=100&&p.microphoneSource==="ESTIMATED",
    "historical roster lacks a bounded seeded microphone estimate");
  ok(p.motivations.length===2&&p.motivations[0]!==p.motivations[1],
    "backstage persona incorrectly reused identical priorities");
  const cloned=cloneApplicationWorld(aggregate);
  const again=buildPlayerWrestlerProfileView(cloned,"player-b",wrestler.personId);
  ok(JSON.stringify(again.person.personality)===JSON.stringify(p),
    "global wrestler persona differs between multiplayer viewers or restored save");
  ok(JSON.stringify(aggregate.state)===original,
    "wrestler profile derived stats mutated simulation or persistent state");
  const person=aggregate.state.people.find(x=>x.id===wrestler.personId)!;
  person.microphoneAbility=93;
  person.backstageTemperament="COLLABORATIVE";
  const curated=buildPlayerWrestlerProfileView(aggregate,"player-a",wrestler.personId).person.personality;
  ok(curated.microphoneAbility===93&&curated.microphoneSource==="CURATED"
    && curated.temperament==="COLLABORATIVE"&&curated.temperamentSource==="CURATED",
    "explicit talent overrides were ignored");
  person.microphoneAbility=Number.NaN;
  person.backstageTemperament="NOT_A_TEMPERAMENT" as typeof person.backstageTemperament;
  const fallback=buildPlayerWrestlerProfileView(aggregate,"player-a",wrestler.personId).person.personality;
  ok(fallback.microphoneSource==="ESTIMATED"&&fallback.temperamentSource==="DERIVED",
    "corrupted overrides should fall back rather than presenting invalid ratings");
  void promotionBId;
});


test("Creative interests use existing priorities, are stable across viewers and never change the World",()=>{
  const {aggregate,promotionAId}=fixture(73170);
  const own=activeContractsForPromotion(aggregate.state,promotionAId)[0]!;
  const person=aggregate.state.people.find(p=>p.id===own.personId)!;
  const before=JSON.stringify(aggregate.state);
  const left=buildPlayerWrestlerProfileView(aggregate,"player-a",person.id);
  const right=buildPlayerWrestlerProfileView(aggregate,"player-b",person.id);
  ok(left.person.creativeInterests.topInterests.length===2
    && new Set(left.person.creativeInterests.topInterests).size===2
    && left.person.creativeInterests.origin==="DERIVED",
    "initial roster has missing or duplicated creative interests");
  ok(JSON.stringify(left.person.creativeInterests)===JSON.stringify(right.person.creativeInterests)
    && JSON.stringify(left.person.creativeInterests)===
      JSON.stringify(buildPlayerWrestlerProfileView(cloneApplicationWorld(aggregate),"player-a",person.id)
        .person.creativeInterests),
    "same wrestler's fictional interests changed across controller or reload");
  ok(JSON.stringify(aggregate.state)===before,"read-only preferences mutated the World");
  const changed=structuredClone(person);
  changed.priorities.loyalty=100;
  changed.priorities.schedule=100;
  changed.backstageTemperament="COLLABORATIVE";
  ok(wrestlerCreativeInterestFor(changed).topInterests.includes("TEAM_PARTNERSHIPS")
    && wrestlerCreativeInterestScores(changed).TEAM_PARTNERSHIPS >
      wrestlerCreativeInterestScores(changed).CHARACTER_REINVENTION,
    "booker's expected teamwork interest wasn't grounded in persona and priorities");
});


test("Wrestler profiles expose only controller-owned Backstage history, including named partners",()=>{
  const {aggregate,promotionAId,promotionBId}=fixture(73182);
  aggregate.engagement=createWorldEngagementState(aggregate.state.world.id);
  const contract=activeContractsForPromotion(aggregate.state,promotionAId)[0]!;
  const person=aggregate.state.people.find(x=>x.id===contract.personId)!;
  const partner=aggregate.state.people.find(x=>x.id!==person.id)!;
  const day={...aggregate.state.world.currentDate};
  const base={
    worldId:aggregate.state.world.id,wrestlerId:person.id,sourceContractId:contract.id,
    createdDate:day,status:"OPEN" as const,response:null,responseDate:null,
    promisedRole:"MAIN_EVENT" as const,observedMatchShows:4,observedFeaturedShows:0,
    kind:"ROLE_USAGE_CONCERN" as const,
  };
  const ours=openBackstageConversation(aggregate.engagement,{
    ...base,conversationId:"profile-private-owner-a",promotionId:promotionAId,
  });
  const theirs=openBackstageConversation(aggregate.engagement,{
    ...base,conversationId:"profile-private-owner-b",promotionId:promotionBId,
  });
  ok(ours.continuity?.priorAnsweredCount===0&&theirs.continuity?.priorAnsweredCount===0,
    "two promotions share their private booker history");
  const a=buildPlayerWrestlerProfileView(aggregate,"player-a",person.id);
  const b=buildPlayerWrestlerProfileView(aggregate,"player-b",person.id);
  ok(a.backstageHistory.length===1&&a.backstageHistory[0]?.conversationId===ours.conversationId
    && b.backstageHistory.length===1&&b.backstageHistory[0]?.conversationId===theirs.conversationId,
    "other controller's conversation leaked through public wrestler card");
  const partnerEntry=openBackstageConversation(aggregate.engagement,{
    conversationId:"profile-partner-history",promotionId:promotionAId,
    worldId:aggregate.state.world.id,wrestlerId:partner.id,
    sourceContractId:contract.id,partnerPersonId:person.id,
    createdDate:day,status:"NOTED",response:null,responseDate:null,
    promisedRole:null,observedMatchShows:0,observedFeaturedShows:0,
    kind:"TEAM_MOMENT",sharedTagMatches:2,averageCrowdResponse:77,
    professionalTrustAtPitch:75,
  });
  const withPartner=buildPlayerWrestlerProfileView(aggregate,"player-a",person.id);
  ok(withPartner.backstageHistory.some(x=>x.conversationId===partnerEntry.conversationId
    && x.counterpartName===partner.name),"paired wrestler's known successful collaboration was hidden");
  ok(!buildPlayerWrestlerProfileView(aggregate,"player-b",person.id)
    .backstageHistory.some(x=>x.conversationId===partnerEntry.conversationId),
    "partner history leaked to rival promotion");
});

console.log(`\nApplication wrestler-profile tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

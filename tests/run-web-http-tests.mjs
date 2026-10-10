import { spawn } from "node:child_process";
import { createAlphaWorldAggregate } from "../dist/packages/web-adapter/src/alpha-service.js";

const port = 3100;
const baseUrl = `http://127.0.0.1:${port}`;
const fixtureAggregate = createAlphaWorldAggregate({
  seed: Number(process.env.PPW_ALPHA_WORLD_SEED ?? 20261002),
  playerId: (process.env.PPW_ALPHA_PLAYER_ID ?? "alpha-player-1").trim(),
});
const divisionByPersonId = new Map(
  fixtureAggregate.state.people.map((person) => [person.id, person.division ?? "MEN"]),
);
let output = "";

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "apps/web", "-p", String(port)],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited before becoming ready\n${output}`);
    }
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready\n${output}`);
}

async function json(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function weekKey(view) {
  return `${view.world.year}:${view.world.week}`;
}

function minimumServiceCapacity(entry) {
  const stageBase = entry.careerStage === "PRIME" ? 1.9
    : entry.careerStage === "PROSPECT" ? 1.55
      : entry.careerStage === "VETERAN" ? 1.4
        : 1.0;
  const staminaFactor = 0.8 + entry.skills.stamina / 250;
  return stageBase * staminaFactor * 0.65;
}

function showPlanBody(view) {
  const promotion = view.promotion;
  const planning = promotion?.showPlanning;
  ok(promotion && planning, "HTTP promotion planning view is missing");
  ok(planning.canPlanThisWeek, "HTTP current-week planner is not available");
  const market = planning.markets[0];
  const venue = market?.venues[0];
  ok(market && venue, "HTTP planning view exposed no market/venue options");
  const reservable = promotion.roster
    .filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0);
  const minimumEven = planning.minParticipants % 2 === 0
    ? planning.minParticipants
    : planning.minParticipants + 1;
  const sameDivision = (["MEN", "WOMEN"])
    .map((division) => reservable.filter((person) => divisionByPersonId.get(person.personId) === division))
    .sort((left, right) => right.length - left.length)
    .find((group) => group.length >= minimumEven);
  ok(sameDivision, "HTTP planning view exposed no single division with enough reservable wrestlers");
  let participantCount = Math.min(sameDivision.length, planning.maxParticipants);
  if (participantCount % 2 !== 0) participantCount -= 1;
  const participantIds = sameDivision
    .slice(0, participantCount)
    .map((person) => person.personId);
  ok(participantIds.length >= minimumEven, "HTTP planning view exposed too few same-division wrestlers");
  return {
    requestId: "ci-http-show-plan-001",
    expectedRevision: view.world.revision,
    expectedPlanVersion: planning.workspaceVersion,
    day: 6,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD",
    participantIds,
  };
}

function completeSinglesCard(cardView) {
  const ids = cardView.participants.map((participant) => participant.personId);
  ok(ids.length >= 2 && ids.length % 2 === 0, "HTTP card view did not expose an even reserved roster");
  const matches = [];
  for (let index = 0; index < ids.length; index += 2) {
    matches.push({
      draftMatchId: `${cardView.draftId}:ci-match:${matches.length + 1}`,
      type: "SINGLES",
      sideAIds: [ids[index]],
      sideBIds: [ids[index + 1]],
      intendedWinnerSide: "A",
      intent: "COMPETITIVE",
      plannedLengthMinutes: 12,
    });
  }
  return matches;
}

async function assertPage(path, label) {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  ok(response.ok, `${label} page returned HTTP ${response.status}`);
}

try {
  await waitForServer();

  const page = await fetch(baseUrl, { cache: "no-store" });
  ok(page.ok, "Alpha page did not return HTTP 200");
  const html = await page.text();
  ok(html.includes("PPW"), "Alpha page did not render the PPW shell");

  const before = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(before.player?.promotionId === null, "fresh HTTP Alpha session unexpectedly controls a promotion");
  ok(Array.isArray(before.availableIndependentPromotions) && before.availableIndependentPromotions.length > 0, "HTTP session exposed no Independent choices");
  const promotionId = before.availableIndependentPromotions[0].promotionId;

  const claimBody = JSON.stringify({ promotionId, requestId: "ci-http-claim-001" });
  const first = await json(await fetch(`${baseUrl}/api/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: claimBody,
  }));
  ok(first.player?.promotionId === promotionId, "HTTP claim did not assign the selected promotion");
  ok(first.promotion?.promotionId === promotionId, "HTTP claim did not return the promotion dashboard");
  ok(first.world?.revision === 1, "HTTP claim did not advance revision exactly once");
  ok(first.promotion?.weekReadiness?.status, "HTTP dashboard did not expose week readiness");
  ok(first.promotion?.showPlanning?.markets?.length > 0, "HTTP dashboard did not expose show planning options");

  const retry = await json(await fetch(`${baseUrl}/api/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: claimBody,
  }));
  ok(retry.world?.revision === 1, "HTTP idempotent retry advanced revision twice");

  const afterClaim = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(afterClaim.player?.promotionId === promotionId, "HTTP reload lost promotion ownership");
  ok(afterClaim.promotion?.promotionId === promotionId, "HTTP reload lost promotion dashboard state");
  ok(afterClaim.world?.revision === 1, "HTTP reload returned the wrong persisted World revision");

  const plannerBeforeDetails = await json(await fetch(`${baseUrl}/api/planner`, { cache: "no-store" }));
  const currentPlannerWeek = plannerBeforeDetails.promotion?.weeks?.find((candidate) => candidate.isCurrentWeek);
  const plannerMarket = plannerBeforeDetails.promotion?.markets?.[0];
  const plannerVenue = plannerMarket?.venues?.[0];
  ok(currentPlannerWeek && plannerMarket && plannerVenue, "HTTP planner did not expose current-week logistics");
  const plannerDetails = await json(await fetch(`${baseUrl}/api/planner/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "ci-http-planner-details-001",
      expectedRevision: plannerBeforeDetails.world.revision,
      expectedPlanVersion: plannerBeforeDetails.promotion.workspaceVersion,
      year: currentPlannerWeek.year,
      week: currentPlannerWeek.week,
      day: 6,
      marketId: plannerMarket.marketId,
      venueId: plannerVenue.venueId,
      ticketStrategy: "STANDARD",
    }),
  }));
  const savedDetailsWeek = plannerDetails.promotion?.weeks?.find((candidate) => candidate.isCurrentWeek);
  ok(savedDetailsWeek?.shows?.length === 1, "HTTP planner details save did not create the current-week draft");
  ok(savedDetailsWeek.shows[0]?.participants?.length === 0, "HTTP planner details save unexpectedly edited the show roster");
  ok(savedDetailsWeek.shows[0]?.venueId === plannerVenue.venueId, "HTTP planner details save lost the selected venue");

  const afterPlannerDetails = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(afterPlannerDetails.world.revision === afterClaim.world.revision + 1, "HTTP planner details save did not advance World revision once");

  const talent = await json(await fetch(`${baseUrl}/api/talent`, { cache: "no-store" }));
  ok(talent.promotion?.promotionId === promotionId, "HTTP talent management lost controlled promotion");
  ok(Array.isArray(talent.market) && talent.market.length > 0, "HTTP talent market exposed no available wrestlers");
  ok(talent.roster?.length >= 2, "HTTP talent roster exposed fewer than two wrestlers for team creation");
  const teamsBefore = await json(await fetch(`${baseUrl}/api/teams`, { cache: "no-store" }));
  let createdTeamView = null;
  for (let left = 0; left < talent.roster.length && !createdTeamView; left += 1) {
    for (let right = left + 1; right < talent.roster.length && !createdTeamView; right += 1) {
      const response = await fetch(`${baseUrl}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: `ci-http-team-${left + 1}-${right + 1}`,
          expectedRevision: teamsBefore.world.revision,
          name: "CI HTTP Tag Team",
          personIds: [talent.roster[left].personId, talent.roster[right].personId],
        }),
      });
      const payload = await response.json();
      if (response.ok) {
        createdTeamView = payload;
        break;
      }
      if (response.status === 409 && payload?.error === "tag teams cannot mix men's and women's divisions") {
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }
  }
  ok(createdTeamView, "HTTP talent roster exposed no valid same-division pair for team creation");
  const createdTeam = createdTeamView.teams?.find((team) => team.name === "CI HTTP Tag Team");
  ok(createdTeam?.currentMembers?.length === 2, "HTTP team creation did not persist both members");
  ok(createdTeam?.experience?.band === "UNTESTED", "HTTP team creation granted free experience");

  const afterTeam = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(afterTeam.world.revision === teamsBefore.world.revision + 1, "HTTP team creation did not advance revision exactly once");

  const candidate = talent.market.find((entry) => (
    entry.availability === "FREE_AGENT" && minimumServiceCapacity(entry) >= 1.001
  ));
  ok(candidate, "HTTP talent market exposed no free agent guaranteed to have one-date Service Capacity");
  const talentOffer = {
    requestId: "ci-http-talent-offer-001",
    personId: candidate.personId,
    family: "ONE_OFF",
    roleExpectation: "REGULAR",
    termWeeks: 1,
    dateEntitlement: 1,
    weeklyGuarantee: 0,
    appearanceFee: Math.max(1_000, Math.round(candidate.estimatedWeeklyValue * 1.35)),
    signingBonus: 0,
  };
  const offered = await json(await fetch(`${baseUrl}/api/talent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(talentOffer),
  }));
  ok(offered.offerId, "HTTP talent offer did not return an offer ID");
  ok(offered.offerKind === "RECRUITMENT", "HTTP talent offer did not use the recruitment path");
  ok(offered.view?.pendingOffers?.some((offer) => offer.offerId === offered.offerId), "HTTP talent offer was not persisted into pending offers");

  const afterOffer = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(afterOffer.world.revision > afterTeam.world.revision, "HTTP talent offer did not advance World revision");

  const plan = showPlanBody(afterOffer);
  const planned = await json(await fetch(`${baseUrl}/api/show-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  }));
  ok(planned.world.revision === afterOffer.world.revision + 2, "HTTP show plan did not commit draft and reservation revisions");
  ok(planned.promotion?.showPlanning?.currentPlan?.state === "RESERVED", "HTTP show plan did not return a reserved state");
  ok(planned.promotion?.showPlanning?.currentPlan?.venueId === plan.venueId, "HTTP show plan lost selected venue");
  ok(planned.promotion?.showPlanning?.currentPlan?.participantIds?.length === plan.participantIds.length, "HTTP show plan lost selected talent");

  const planRetry = await json(await fetch(`${baseUrl}/api/show-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  }));
  ok(planRetry.world.revision === planned.world.revision, "HTTP show-plan retry advanced revision twice");
  ok(planRetry.promotion?.showPlanning?.currentPlan?.state === "RESERVED", "HTTP show-plan retry lost reservation");

  const draftId = planned.promotion.showPlanning.currentPlan.draftId;
  const cardView = await json(await fetch(`${baseUrl}/api/show-card?draftId=${encodeURIComponent(draftId)}`, { cache: "no-store" }));
  ok(cardView.draftId === draftId, "HTTP card editor opened the wrong reserved show");
  ok(cardView.reservationId, "HTTP card editor did not load a real reservation");
  ok(cardView.participants.length === plan.participantIds.length, "HTTP card editor lost reserved wrestlers");
  const matches = completeSinglesCard(cardView);
  const httpStyle = {
    competitiveness: 84,
    technical: 73,
    story: 52,
    intensity: 67,
    risk: 31,
    epic: 60,
  };
  ok(matches.length >= 2, "HTTP scripted run-in fixture needs at least two singles matches");
  const runInPerson = matches[1].sideAIds[0];
  matches[0] = {
    ...matches[0], style: httpStyle,
    interfererPersonId: runInPerson,
    interferenceSide: "A",
    interferenceOutcome: "SUCCESS",
  };
  const turnPerson = cardView.participants[0];
  ok(turnPerson, "HTTP card view exposed no wrestler for Turn regression");
  const turnTargetAlignment = turnPerson.alignment === "HEEL" ? "FACE" : "HEEL";
  const turnSegment = {
    draftSegmentId: `${cardView.draftId}:ci-turn`,
    type: "TURN",
    participantIds: [turnPerson.personId],
    programmeId: null,
    plannedLengthMinutes: 5,
    turnPersonId: turnPerson.personId,
    turnTargetAlignment,
  };
  const firstMatch = matches[0];
  const secondMatch = matches[1];
  const assault = {
    draftSegmentId: `${cardView.draftId}:ci-post-match-assault`,
    type: "POST_MATCH_ASSAULT",
    participantIds: [secondMatch.sideBIds[0], firstMatch.sideBIds[0]],
    attackerPersonId: secondMatch.sideBIds[0],
    victimPersonId: firstMatch.sideBIds[0],
    sourceDraftMatchId: firstMatch.draftMatchId,
    programmeId: null,
    plannedLengthMinutes: 5,
  };
  const signing = {
    draftSegmentId: `${cardView.draftId}:ci-contract-signing`,
    type: "CONTRACT_SIGNING",
    participantIds: [firstMatch.sideAIds[0], firstMatch.sideBIds[0]],
    programmeId: null,
    plannedLengthMinutes: 6,
    initiatorPersonId: firstMatch.sideAIds[0],
    targetPersonId: firstMatch.sideBIds[0],
    signingOutcome: "WALKOUT",
  };
  const interruption = {
    draftSegmentId: `${cardView.draftId}:ci-interruption`,
    type: "INTERRUPTION",
    participantIds: [firstMatch.sideAIds[0], secondMatch.sideAIds[0]],
    programmeId: null,
    plannedLengthMinutes: 6,
    initiatorPersonId: secondMatch.sideAIds[0],
    targetPersonId: firstMatch.sideAIds[0],
    interruptionOutcome: "INTERRUPTER_PREVAILS",
  };
  const attack = {
    draftSegmentId: `${cardView.draftId}:ci-attack`,
    type: "ATTACK",
    participantIds: [secondMatch.sideBIds[0], firstMatch.sideAIds[0]],
    programmeId: null,
    plannedLengthMinutes: 4,
    attackerPersonId: secondMatch.sideBIds[0],
    victimPersonId: firstMatch.sideAIds[0],
    attackPresentation: "BEATDOWN",
    attackObjective: "BUILD_SYMPATHY",
  };
  const rescue = {
    draftSegmentId: `${cardView.draftId}:ci-rescue`,
    type: "RESCUE",
    participantIds: [secondMatch.sideBIds[0], firstMatch.sideAIds[0], secondMatch.sideAIds[0]],
    programmeId: null,
    plannedLengthMinutes: 5,
    attackerPersonId: secondMatch.sideBIds[0],
    victimPersonId: firstMatch.sideAIds[0],
    rescuerPersonId: secondMatch.sideAIds[0],
  };
  const scriptedSegments = [assault, signing, interruption, attack, rescue, turnSegment];
  const bookedOrder = [
    { kind: "MATCH", refId: firstMatch.draftMatchId },
    { kind: "SEGMENT", refId: assault.draftSegmentId },
    ...matches.slice(1).map((match) => ({ kind: "MATCH", refId: match.draftMatchId })),
    ...scriptedSegments.slice(1).map((segment) => ({ kind: "SEGMENT", refId: segment.draftSegmentId })),
  ];
  const savedCard = await json(await fetch(`${baseUrl}/api/show-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "ci-http-show-card-001",
      expectedRevision: cardView.world.revision,
      expectedPlanVersion: cardView.workspaceVersion,
      draftId,
      matches,
      segments: scriptedSegments,
      runningOrder: bookedOrder,
      championshipAssignments: [],
    }),
  }));
  ok(savedCard.matches.length === matches.length, "HTTP match card did not persist every booked match");
  ok(savedCard.matches.every((match) => match.type === "SINGLES"), "HTTP match card changed booked match types");
  ok(savedCard.matches[0]?.style?.competitiveness === 84, "HTTP show-card route dropped match style");
  ok(savedCard.matches[0]?.style?.risk === 31, "HTTP show-card route changed match style dimensions");
  ok(savedCard.segments?.length === scriptedSegments.length, "HTTP save dropped new segment types");
  const savedByType = new Map(savedCard.segments.map((segment) => [segment.type, segment]));
  ok(savedByType.get("TURN")?.turnPersonId === turnPerson.personId, "HTTP show-card route dropped the turning wrestler");
  ok(savedByType.get("TURN")?.turnTargetAlignment === turnTargetAlignment, "HTTP show-card route dropped target alignment");
  ok(savedByType.get("POST_MATCH_ASSAULT")?.sourceDraftMatchId === firstMatch.draftMatchId
    && savedByType.get("POST_MATCH_ASSAULT")?.attackerPersonId === assault.attackerPersonId
    && savedByType.get("POST_MATCH_ASSAULT")?.victimPersonId === assault.victimPersonId,
    "HTTP route discarded post-match assault roles or source match");
  ok(savedByType.get("CONTRACT_SIGNING")?.signingOutcome === "WALKOUT"
    && savedByType.get("CONTRACT_SIGNING")?.initiatorPersonId === signing.initiatorPersonId
    && savedByType.get("CONTRACT_SIGNING")?.targetPersonId === signing.targetPersonId,
    "HTTP route discarded scripted contract-signing decision");
  ok(savedByType.get("INTERRUPTION")?.interruptionOutcome === "INTERRUPTER_PREVAILS"
    && savedByType.get("INTERRUPTION")?.initiatorPersonId === interruption.initiatorPersonId,
    "HTTP route discarded named interrupter or scripted outcome");
  ok(savedByType.get("ATTACK")?.attackPresentation === "BEATDOWN"
    && savedByType.get("ATTACK")?.attackObjective === "BUILD_SYMPATHY",
    "HTTP route discarded attack format or objective");
  ok(savedByType.get("RESCUE")?.rescuerPersonId === rescue.rescuerPersonId,
    "HTTP route discarded the named rescuer");
  ok(savedCard.matches[0]?.interfererPersonId === runInPerson
    && savedCard.matches[0]?.interferenceSide === "A"
    && savedCard.matches[0]?.interferenceOutcome === "SUCCESS",
    "HTTP route discarded a player's selected match run-in");
  const reloadedCard = await json(await fetch(`${baseUrl}/api/show-card?draftId=${encodeURIComponent(draftId)}`, { cache: "no-store" }));
  ok(reloadedCard.matches[0]?.interfererPersonId === runInPerson
    && reloadedCard.matches[0]?.interferenceOutcome === "SUCCESS",
    "HTTP reload silently reset the selected match interference");
  ok(reloadedCard.segments.length === scriptedSegments.length
    && reloadedCard.segments.some((segment) => segment.type === "POST_MATCH_ASSAULT"
      && segment.sourceDraftMatchId === firstMatch.draftMatchId),
    "HTTP reload lost new segments or their match links");

  // Real browser boundary regression: profile edit must survive POST and GET,
  // never rely only on direct TypeScript service tests.
  const rosterPerson=cardView.participants[0];
  ok(rosterPerson,"HTTP creative edit needs a booked roster wrestler");
  const editable=await json(await fetch(
    `${baseUrl}/api/talent/profile?personId=${encodeURIComponent(rosterPerson.personId)}`,{cache:"no-store"}));
  ok(editable.creativeProfile?.canEdit,"HTTP wrestler page did not expose promotion-specific editing");
  const creativeFields={...editable.creativeProfile.fields,
    ringName:"The HTTP Headliner",gimmickArchetype:"REBEL",
    gimmickDescription:"A fiercely independent competitor.",
    primaryStyle:"BRAWLER",secondaryStyle:"STRIKER",
    signatureMove:{name:"The Spotlight",category:"STRIKE"},
    finishingMove:{name:"Curtain Call",category:"GRAPPLE"},
  };
  const creativeBody={requestId:"ci-http-creative-save-1",expectedRevision:editable.world.revision,
    personId:rosterPerson.personId,fields:creativeFields};
  const creativeSaved=await json(await fetch(`${baseUrl}/api/talent/profile`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(creativeBody),
  }));
  ok(creativeSaved.creativeProfile?.fields.finishingMove?.name==="Curtain Call"
    && creativeSaved.creativeProfile.history.length===1,"HTTP edited finisher or history missing");
  const creativeReload=await json(await fetch(
    `${baseUrl}/api/talent/profile?personId=${encodeURIComponent(rosterPerson.personId)}`,{cache:"no-store"}));
  ok(creativeReload.creativeProfile?.fields.ringName==="The HTTP Headliner"
    && creativeReload.creativeProfile.fields.secondaryStyle==="STRIKER","HTTP reload lost creative fields");
  const creativeRetry=await json(await fetch(`${baseUrl}/api/talent/profile`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(creativeBody),
  }));
  ok(creativeRetry.world.revision===creativeSaved.world.revision
    && creativeRetry.creativeProfile.history.length===1,"HTTP creative retry duplicated a revision or edit");

  // Guard against a UI/backend whitelist mismatch: even when no character
  // request exists, the HTTP route must recognise this reply enum.
  const characterReplyValidation = await fetch(`${baseUrl}/api/backstage/respond`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      requestId:"ci-gimmick-route-enum",conversationId:"nonexistent-character-pitch",
      response:"CONSIDER_GIMMICK_CHANGE",
    }),
  });
  const characterReplyError = await characterReplyValidation.json();
  ok(characterReplyValidation.status===409
    && String(characterReplyError.error).includes("does not belong to your promotion"),
    "HTTP route rejected a valid creative reply before reaching promotion validation");

  const ready = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(ready.promotion?.showPlanning?.currentPlan?.state === "RESERVED", "HTTP booked show lost its reserved planning state before lock");
  ok(ready.promotion?.showPlanning?.currentPlan?.reservationId, "HTTP booked show lost its committed reservation before lock");

  const weekBefore = weekKey(ready);
  const revisionBeforeAdvance = ready.world.revision;
  const advanced = await json(await fetch(`${baseUrl}/api/advance-week`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: revisionBeforeAdvance }),
  }));
  ok(weekKey(advanced) !== weekBefore, "HTTP week endpoint did not advance the PPW calendar");
  ok(advanced.world?.phase === "OPEN", "HTTP week endpoint did not reopen the World");
  ok(advanced.world?.revision > revisionBeforeAdvance, "HTTP week endpoint did not advance the World revision");
  ok(advanced.world?.lastResolvedPpwDate, "HTTP week endpoint did not expose the resolved week");
  ok(advanced.promotion?.lastResolvedShow?.venueName, "HTTP planned show did not materialize into the resolved result");
  const selectedVenueName = planned.promotion.showPlanning.markets
    .flatMap((market) => market.venues)
    .find((venue) => venue.venueId === plan.venueId)?.name;
  ok(advanced.promotion.lastResolvedShow.venueName === selectedVenueName, "resolved show did not use the reserved venue");

  const playerResults = await json(await fetch(`${baseUrl}/api/results`, { cache: "no-store" }));
  const resolvedEventId = advanced.promotion.lastResolvedShow.eventId;
  const playerShow = playerResults.shows?.find((show) => show.eventId === resolvedEventId);
  ok(playerShow, "HTTP player results did not include the newly resolved show");
  ok(playerShow.matches.length === matches.length, "HTTP player results did not preserve the booked card");
  ok(playerShow.matches.every((match) => match.winnerNames.length > 0), "HTTP player results omitted match winners");
  ok(playerShow.segments?.some((segment) => segment.type === "TURN"), "HTTP player results omitted the resolved Turn segment");
  for (const type of ["CONTRACT_SIGNING", "POST_MATCH_ASSAULT", "INTERRUPTION", "ATTACK", "RESCUE"]) {
    ok(playerShow.segments?.some((segment) => segment.type === type),
      "HTTP results omitted resolved " + type);
  }
  const bookedInterference = playerShow.matches.find((match) => match.interference?.personId === runInPerson
    || match.interferencePersonId === runInPerson);
  ok(bookedInterference, "HTTP results lost the booked interfering wrestler");

  const worldResults = await json(await fetch(`${baseUrl}/api/world-results`, { cache: "no-store" }));
  const worldShow = worldResults.shows?.find((show) => show.eventId === resolvedEventId);
  ok(worldShow, "HTTP World results did not include the player's resolved show");
  ok(worldShow.isPlayerPromotion === true, "HTTP World results did not identify the player's promotion");
  ok(!("gateRevenue" in worldShow) && !("totalCost" in worldShow) && !("netResult" in worldShow), "HTTP World results leaked private show economics");

  const industry = await json(await fetch(`${baseUrl}/api/industry`, { cache: "no-store" }));
  ok(Array.isArray(industry.promotions) && industry.promotions.some((promotion) => promotion.promotionId === promotionId), "HTTP Industry view omitted the controlled promotion");
  const championships = await json(await fetch(`${baseUrl}/api/championships`, { cache: "no-store" }));
  ok(Array.isArray(championships.championships), "HTTP championship history did not return a title collection");
  const teams = await json(await fetch(`${baseUrl}/api/teams`, { cache: "no-store" }));
  ok(Array.isArray(teams.teams), "HTTP team history did not return a team collection");
  const profilePersonId = plan.participantIds[0];
  const profile = await json(await fetch(`${baseUrl}/api/talent/profile?personId=${encodeURIComponent(profilePersonId)}`, { cache: "no-store" }));
  ok(profile.person?.personId === profilePersonId, "HTTP wrestler profile did not load the requested wrestler");
  ok(profile.careerStats?.completedMatches >= 1, "HTTP wrestler profile did not reflect the resolved show");
  ok(Number.isFinite(profile.person.personality?.microphoneAbility)
    && profile.person.personality.microphoneAbility >= 0
    && profile.person.personality.microphoneAbility <= 100
    && profile.person.personality.microphoneSource === "ESTIMATED"
    && profile.person.personality.motivations.length === 2,
    "HTTP wrestler profile dropped stable microphone ability or backstage tendencies");

  await assertPage("/results", "Results");
  await assertPage("/industry", "Industry");
  await assertPage("/championships", "Championship history");
  await assertPage("/teams", "Team history");
  await assertPage(`/talent/profile?personId=${encodeURIComponent(profilePersonId)}`, "Wrestler profile");

  const staleResponse = await fetch(`${baseUrl}/api/advance-week`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: revisionBeforeAdvance }),
  });
  ok(staleResponse.status === 409, `stale HTTP week retry returned ${staleResponse.status} instead of 409`);
  const stalePayload = await staleResponse.json();
  ok(String(stalePayload.error ?? "").includes("stale World revision"), "stale HTTP week retry returned the wrong conflict reason");

  const afterAdvance = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(weekKey(afterAdvance) === weekKey(advanced), "stale HTTP retry advanced the World a second time");
  ok(afterAdvance.world.revision === advanced.world.revision, "stale HTTP retry changed the persisted World revision");



  console.log("PASS Alpha Next HTTP full player journey, public history views and stale-retry safety");
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once("exit", resolve);
    setTimeout(resolve, 3000);
  });
}

import { spawn } from "node:child_process";

const port = 3100;
const baseUrl = `http://127.0.0.1:${port}`;
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
  let participantIds = promotion.roster
    .filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0)
    .slice(0, planning.maxParticipants)
    .map((person) => person.personId);
  if (participantIds.length % 2 !== 0) participantIds = participantIds.slice(0, -1);
  ok(participantIds.length >= planning.minParticipants, "HTTP planning view exposed too few reservable wrestlers");
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

  const talent = await json(await fetch(`${baseUrl}/api/talent`, { cache: "no-store" }));
  ok(talent.promotion?.promotionId === promotionId, "HTTP talent management lost controlled promotion");
  ok(Array.isArray(talent.market) && talent.market.length > 0, "HTTP talent market exposed no available wrestlers");
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
  ok(afterOffer.world.revision > afterClaim.world.revision, "HTTP talent offer did not advance World revision");

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
  const savedCard = await json(await fetch(`${baseUrl}/api/show-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "ci-http-show-card-001",
      expectedRevision: cardView.world.revision,
      expectedPlanVersion: cardView.workspaceVersion,
      draftId,
      matches,
      championshipAssignments: [],
    }),
  }));
  ok(savedCard.matches.length === matches.length, "HTTP match card did not persist every booked match");
  ok(savedCard.matches.every((match) => match.type === "SINGLES"), "HTTP match card changed booked match types");

  const ready = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(ready.promotion?.weekReadiness?.status === "READY", "HTTP booked card did not make the required show ready");

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

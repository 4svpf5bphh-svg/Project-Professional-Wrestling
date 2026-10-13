declare const process: { exitCode?: number };

import {
  buildAlphaPlayerWorldView,
  buildPlayerAttention,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  recordPlayerActivity,
  reserveDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldAggregate,
  type DetailedShowDraft,
  type StewardshipExitRequest,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPromotion,
  addPpwWeeks,
  createWorld,
  currentRosterPersonIds,
  minimumViableRoster,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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

function fixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  playerId: string;
  promotionId: string;
  contractId: string;
  personId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "attention-player";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);
  const promotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI"
    && candidate.tier === "INDEPENDENT"
    && candidate.lifecycle === "ACTIVE"
    && activeContractsForPromotion(state, candidate.id).some((contract) => contract.family !== "ONE_OFF")
  ));
  if (!promotion) throw new Error("attention fixture could not find a suitable Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);
  const contract = activeContractsForPromotion(state, promotion.id).find((candidate) => candidate.family !== "ONE_OFF");
  if (!contract) throw new Error("attention fixture lost its continuing contract");

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, "2026-10-04");

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
      engagement,
    },
    playerId,
    promotionId: promotion.id,
    contractId: contract.id,
    personId: contract.personId,
  };
}

function currentWeekDraft(
  f: ReturnType<typeof fixture>,
  completeCard: boolean,
): DetailedShowDraft {
  const promotion = f.aggregate.state.promotions.find((candidate) => candidate.id === f.promotionId)!;
  const flagship = f.aggregate.state.showSeries?.find((series) => (
    series.promotionId === promotion.id && series.role === "FLAGSHIP"
  ));
  if (!flagship) throw new Error("attention fixture is missing its Flagship show identity");
  flagship.cadenceWeeks = 1;
  flagship.anchorWeek = 0;
  const market = f.aggregate.state.markets.find((candidate) => candidate.id === promotion.homeMarketId)
    ?? f.aggregate.state.markets[0]!;
  const venue = f.aggregate.state.venues.find((candidate) => candidate.marketId === market.id)
    ?? f.aggregate.state.venues[0]!;
  const required = f.aggregate.state.ruleset.minEventParticipants % 2 === 0
    ? f.aggregate.state.ruleset.minEventParticipants
    : f.aggregate.state.ruleset.minEventParticipants + 1;
  const participantIds: string[] = [];
  for (const contract of activeContractsForPromotion(f.aggregate.state, f.promotionId)) {
    if (contract.datesUsed >= contract.dateEntitlement || participantIds.includes(contract.personId)) continue;
    const person = f.aggregate.state.people.find((candidate) => candidate.id === contract.personId);
    if (!person || person.status !== "ACTIVE") continue;
    participantIds.push(person.id);
    if (participantIds.length >= required) break;
  }
  if (participantIds.length < required) throw new Error("attention fixture lacks enough reservable wrestlers");

  const draftId = `alpha-show:${f.promotionId}:Y${f.aggregate.state.world.currentDate.year}:W${f.aggregate.state.world.currentDate.week}`;
  return {
    draftId,
    promotionId: f.promotionId,
    targetDate: { ...f.aggregate.state.world.currentDate, day: 6 },
    marketId: market.id,
    venueId: venue.id,
    ticketStrategy: "STANDARD",
    participantIds,
    matches: completeCard
      ? Array.from({ length: participantIds.length / 2 }, (_, matchIndex) => {
        const index = matchIndex * 2;
        return {
          draftMatchId: `${draftId}:match:${matchIndex + 1}`,
          type: "SINGLES" as const,
          sideAIds: [participantIds[index]!],
          sideBIds: [participantIds[index + 1]!],
          intendedWinnerSide: "A" as const,
          intent: "COMPETITIVE" as const,
          plannedLengthMinutes: 12,
        };
      })
      : [],
    championshipAssignments: [],
  };
}

function saveAndReserveCurrentWeekDraft(
  f: ReturnType<typeof fixture>,
  draft: DetailedShowDraft,
  expectedPlanVersion: number,
  suffix: string,
): void {
  const workspace = upsertDetailedShowDraftCommand(
    f.aggregate.state,
    f.aggregate.ownership,
    f.aggregate.planning,
    f.aggregate.commands,
    f.aggregate.runtime,
    {
      requestId: `${suffix}:draft`,
      worldId: f.aggregate.state.world.id,
      playerId: f.playerId,
      commandType: "UPSERT_DETAILED_SHOW_DRAFT",
      payload: {
        promotionId: f.promotionId,
        expectedPlanVersion,
        draft,
      },
    },
  );
  reserveDetailedShowDraftCommand(
    f.aggregate.state,
    f.aggregate.ownership,
    f.aggregate.planning,
    f.aggregate.commands,
    f.aggregate.runtime,
    {
      requestId: `${suffix}:reserve`,
      worldId: f.aggregate.state.world.id,
      playerId: f.playerId,
      commandType: "RESERVE_DETAILED_SHOW_DRAFT",
      payload: {
        promotionId: f.promotionId,
        expectedPlanVersion: workspace.version,
        draftId: draft.draftId,
      },
    },
  );
}

await test("Attention surfaces OPEN Stewardship release requests and agreed releases awaiting execution", () => {
  const f = fixture(18501);
  const request: StewardshipExitRequest = {
    requestId: `stewardship-exit:${f.contractId}:2026-10-01`,
    worldId: f.aggregate.state.world.id,
    promotionId: f.promotionId,
    personId: f.personId,
    contractId: f.contractId,
    requestedDate: { ...f.aggregate.state.world.currentDate },
    requestedCycleKey: "2026-10-01",
    trustAtRequest: 35,
    status: "OPEN",
  };
  f.aggregate.engagement!.stewardshipExitRequests.push(request);

  let items = buildPlayerAttention(f.aggregate, f.playerId);
  const open = items.find((item) => item.attentionId === `release-request:${request.requestId}`);
  ok(open?.category === "ACTION_REQUIRED", "OPEN release request was not Action Required");
  ok(open?.dismissible === false, "OPEN release request was dismissible");
  ok(open?.summary.includes("Trust was 35"), "OPEN release request did not expose the Trust context");

  request.status = "SETTLED";
  items = buildPlayerAttention(f.aggregate, f.playerId);
  ok(!items.some((item) => item.attentionId === `release-request:${request.requestId}`), "resolved request remained OPEN in Attention");
  const settled = items.find((item) => item.attentionId === `release-agreed:${request.requestId}`);
  ok(settled?.category === "ACTION_REQUIRED", "agreed but unexecuted release was not Action Required");
  ok(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status === "SIGNED", "Attention test unexpectedly changed the contract");
});

await test("Attention surfaces roster injuries and contracts entering the renewal window without leaking rival contracts", () => {
  const f = fixture(18502);
  const contract = f.aggregate.state.contracts.find((candidate) => candidate.id === f.contractId)!;
  contract.endDate = addPpwWeeks(f.aggregate.state.world.currentDate, 2, f.aggregate.state.ruleset.weeksPerYear);
  const person = f.aggregate.state.people.find((candidate) => candidate.id === f.personId)!;
  person.status = "INJURED";
  f.aggregate.state.injuries.push({
    id: "injury-attention-test",
    worldId: f.aggregate.state.world.id,
    personId: person.id,
    matchId: "match-attention-test",
    eventId: "event-attention-test",
    date: { ...f.aggregate.state.world.currentDate },
    severity: "MODERATE",
    weeksOut: 3,
    weeksRemaining: 2,
    status: "ACTIVE",
  });

  const rivalContract = f.aggregate.state.contracts.find((candidate) => (
    candidate.promotionId !== f.promotionId && candidate.family !== "ONE_OFF" && candidate.status === "SIGNED"
  ));
  if (!rivalContract) throw new Error("attention fixture could not find a rival contract");
  rivalContract.endDate = addPpwWeeks(f.aggregate.state.world.currentDate, 1, f.aggregate.state.ruleset.weeksPerYear);

  const items = buildPlayerAttention(f.aggregate, f.playerId);
  const injury = items.find((item) => item.attentionId === "injury:injury-attention-test");
  ok(injury?.category === "IMPORTANT", "active roster injury was not Important");
  ok(injury?.summary.includes("2 PPW weeks"), "injury recovery duration was missing");
  const expiry = items.find((item) => item.attentionId === `contract-expiry:${contract.id}`);
  ok(expiry?.category === "IMPORTANT", "two-week contract expiry was not Important");
  ok(expiry?.dismissible === true, "non-urgent renewal-window item should be dismissible");
  ok(!items.some((item) => item.attentionId === `contract-expiry:${rivalContract.id}`), "rival contract leaked into player Attention");
});

await test("an imminent contract deadline remains Action Required but can be dismissed as news", () => {
  const f = fixture(18503);
  const contract = f.aggregate.state.contracts.find((candidate) => candidate.id === f.contractId)!;
  contract.endDate = { ...f.aggregate.state.world.currentDate, day: 7 };

  const item = buildPlayerAttention(f.aggregate, f.playerId)
    .find((candidate) => candidate.attentionId === `contract-expiry:${contract.id}`);
  ok(item?.category === "ACTION_REQUIRED", "current-week contract decision did not escalate");
  ok(item?.dismissible === true, "urgent contract news must offer Dismiss without waiving the actual deadline");
  ok(item?.deadline?.day === 7, "urgent contract deadline lost its PPW day");
});

await test("zero-date contract news can be dismissed without changing actual booking rights", () => {
  const f = fixture(18533);
  const source = f.aggregate.state.contracts.find((candidate) => candidate.id === f.contractId)!;
  source.family = "LIMITED_NON_EXCLUSIVE";
  source.exclusivity = "NON_EXCLUSIVE";
  source.datesUsed = source.dateEntitlement;
  const before = buildPlayerAttention(f.aggregate, f.playerId);
  const exhausted = before.find((item) => item.attentionId === `contract-dates-exhausted:${source.id}`);
  ok(exhausted?.dismissible === true, "date-exhausted contract item did not offer Dismiss");
  ok(exhausted?.deepLink === "/talent", "contract reminder could not open roster");
  ok(exhausted?.category === "ACTION_REQUIRED", "critical dates situation lost its urgency category");
});

await test("Attention flags a human roster below the minimum viable floor", () => {
  const f = fixture(18504);
  const promotion = f.aggregate.state.promotions.find((candidate) => candidate.id === f.promotionId)!;
  const floor = minimumViableRoster(f.aggregate.state, promotion);
  const contracts = f.aggregate.state.contracts.filter((contract) => contract.promotionId === f.promotionId);
  for (const contract of contracts) contract.status = "TERMINATED";

  const restoredPeople = new Set<string>();
  for (const contract of contracts) {
    if (restoredPeople.size >= Math.max(0, floor - 1)) break;
    if (contract.family === "ONE_OFF" || restoredPeople.has(contract.personId)) continue;
    contract.status = "SIGNED";
    restoredPeople.add(contract.personId);
  }
  ok(currentRosterPersonIds(f.aggregate.state, f.promotionId).length < floor, "fixture failed to create a roster shortage");

  const item = buildPlayerAttention(f.aggregate, f.playerId)
    .find((candidate) => candidate.attentionId === `roster-shortage:${f.promotionId}`);
  ok(item?.category === "ACTION_REQUIRED", "minimum-roster shortage was not Action Required");
  ok(item?.dismissible === false, "minimum-roster shortage was dismissible");
  ok(item?.summary.includes(String(floor)), "minimum-roster shortage did not expose the required floor");
});

await test("Alpha player home view carries the same player-scoped Attention with playable destinations", () => {
  const f = fixture(18505);
  const promotion = f.aggregate.state.promotions.find((candidate) => candidate.id === f.promotionId)!;
  const flagship = f.aggregate.state.showSeries?.find((series) => (
    series.promotionId === promotion.id && series.role === "FLAGSHIP"
  ));
  if (!flagship) throw new Error("attention fixture is missing its Flagship show identity");
  flagship.cadenceWeeks = 1;
  flagship.anchorWeek = 0;
  const contract = f.aggregate.state.contracts.find((candidate) => candidate.id === f.contractId)!;
  contract.endDate = addPpwWeeks(f.aggregate.state.world.currentDate, 2, f.aggregate.state.ruleset.weeksPerYear);

  const raw = buildPlayerAttention(f.aggregate, f.playerId);
  const view = buildAlphaPlayerWorldView(f.aggregate, f.playerId);
  ok(view.attention.length === raw.length, "Alpha home dropped or added Attention items outside the projection");
  ok(
    view.attention.map((item) => item.attentionId).join("|") === raw.map((item) => item.attentionId).join("|"),
    "Alpha home changed Attention ordering or player scope",
  );

  const renewal = view.attention.find((item) => item.attentionId === `contract-expiry:${contract.id}`);
  ok(renewal?.deepLink === "/talent", "renewal Attention did not link to Talent");
});

await test("reserved current-week preparation replaces false missing-show Attention and becomes READY when the card is complete", () => {
  const f = fixture(18506);
  const incompleteDraft = currentWeekDraft(f, false);

  const requiredView = buildAlphaPlayerWorldView(f.aggregate, f.playerId);
  const requiredShow = requiredView.attention.find((item) => item.attentionId.startsWith("required-show:"));
  ok(requiredShow?.deepLink === "/planner", "required-show Attention did not link to the six-week Planner");

  saveAndReserveCurrentWeekDraft(f, incompleteDraft, 0, "attention-readiness-incomplete");

  const incompleteView = buildAlphaPlayerWorldView(f.aggregate, f.playerId);
  ok(incompleteView.promotion?.weekReadiness.status === "CARD_REQUIRED", "reserved show still looked like no show was committed");
  ok(incompleteView.promotion?.weekReadiness.readyToFinish === false, "incomplete card was incorrectly ready for lock");
  ok(!incompleteView.attention.some((item) => item.attentionId.startsWith("required-show:")), "false missing-show Attention remained after reservation");
  ok(incompleteView.attention.some((item) => item.attentionId.startsWith("required-card:")), "reserved show did not surface the remaining card work");

  const completeDraft = currentWeekDraft(f, true);
  saveAndReserveCurrentWeekDraft(f, completeDraft, 1, "attention-readiness-complete");
  const readyView = buildAlphaPlayerWorldView(f.aggregate, f.playerId);
  ok(readyView.promotion?.weekReadiness.status === "READY", "complete reserved show was not presented as ready for scheduled lock");
  ok(readyView.promotion?.weekReadiness.readyToFinish === true, "complete reserved show still requested staff help");
  ok(readyView.promotion?.showPlanning.currentPlan?.state === "RESERVED", "player-facing readiness materialized the show early");
  ok(f.aggregate.state.events.length === 0, "readiness projection created an event before the server lock");
  ok(
    !readyView.attention.some((item) => item.attentionId.startsWith("required-show:") || item.attentionId.startsWith("required-card:")),
    "completed preparation still produced show/card Action Required Attention",
  );
});

console.log(`\nAttention projection tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
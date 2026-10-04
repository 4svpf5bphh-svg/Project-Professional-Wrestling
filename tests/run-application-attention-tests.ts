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
  type ApplicationWorldAggregate,
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

await test("an imminent contract deadline escalates to non-dismissible Action Required", () => {
  const f = fixture(18503);
  const contract = f.aggregate.state.contracts.find((candidate) => candidate.id === f.contractId)!;
  contract.endDate = { ...f.aggregate.state.world.currentDate, day: 7 };

  const item = buildPlayerAttention(f.aggregate, f.playerId)
    .find((candidate) => candidate.attentionId === `contract-expiry:${contract.id}`);
  ok(item?.category === "ACTION_REQUIRED", "current-week contract decision did not escalate");
  ok(item?.dismissible === false, "urgent contract decision was dismissible");
  ok(item?.deadline?.day === 7, "urgent contract deadline lost its PPW day");
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
  promotion.eventCadenceWeeks = 1;
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
  const show = view.attention.find((item) => item.attentionId.startsWith("required-show:"));
  ok(show?.deepLink === "/planner", "required-show Attention did not link to the six-week Planner");
});

console.log(`\nAttention projection tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

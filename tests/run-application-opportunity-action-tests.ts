declare const process: { exitCode?: number };

import {
  addOpportunity,
  attentionIsDismissed,
  buildPlayerAttention,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  pursueTalentOpportunityCommand,
  recordPlayerActivity,
  type ApplicationCommandEnvelope,
  type ApplicationWorldAggregate,
  type PursueTalentOpportunityPayload,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPerson,
  addPpwWeeks,
  createWorld,
  marketWeeklyValue,
  resolveWorldWeek,
  submitHumanContractOffer,
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

interface Fixture {
  aggregate: ApplicationWorldAggregate;
  playerId: string;
  promotionId: string;
  personId: string;
  opportunityId: string;
}

function fixture(seed: number): Fixture {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "opportunity-player";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);
  const promotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI"
    && candidate.tier === "INDEPENDENT"
    && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("Opportunity-action fixture could not find an Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);

  const person = state.people.find((candidate) => (
    candidate.status === "ACTIVE"
    && activeContractsForPerson(state, candidate.id).length === 0
  ));
  if (!person) throw new Error("Opportunity-action fixture could not find a free agent");

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, "2026-10-04");
  const closesDate = addPpwWeeks(state.world.currentDate, 1, state.ruleset.weeksPerYear);
  closesDate.day = 7;
  const opportunityId = `talent-window:${promotion.id}:${person.id}:initial`;
  addOpportunity(engagement, {
    opportunityId,
    worldId: state.world.id,
    category: "TALENT",
    title: `${person.name} is available`,
    summary: "A real free-agent recruitment opening.",
    createdDate: { ...state.world.currentDate },
    opensDate: { ...state.world.currentDate },
    closesDate,
    eligiblePlayerIds: [playerId],
    eligiblePromotionIds: [promotion.id],
    deepLink: null,
  });

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
    personId: person.id,
    opportunityId,
  };
}

function offerTerms(f: Fixture): PursueTalentOpportunityPayload["offer"] {
  const person = f.aggregate.state.people.find((candidate) => candidate.id === f.personId)!;
  const market = Math.max(1_000, Math.round(marketWeeklyValue(person)));
  return {
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "FEATURED",
    startDate: { ...f.aggregate.state.world.currentDate },
    endDate: addPpwWeeks(f.aggregate.state.world.currentDate, 12, f.aggregate.state.ruleset.weeksPerYear),
    dateEntitlement: 4,
    weeklyGuarantee: market,
    appearanceFee: market,
    signingBonus: market * 2,
  };
}

function envelope(f: Fixture, requestId: string): ApplicationCommandEnvelope<PursueTalentOpportunityPayload> {
  return {
    requestId,
    worldId: f.aggregate.state.world.id,
    playerId: f.playerId,
    commandType: "PURSUE_TALENT_OPPORTUNITY",
    payload: {
      opportunityId: f.opportunityId,
      offer: offerTerms(f),
    },
  };
}

await test("pursuing a Talent Opportunity submits a normal pending offer and clears it from Attention", () => {
  const f = fixture(18801);
  const attentionId = `opportunity:${f.opportunityId}`;
  ok(
    buildPlayerAttention(f.aggregate, f.playerId).some((item) => item.attentionId === attentionId),
    "fixture Talent Opportunity was not visible before pursuit",
  );

  const offersBefore = f.aggregate.state.contractOffers.length;
  const revisionBefore = f.aggregate.runtime.revision;
  const command = envelope(f, "pursue-opportunity-1");
  const result = pursueTalentOpportunityCommand(f.aggregate, command);

  ok(result.opportunityId === f.opportunityId, "pursuit returned the wrong Opportunity");
  ok(result.promotionId === f.promotionId, "pursuit targeted the wrong promotion");
  ok(result.personId === f.personId, "pursuit targeted the wrong wrestler");
  ok(result.offer.status === "PENDING", "Opportunity pursuit bypassed the normal pending-offer state");
  ok(result.offer.promotionId === f.promotionId && result.offer.personId === f.personId, "submitted offer points at the wrong parties");
  ok(f.aggregate.state.contractOffers.length === offersBefore + 1, "Opportunity pursuit did not append exactly one contract offer");
  ok(f.aggregate.runtime.revision === revisionBefore + 1, "Opportunity pursuit did not advance the application revision once");
  ok(attentionIsDismissed(f.aggregate.engagement!, f.playerId, attentionId), "pursued Opportunity was not marked handled in Attention");
  ok(
    !buildPlayerAttention(f.aggregate, f.playerId).some((item) => item.attentionId === attentionId),
    "pursued Opportunity remained in player Attention",
  );

  const retry = pursueTalentOpportunityCommand(f.aggregate, command);
  ok(retry.offer.id === result.offer.id, "idempotent retry returned a different offer");
  ok(f.aggregate.state.contractOffers.length === offersBefore + 1, "idempotent retry created a duplicate offer");
  ok(
    f.aggregate.commands.receipts.filter((receipt) => receipt.requestId === command.requestId).length === 1,
    "idempotent retry created duplicate command receipts",
  );
});

await test("Opportunity pursuit still obeys normal contract validation and does not partially consume on rejection", () => {
  const f = fixture(18802);
  const command = envelope(f, "pursue-invalid-terms");
  command.payload.offer.startDate = { ...f.aggregate.state.world.currentDate, day: 7 };
  command.payload.offer.endDate = { ...f.aggregate.state.world.currentDate, day: 1 };
  const attentionId = `opportunity:${f.opportunityId}`;
  const offersBefore = f.aggregate.state.contractOffers.length;
  const revisionBefore = f.aggregate.runtime.revision;

  let rejected = false;
  try {
    pursueTalentOpportunityCommand(f.aggregate, command);
  } catch {
    rejected = true;
  }
  ok(rejected, "invalid contract terms were accepted through the Opportunity wrapper");
  ok(f.aggregate.state.contractOffers.length === offersBefore, "rejected Opportunity pursuit partially created an offer");
  ok(f.aggregate.runtime.revision === revisionBefore, "rejected Opportunity pursuit advanced the World revision");
  ok(!attentionIsDismissed(f.aggregate.engagement!, f.playerId, attentionId), "rejected Opportunity pursuit consumed the Attention item");
  ok(f.aggregate.commands.receipts.length === 0, "rejected Opportunity pursuit created a command receipt");
});

await test("a Talent Opportunity becomes unusable if the wrestler signs before the player acts", () => {
  const f = fixture(18803);
  const person = f.aggregate.state.people.find((candidate) => candidate.id === f.personId)!;
  const market = Math.max(1_000, Math.round(marketWeeklyValue(person)));
  const directOffer = submitHumanContractOffer(f.aggregate.state, {
    promotionId: f.promotionId,
    personId: f.personId,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "MAIN_EVENT",
    startDate: { ...f.aggregate.state.world.currentDate },
    endDate: addPpwWeeks(f.aggregate.state.world.currentDate, 12, f.aggregate.state.ruleset.weeksPerYear),
    dateEntitlement: 2,
    weeklyGuarantee: market * 4,
    appearanceFee: market * 4,
    signingBonus: market * 12,
  });
  resolveWorldWeek(f.aggregate.state);
  ok(directOffer.status === "ACCEPTED", "fixture could not make the target wrestler sign before pursuit");

  const command = envelope(f, "pursue-stale-window");
  let rejected = false;
  try {
    pursueTalentOpportunityCommand(f.aggregate, command);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("no longer unattached");
  }
  ok(rejected, "stale Talent Opportunity remained actionable after the wrestler signed");
});

await test("STEWARDED owners cannot use a previously generated Talent Opportunity", () => {
  const f = fixture(18804);
  const activity = f.aggregate.engagement!.playerActivity.find((record) => record.playerId === f.playerId)!;
  activity.status = "STEWARDED";
  activity.statusSinceCycleKey = "2026-10-18";

  let rejected = false;
  try {
    pursueTalentOpportunityCommand(f.aggregate, envelope(f, "pursue-while-stewarded"));
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("STEWARDED");
  }
  ok(rejected, "STEWARDED owner could pursue a new Talent Opportunity");
  ok(f.aggregate.state.contractOffers.length === 0, "STEWARDED rejection still created an offer");
});

console.log(`\nOpportunity action tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

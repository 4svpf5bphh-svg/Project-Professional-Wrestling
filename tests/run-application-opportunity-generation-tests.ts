declare const process: { exitCode?: number };

import {
  buildPlayerAttention,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  generateWorldOpportunities,
  joinPlayerToWorld,
  recordPlayerActivity,
  resolveScheduledWorldCycle,
  TALENT_OPPORTUNITY_WINDOW_WEEKS,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/memory-world-repository.js";
import {
  activeContractsForPromotion,
  addPpwWeeks,
  createWorld,
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
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "opportunity-player";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);
  const promotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI"
    && candidate.tier === "INDEPENDENT"
    && candidate.lifecycle === "ACTIVE"
    && activeContractsForPromotion(state, candidate.id).some((contract) => contract.family !== "ONE_OFF")
  ));
  if (!promotion) throw new Error("opportunity fixture could not find a suitable Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);
  promotion.cash = Math.max(promotion.cash, 100_000_000);
  promotion.financialDistress = "HEALTHY";

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
  };
}

function prepareOnlyMeaningfulFreeAgent(aggregate: ApplicationWorldAggregate): string {
  const candidate = aggregate.state.people.find((person) => person.status === "ACTIVE");
  if (!candidate) throw new Error("opportunity fixture has no active wrestler");

  for (const person of aggregate.state.people) {
    person.recognition = 10;
    person.popularity = 10;
    person.skills.inRingQuality = 35;
    person.skills.matchCraft = 35;
    person.skills.presentation = 35;
  }
  candidate.recognition = 100;
  candidate.popularity = 100;
  candidate.skills.inRingQuality = 100;
  candidate.skills.matchCraft = 100;
  candidate.skills.presentation = 100;
  for (const contract of aggregate.state.contracts) {
    if (contract.personId === candidate.id) contract.status = "TERMINATED";
  }
  return candidate.id;
}

await test("Talent Window generation creates one private time-bounded opening and is idempotent", () => {
  const f = fixture(18601);
  const personId = prepareOnlyMeaningfulFreeAgent(f.aggregate);
  const person = f.aggregate.state.people.find((candidate) => candidate.id === personId)!;

  const first = generateWorldOpportunities(f.aggregate);
  ok(first.promotionsConsidered === 1, "controlled promotion was not considered for Opportunities");
  ok(first.talentWindowsCreated === 1, "meaningful free agent did not create one Talent Window");
  const opportunity = f.aggregate.engagement!.opportunities.find((candidate) => candidate.category === "TALENT");
  ok(opportunity?.title === `${person.name} is available`, "Talent Window title did not identify the wrestler");
  ok(opportunity?.eligiblePlayerIds.length === 1 && opportunity.eligiblePlayerIds[0] === f.playerId, "Talent Window was not player-scoped");
  ok(opportunity?.eligiblePromotionIds.length === 1 && opportunity.eligiblePromotionIds[0] === f.promotionId, "Talent Window was not promotion-scoped");
  const expectedClose = addPpwWeeks(
    f.aggregate.state.world.currentDate,
    TALENT_OPPORTUNITY_WINDOW_WEEKS - 1,
    f.aggregate.state.ruleset.weeksPerYear,
  );
  ok(opportunity?.closesDate.year === expectedClose.year && opportunity.closesDate.week === expectedClose.week, "Talent Window used the wrong PPW close week");
  ok(opportunity?.closesDate.day === 7, "Talent Window did not stay open through the close week");

  const second = generateWorldOpportunities(f.aggregate);
  ok(second.talentWindowsCreated === 0, "duplicate generation created another open Talent Window");
  ok(f.aggregate.engagement!.opportunities.length === 1, "idempotent generation changed the Opportunity count");

  const attention = buildPlayerAttention(f.aggregate, f.playerId);
  ok(attention.some((item) => item.attentionId === `opportunity:${opportunity!.opportunityId}`), "generated Talent Window did not flow into Attention");
});

await test("Opportunity generation permits quiet weeks and does not create filler", () => {
  const f = fixture(18602);
  for (const person of f.aggregate.state.people) {
    person.recognition = 10;
    person.popularity = 10;
    person.skills.inRingQuality = 30;
    person.skills.matchCraft = 30;
    person.skills.presentation = 30;
  }
  const result = generateWorldOpportunities(f.aggregate);
  ok(result.talentWindowsCreated === 0, "low-value World state manufactured a filler Opportunity");
  ok(f.aggregate.engagement!.opportunities.length === 0, "quiet Opportunity week was not actually quiet");
});

await test("Stewardship blocks new Talent Windows until the player returns", () => {
  const f = fixture(18603);
  prepareOnlyMeaningfulFreeAgent(f.aggregate);
  const activity = f.aggregate.engagement!.playerActivity.find((record) => record.playerId === f.playerId)!;
  activity.status = "STEWARDED";
  activity.statusSinceCycleKey = "2026-09-20";

  let result = generateWorldOpportunities(f.aggregate);
  ok(result.promotionsConsidered === 0, "STEWARDED promotion was treated as actively available for Opportunities");
  ok(result.talentWindowsCreated === 0, "STEWARDED player received a new Talent Window");

  activity.status = "ACTIVE";
  activity.statusSinceCycleKey = "2026-10-04";
  result = generateWorldOpportunities(f.aggregate);
  ok(result.talentWindowsCreated === 1, "returning ACTIVE player did not regain Opportunity generation");
});

await test("weekly scheduler commits Talent Window generation atomically with World resolution", async () => {
  const f = fixture(18604);
  const personId = prepareOnlyMeaningfulFreeAgent(f.aggregate);
  const person = f.aggregate.state.people.find((candidate) => candidate.id === personId)!;

  for (const promotion of f.aggregate.state.promotions) {
    if (promotion.id === f.promotionId) continue;
    promotion.financialDistress = "CRISIS";
  }

  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(f.aggregate);
  const result = await resolveScheduledWorldCycle(repository, f.aggregate.state.world.id, "2026-10-05");
  ok(result.status === "RESOLVED", "scheduler did not resolve the World");

  const after = await repository.load(f.aggregate.state.world.id);
  const opportunity = after.engagement?.opportunities.find((candidate) => candidate.title === `${person.name} is available`);
  ok(Boolean(opportunity), "resolved World did not persist its generated Talent Window");
  ok(after.runtime.phase === "OPEN", "Opportunity generation left the World outside OPEN phase");
});

console.log(`\nOpportunity generation tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  createWorld,
  ensurePromotionStandings,
  processPromotionStandingForWeek,
  promotionStandingFor,
  resolveWorldWeeks,
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

function prepareStrongYear(state: ReturnType<typeof createWorld>, promotionId: string): void {
  const promotion = state.promotions.find((entry) => entry.id === promotionId)!;
  promotion.financialDistress = "HEALTHY";
  promotion.mediaReach = 92;
  for (const local of state.promotionMarketStates) {
    if (local.promotionId !== promotionId) continue;
    local.loyalty = 88;
    local.liveStrength = 90;
    local.awareness = 92;
  }
  const venueById = new Map(state.venues.map((venue) => [venue.id, venue]));
  for (const event of state.events) {
    if (event.promotionId !== promotionId || event.date.year !== state.world.currentDate.year) continue;
    event.status = "COMPLETED";
    event.crowdResponse = 92;
    event.averageMatchRating = 4.25;
    event.attendance = Math.min(event.expectedDemand, venueById.get(event.venueId)?.capacity ?? event.expectedDemand);
  }
  for (const title of state.championships ?? []) {
    if (title.promotionId === promotionId) title.prestige = 88;
  }
}

function prepareWeakYear(state: ReturnType<typeof createWorld>, promotionId: string): void {
  const promotion = state.promotions.find((entry) => entry.id === promotionId)!;
  promotion.financialDistress = "CRISIS";
  promotion.mediaReach = 5;
  for (const local of state.promotionMarketStates) {
    if (local.promotionId !== promotionId) continue;
    local.loyalty = 8;
    local.liveStrength = 7;
    local.awareness = 10;
  }
  for (const event of state.events) {
    if (event.promotionId !== promotionId || event.date.year !== state.world.currentDate.year) continue;
    event.status = "CANCELLED";
    event.attendance = 0;
    event.crowdResponse = 20;
    event.averageMatchRating = 1.75;
  }
  for (const title of state.championships ?? []) {
    if (title.promotionId === promotionId) title.prestige = 30;
  }
}

test("promotion standing begins differentiated by established company scale", () => {
  const state = createWorld(10301, DEFAULT_RULESET);
  const standings = ensurePromotionStandings(state);
  ok(standings.length === state.promotions.length, `expected ${state.promotions.length} standings, got ${standings.length}`);
  const global = promotionStandingFor(state, state.promotions[0]!.id);
  const independent = promotionStandingFor(state, state.promotions[state.promotions.length - 1]!.id);
  ok(global.prestige > independent.prestige + 30, `initial prestige hierarchy too flat: ${global.prestige} vs ${independent.prestige}`);
  ok(global.businessReputation > independent.businessReputation + 25, "initial business reputation hierarchy too flat");
});

test("a strong year materially improves fan and business reputation", () => {
  const state = createWorld(10302, DEFAULT_RULESET);
  resolveWorldWeeks(state, 51);
  const promotion = state.promotions[3]!;
  const standing = promotionStandingFor(state, promotion.id);
  standing.prestige = 35;
  standing.fanReputation = 35;
  standing.businessReputation = 35;
  prepareStrongYear(state, promotion.id);
  processPromotionStandingForWeek(state);
  ok(standing.fanReputation >= 50, `fan reputation did not respond strongly enough: ${standing.fanReputation}`);
  ok(standing.businessReputation >= 50, `business reputation did not respond strongly enough: ${standing.businessReputation}`);
  ok(standing.prestige > 35, `prestige did not rise after strong evidence: ${standing.prestige}`);
});

test("current reputation can collapse faster than accumulated prestige", () => {
  const state = createWorld(10303, DEFAULT_RULESET);
  resolveWorldWeeks(state, 51);
  const promotion = state.promotions[5]!;
  const standing = promotionStandingFor(state, promotion.id);
  standing.prestige = 85;
  standing.fanReputation = 85;
  standing.businessReputation = 85;
  prepareWeakYear(state, promotion.id);
  processPromotionStandingForWeek(state);
  const prestigeDrop = 85 - standing.prestige;
  const fanDrop = 85 - standing.fanReputation;
  const businessDrop = 85 - standing.businessReputation;
  console.log(`  bad-year response: prestige -${prestigeDrop.toFixed(1)}, fan -${fanDrop.toFixed(1)}, business -${businessDrop.toFixed(1)}`);
  ok(fanDrop >= prestigeDrop * 4, `fan reputation was not materially more reactive than prestige: ${fanDrop} vs ${prestigeDrop}`);
  ok(businessDrop >= prestigeDrop * 4, `business reputation was not materially more reactive than prestige: ${businessDrop} vs ${prestigeDrop}`);
  ok(prestigeDrop <= 4, `one bad year erased too much historical prestige: ${prestigeDrop}`);
});

test("a decade creates bounded and meaningfully differentiated promotion standings", () => {
  const state = createWorld(20261002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const standings = ensurePromotionStandings(state);
  const values = standings.flatMap((standing) => [standing.prestige, standing.fanReputation, standing.businessReputation]);
  ok(values.every((value) => value >= 0 && value <= 100), "promotion standing escaped the 0-100 bounds");
  const prestige = standings.map((standing) => standing.prestige);
  const fans = standings.map((standing) => standing.fanReputation);
  const prestigeRange = Math.max(...prestige) - Math.min(...prestige);
  const fanRange = Math.max(...fans) - Math.min(...fans);
  const leader = [...standings].sort((a, b) => b.prestige - a.prestige)[0]!;
  console.log(`  standing diagnostics: prestige range ${prestigeRange.toFixed(1)}, fan range ${fanRange.toFixed(1)}, leader ${leader.promotionId} at ${leader.prestige}`);
  ok(prestigeRange >= 18, `decade prestige became too homogeneous: range ${prestigeRange}`);
  ok(fanRange >= 8, `decade fan reputation became too homogeneous: range ${fanRange}`);
  ok(standings.every((standing) => standing.lastEvaluatedYear === 10), "not every promotion received each annual standing evaluation");
});

console.log(`\nPromotion standing tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

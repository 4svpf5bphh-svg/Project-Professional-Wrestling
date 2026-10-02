import type {
  AiProfile,
  CareerStage,
  Market,
  Person,
  Promotion,
  PromotionTier,
  Ruleset,
  World,
  WorldState,
  WrestlerPriorities,
  WrestlerSkills,
} from "../../domain/src/types.js";
import { DeterministicRng } from "./rng.js";
import { LedgerWriter } from "./ledger.js";

const MARKET_PREFIXES = [
  "North", "South", "East", "West", "Central", "Upper", "Lower", "Grand", "River", "Crown",
  "Iron", "Coastal", "Metro", "Highland", "Capital", "Lakes", "Valley", "Midland", "Frontier", "Harbour",
] as const;
const MARKET_SUFFIXES = ["Territory", "Region", "Circuit", "Market", "District"] as const;
const PROMOTION_PREFIXES = ["Titan", "Crown", "Vanguard", "Ironclad", "Summit", "Revolution", "Atlas", "Northstar", "Frontier", "Pulse", "Heritage", "Apex"] as const;
const PROMOTION_SUFFIXES = ["Wrestling", "Pro", "Championship Wrestling", "Combat", "Alliance", "Federation"] as const;
const FIRST_NAMES = ["Alex", "Jordan", "Morgan", "Riley", "Cameron", "Taylor", "Casey", "Drew", "Logan", "Avery", "Jamie", "Parker", "Rowan", "Blake", "Reese", "Quinn"] as const;
const LAST_NAMES = ["Stone", "King", "Vale", "Cross", "Mercer", "Black", "Hart", "Reed", "Storm", "Cole", "Fox", "Drake", "Knight", "Wolfe", "Rivers", "Steel"] as const;

function stat(rng: DeterministicRng, min = 35, max = 85): number {
  return rng.int(min, max);
}

function profile(rng: DeterministicRng): AiProfile {
  return {
    financialCaution: stat(rng, 25, 90),
    starPreference: stat(rng, 25, 90),
    developmentPreference: stat(rng, 25, 90),
    matchQualityPreference: stat(rng, 25, 90),
    expansionAggression: stat(rng, 20, 90),
    loyalty: stat(rng, 20, 90),
    riskTolerance: stat(rng, 20, 90),
  };
}

function skills(rng: DeterministicRng, stage: CareerStage): WrestlerSkills {
  const stageShift = stage === "PROSPECT" ? -6 : stage === "PRIME" ? 5 : stage === "VETERAN" ? 3 : 1;
  const physicalShift = stage === "VETERAN" || stage === "SPECIAL_ATTRACTION" ? -5 : 0;
  return {
    inRingQuality: Math.min(99, Math.max(20, stat(rng, 30, 88) + stageShift)),
    matchCraft: Math.min(99, Math.max(20, stat(rng, 30, 88) + (stage === "VETERAN" ? 9 : stageShift))),
    safety: Math.min(99, Math.max(20, stat(rng, 35, 90) + (stage === "VETERAN" ? 5 : 0))),
    stamina: Math.min(99, Math.max(15, stat(rng, 35, 90) + physicalShift)),
    presentation: Math.min(99, Math.max(20, stat(rng, 25, 92) + stageShift)),
  };
}

function priorities(rng: DeterministicRng): WrestlerPriorities {
  return {
    money: stat(rng, 20, 95),
    role: stat(rng, 20, 95),
    prestige: stat(rng, 20, 95),
    schedule: stat(rng, 20, 95),
    loyalty: stat(rng, 20, 95),
    exposure: stat(rng, 20, 95),
  };
}

function careerStage(rng: DeterministicRng): CareerStage {
  const roll = rng.next();
  if (roll < 0.24) return "PROSPECT";
  if (roll < 0.72) return "PRIME";
  if (roll < 0.94) return "VETERAN";
  return "SPECIAL_ATTRACTION";
}

function tierForIndex(index: number, count: number): PromotionTier {
  if (index === 0) return "GLOBAL";
  if (index <= Math.min(2, count - 1)) return "NATIONAL";
  if (index <= Math.min(4, count - 1)) return "RISING";
  return "INDEPENDENT";
}

function cashForTier(tier: PromotionTier, rng: DeterministicRng): number {
  switch (tier) {
    case "GLOBAL": return rng.int(70_000_000, 110_000_000);
    case "NATIONAL": return rng.int(25_000_000, 50_000_000);
    case "RISING": return rng.int(8_000_000, 20_000_000);
    case "INDEPENDENT": return rng.int(1_500_000, 6_000_000);
    case "LOCAL": return rng.int(250_000, 1_000_000);
  }
}

function recurringFinanceForTier(tier: PromotionTier, rng: DeterministicRng): { media: number; sponsor: number; overhead: number } {
  switch (tier) {
    case "GLOBAL": return { media: rng.int(1_200_000, 1_800_000), sponsor: rng.int(300_000, 600_000), overhead: rng.int(800_000, 1_200_000) };
    case "NATIONAL": return { media: rng.int(450_000, 750_000), sponsor: rng.int(120_000, 280_000), overhead: rng.int(350_000, 600_000) };
    case "RISING": return { media: rng.int(160_000, 300_000), sponsor: rng.int(60_000, 140_000), overhead: rng.int(160_000, 280_000) };
    case "INDEPENDENT": return { media: rng.int(40_000, 90_000), sponsor: rng.int(20_000, 60_000), overhead: rng.int(60_000, 130_000) };
    case "LOCAL": return { media: rng.int(8_000, 30_000), sponsor: rng.int(5_000, 20_000), overhead: rng.int(20_000, 55_000) };
  }
}

function weeklyMarketRate(person: Person): number {
  const averageSkill = (person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation) / 3;
  const stageMultiplier = person.careerStage === "SPECIAL_ATTRACTION" ? 1.35 : person.careerStage === "VETERAN" ? 1.1 : person.careerStage === "PROSPECT" ? 0.75 : 1;
  return Math.round((500 + person.recognition * 50 + person.popularity * 30 + averageSkill * 25) * stageMultiplier);
}

export function createWorld(seed: number, ruleset: Ruleset, name = "PPW Test World"): WorldState {
  const rng = new DeterministicRng(seed);
  const worldId = `world-${seed >>> 0}`;
  const world: World = {
    id: worldId,
    name,
    seed: seed >>> 0,
    rulesetVersion: ruleset.version,
    currentDate: { year: 1, week: 1, day: 1 },
    // Deterministic placeholder: hosting layer will own real creation timestamps.
    createdAtIso: "2000-01-01T00:00:00.000Z",
  };

  const markets: Market[] = Array.from({ length: ruleset.markets }, (_, i) => ({
    id: `market-${String(i + 1).padStart(3, "0")}`,
    worldId,
    name: `${MARKET_PREFIXES[i % MARKET_PREFIXES.length]} ${rng.pick(MARKET_SUFFIXES)}`,
    audiencePotential: rng.int(35, 100),
    wrestlingInterest: rng.int(25, 85),
    spendingIndex: rng.int(50, 120),
    maturity: rng.int(20, 90),
  }));

  const usedPromotionNames = new Set<string>();
  const promotions: Promotion[] = Array.from({ length: ruleset.promotions }, (_, i) => {
    let promotionName = `${rng.pick(PROMOTION_PREFIXES)} ${rng.pick(PROMOTION_SUFFIXES)}`;
    while (usedPromotionNames.has(promotionName)) promotionName = `${rng.pick(PROMOTION_PREFIXES)} ${rng.pick(PROMOTION_SUFFIXES)}`;
    usedPromotionNames.add(promotionName);
    const tier = tierForIndex(i, ruleset.promotions);
    const recurringFinance = recurringFinanceForTier(tier, rng);
    return {
      id: `promotion-${String(i + 1).padStart(3, "0")}`,
      worldId,
      name: promotionName,
      tier,
      lifecycle: "ACTIVE",
      controllerType: "AI",
      homeMarketId: markets[i % markets.length]!.id,
      cash: cashForTier(tier, rng),
      debt: 0,
      mediaReach: tier === "GLOBAL" ? rng.int(80, 100) : tier === "NATIONAL" ? rng.int(55, 80) : tier === "RISING" ? rng.int(30, 60) : rng.int(10, 40),
      weeklyMediaIncome: recurringFinance.media,
      weeklySponsorIncome: recurringFinance.sponsor,
      weeklyFixedOverhead: recurringFinance.overhead,
      weeklyTalentCommitment: 0,
      lastWeeklyNet: 0,
      runwayWeeks: null,
      financialDistress: "HEALTHY",
      aiProfile: profile(rng),
      rosterPersonIds: [],
    };
  });

  const people: Person[] = Array.from({ length: ruleset.wrestlers }, (_, i) => {
    const stage = careerStage(rng);
    return {
      id: `person-${String(i + 1).padStart(4, "0")}`,
      worldId,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)} ${i + 1}`,
      careerStage: stage,
      status: "ACTIVE",
      homeMarketId: rng.pick(markets).id,
      fatigue: 0,
      wear: stage === "PROSPECT" ? rng.int(0, 8) : stage === "PRIME" ? rng.int(2, 20) : rng.int(12, 45),
      morale: rng.int(55, 85),
      momentum: rng.int(25, 65),
      recognition: rng.int(stage === "PROSPECT" ? 5 : 15, stage === "SPECIAL_ATTRACTION" ? 90 : 75),
      popularity: rng.int(stage === "PROSPECT" ? 5 : 15, stage === "SPECIAL_ATTRACTION" ? 90 : 75),
      skills: skills(rng, stage),
      priorities: priorities(rng),
      contractedPromotionId: null,
    };
  });

  // Initial labour allocation is intentionally conservative. It reserves a healthy free-agent pool
  // instead of reserving named individuals for future humans.
  const targetContracted = Math.floor(people.length * ruleset.initialContractedTalentRatio);
  const sortedByValue = [...people].sort((a, b) => {
    const aValue = a.skills.inRingQuality + a.skills.matchCraft + a.skills.presentation + a.recognition;
    const bValue = b.skills.inRingQuality + b.skills.matchCraft + b.skills.presentation + b.recognition;
    return bValue - aValue || a.id.localeCompare(b.id);
  });

  for (let i = 0; i < targetContracted; i += 1) {
    const person = sortedByValue[i]!;
    // Weighted but imperfect distribution: stronger promotions get more early picks without total hoarding.
    const poolSize = Math.max(1, Math.min(promotions.length, 1 + Math.floor((i / Math.max(1, targetContracted)) * promotions.length)));
    const promotion = promotions[rng.int(0, poolSize - 1)]!;
    person.contractedPromotionId = promotion.id;
    promotion.rosterPersonIds.push(person.id);
  }

  const peopleById = new Map(people.map((person) => [person.id, person]));
  for (const promotion of promotions) {
    promotion.weeklyTalentCommitment = promotion.rosterPersonIds.reduce((sum, personId) => {
      const person = peopleById.get(personId);
      return sum + (person ? weeklyMarketRate(person) : 0);
    }, 0);
  }

  const ledger = [] as WorldState["ledger"];
  const writer = new LedgerWriter(worldId, ledger);
  writer.append({
    date: world.currentDate,
    type: "WORLD_CREATED",
    significance: "HISTORIC",
    entityIds: [worldId],
    payload: { seed: world.seed, ruleset: ruleset.version },
  });
  for (const promotion of promotions) {
    writer.append({
      date: world.currentDate,
      type: "PROMOTION_FOUNDED",
      significance: promotion.tier === "GLOBAL" ? "MAJOR" : "NOTABLE",
      entityIds: [promotion.id, promotion.homeMarketId],
      payload: { name: promotion.name, tier: promotion.tier },
    });
  }
  writer.append({
    date: world.currentDate,
    type: "WORLD_GENESIS_COMPLETED",
    significance: "MAJOR",
    entityIds: [worldId],
    payload: {
      markets: markets.length,
      promotions: promotions.length,
      wrestlers: people.length,
      contracted: targetContracted,
      freeAgents: people.length - targetContracted,
    },
  });

  return { world, ruleset: { ...ruleset }, markets, promotions, people, financialTransactions: [], ledger };
}

import type { FinancialDistressState, WorldState } from "../../domain/src/types.js";
import { activeContractsForPerson, activeContractsForPromotion, contractIsActive } from "./contracts.js";

function fnv1a32Update(hash: number, text: string): number {
  let next = hash >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    next ^= text.charCodeAt(i);
    next = Math.imul(next, 0x01000193);
  }
  return next >>> 0;
}

function hashJsonValue(hash: number, value: unknown): number {
  return fnv1a32Update(hash, JSON.stringify(value));
}

export interface WorldSummary {
  worldId: string;
  seed: number;
  ruleset: string;
  year: number;
  week: number;
  markets: number;
  venues: number;
  promotions: number;
  wrestlers: number;
  activeWrestlers: number;
  retiredWrestlers: number;
  generatedTalent: number;
  averageBiologicalAge: number;
  averageCareerExperience: number;
  contractedWrestlers: number;
  freeAgents: number;
  multiPromotionWrestlers: number;
  activeContracts: number;
  exclusiveContracts: number;
  limitedContracts: number;
  oneOffContracts: number;
  expiredContracts: number;
  contractOffers: number;
  acceptedOffers: number;
  rejectedOffers: number;
  events: number;
  completedEvents: number;
  cancelledEvents: number;
  totalAttendance: number;
  totalGateRevenue: number;
  completedAppearances: number;
  matches: number;
  completedMatches: number;
  singlesMatches: number;
  tagMatches: number;
  averageMatchRating: number;
  fourStarMatches: number;
  injuries: number;
  activeInjuries: number;
  globalPromotion: string | null;
  ledgerEvents: number;
  financialTransactions: number;
  totalPromotionCash: number;
  distressCounts: Record<FinancialDistressState, number>;
  rosterSizes: { promotionId: string; tier: string; activePeople: number }[];
  deterministicHash: string;
}

export function deterministicWorldHash(state: WorldState): string {
  let hash = 0x811c9dc5;
  hash = fnv1a32Update(hash, "world:");
  hash = hashJsonValue(hash, state.world);
  hash = fnv1a32Update(hash, "|ruleset:");
  hash = hashJsonValue(hash, state.ruleset);

  const collections: [string, readonly unknown[]][] = [
    ["markets", state.markets],
    ["venues", state.venues],
    ["promotions", state.promotions],
    ["promotionMarketStates", state.promotionMarketStates],
    ["people", state.people],
    ["contracts", state.contracts],
    ["contractOffers", state.contractOffers],
    ["events", state.events],
    ["scheduledAppearances", state.scheduledAppearances],
    ["matches", state.matches],
    ["matchParticipants", state.matchParticipants],
    ["injuries", state.injuries],
    ["workingChemistry", state.workingChemistry],
    ["financialTransactions", state.financialTransactions],
    ["ledger", state.ledger],
  ];

  for (const [name, collection] of collections) {
    hash = fnv1a32Update(hash, `|${name}:${collection.length}:[`);
    const indexes = deterministicSampleIndexes(collection.length);
    for (const index of indexes) {
      hash = fnv1a32Update(hash, `${index}:`);
      hash = hashJsonValue(hash, collection[index]);
      hash = fnv1a32Update(hash, ",");
    }
    hash = fnv1a32Update(hash, "]");
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function deterministicSampleIndexes(length: number): number[] {
  if (length <= 256) return Array.from({ length }, (_, index) => index);
  const indexes = new Set<number>();
  for (let index = 0; index < Math.min(24, length); index += 1) indexes.add(index);
  for (let index = Math.max(0, length - 72); index < length; index += 1) indexes.add(index);
  const samples = 128;
  for (let sample = 0; sample < samples; sample += 1) {
    indexes.add(Math.floor((sample * (length - 1)) / Math.max(1, samples - 1)));
  }
  return [...indexes].sort((a, b) => a - b);
}

export function summarizeWorld(state: WorldState): WorldSummary {
  const activeContracts = state.contracts.filter((contract) => contractIsActive(state, contract));
  const activePeople = state.people.filter((person) => person.status !== "RETIRED");
  const contracted = activePeople.filter((person) => activeContractsForPerson(state, person.id).length > 0).length;
  const multiPromotionWrestlers = activePeople.filter((person) => new Set(activeContractsForPerson(state, person.id).map((contract) => contract.promotionId)).size > 1).length;
  const globalPromotion = state.promotions.find((p) => p.tier === "GLOBAL") ?? null;
  const completedEvents = state.events.filter((event) => event.status === "COMPLETED");
  const distressCounts: Record<FinancialDistressState, number> = {
    HEALTHY: 0,
    WATCH: 0,
    DISTRESSED: 0,
    CRISIS: 0,
  };
  for (const promotion of state.promotions) distressCounts[promotion.financialDistress] += 1;

  return {
    worldId: state.world.id,
    seed: state.world.seed,
    ruleset: state.ruleset.version,
    year: state.world.currentDate.year,
    week: state.world.currentDate.week,
    markets: state.markets.length,
    venues: state.venues.length,
    promotions: state.promotions.length,
    wrestlers: state.people.length,
    activeWrestlers: activePeople.length,
    retiredWrestlers: state.people.filter((person) => person.status === "RETIRED").length,
    generatedTalent: state.people.filter((person) => person.generatedTalent).length,
    averageBiologicalAge: Math.round((activePeople.reduce((sum, person) => sum + person.biologicalAge, 0) / Math.max(1, activePeople.length)) * 100) / 100,
    averageCareerExperience: Math.round((activePeople.reduce((sum, person) => sum + person.careerExperience, 0) / Math.max(1, activePeople.length)) * 100) / 100,
    contractedWrestlers: contracted,
    freeAgents: activePeople.length - contracted,
    multiPromotionWrestlers,
    activeContracts: activeContracts.length,
    exclusiveContracts: activeContracts.filter((contract) => contract.family === "EXCLUSIVE").length,
    limitedContracts: activeContracts.filter((contract) => contract.family === "LIMITED_NON_EXCLUSIVE").length,
    oneOffContracts: activeContracts.filter((contract) => contract.family === "ONE_OFF").length,
    expiredContracts: state.contracts.filter((contract) => contract.status === "EXPIRED").length,
    contractOffers: state.contractOffers.length,
    acceptedOffers: state.contractOffers.filter((offer) => offer.status === "ACCEPTED").length,
    rejectedOffers: state.contractOffers.filter((offer) => offer.status === "REJECTED").length,
    events: state.events.length,
    completedEvents: completedEvents.length,
    cancelledEvents: state.events.filter((event) => event.status === "CANCELLED").length,
    totalAttendance: completedEvents.reduce((sum, event) => sum + event.attendance, 0),
    totalGateRevenue: completedEvents.reduce((sum, event) => sum + event.gateRevenue, 0),
    completedAppearances: state.scheduledAppearances.filter((appearance) => appearance.status === "COMPLETED").length,
    matches: state.matches.length,
    completedMatches: state.matches.filter((match) => match.status === "COMPLETED").length,
    singlesMatches: state.matches.filter((match) => match.status === "COMPLETED" && match.type === "SINGLES").length,
    tagMatches: state.matches.filter((match) => match.status === "COMPLETED" && match.type === "TAG").length,
    averageMatchRating: (() => {
      const completed = state.matches.filter((match) => match.status === "COMPLETED");
      return completed.length === 0 ? 0 : Math.round((completed.reduce((sum, match) => sum + match.criticalRatingStars, 0) / completed.length) * 100) / 100;
    })(),
    fourStarMatches: state.matches.filter((match) => match.status === "COMPLETED" && match.criticalRatingStars >= 4).length,
    injuries: state.injuries.length,
    activeInjuries: state.injuries.filter((injury) => injury.status === "ACTIVE").length,
    globalPromotion: globalPromotion?.name ?? null,
    ledgerEvents: state.ledger.length,
    financialTransactions: state.financialTransactions.length,
    totalPromotionCash: Math.round(state.promotions.reduce((sum, promotion) => sum + promotion.cash, 0)),
    distressCounts,
    rosterSizes: state.promotions.map((promotion) => ({ promotionId: promotion.id, tier: promotion.tier, activePeople: activeContractsForPromotion(state, promotion.id).length })),
    deterministicHash: deterministicWorldHash(state),
  };
}

import type {
  Contract,
  Market,
  Person,
  Promotion,
  PromotionMarketState,
  ScheduledAppearance,
  TicketStrategy,
  Venue,
  WorldState,
  WrestlingEvent,
  WrestlingEventType,
} from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { activeContractsForPromotion, serviceCapacityDatesPerWeek } from "./contracts.js";
import { LedgerWriter } from "./ledger.js";
import { DeterministicRng, deterministicSeedFromText } from "./rng.js";
import { recordFinancialTransaction } from "./transactions.js";

const ROLE_PRIORITY: Record<Contract["roleExpectation"], number> = {
  DEVELOPMENTAL: 20,
  REGULAR: 40,
  FEATURED: 60,
  UPPER_CARD: 78,
  MAIN_EVENT: 94,
  SPECIAL_ATTRACTION: 92,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function samePpwWeek(a: { year: number; week: number }, b: { year: number; week: number }): boolean {
  return a.year === b.year && a.week === b.week;
}

function samePpwDate(a: { year: number; week: number; day: number }, b: { year: number; week: number; day: number }): boolean {
  return samePpwWeek(a, b) && a.day === b.day;
}

function eventRosterTarget(promotion: Promotion, type: WrestlingEventType): number {
  const regular = promotion.tier === "GLOBAL" ? 16
    : promotion.tier === "NATIONAL" ? 14
      : promotion.tier === "RISING" ? 12
        : promotion.tier === "INDEPENDENT" ? 10
          : 8;
  return type === "MAJOR" ? regular + 2 : regular;
}

function productionCost(promotion: Promotion, type: WrestlingEventType): number {
  const regular = promotion.tier === "GLOBAL" ? 260_000
    : promotion.tier === "NATIONAL" ? 125_000
      : promotion.tier === "RISING" ? 60_000
        : promotion.tier === "INDEPENDENT" ? 25_000
          : 12_000;
  return type === "MAJOR" ? Math.round(regular * 1.75) : regular;
}

function travelCost(promotion: Promotion, participants: number, away: boolean): number {
  if (!away) return 0;
  const base = promotion.tier === "GLOBAL" ? 45_000
    : promotion.tier === "NATIONAL" ? 30_000
      : promotion.tier === "RISING" ? 18_000
        : promotion.tier === "INDEPENDENT" ? 10_000
          : 6_000;
  return base + participants * (promotion.tier === "GLOBAL" ? 2_000 : promotion.tier === "NATIONAL" ? 1_500 : 1_000);
}

function ticketStrategyFor(promotion: Promotion, type: WrestlingEventType): TicketStrategy {
  if (type === "MAJOR") {
    if (promotion.tier === "GLOBAL") return "PRESTIGE";
    if (promotion.tier === "NATIONAL") return "PREMIUM";
    return "STANDARD";
  }
  if (promotion.tier === "GLOBAL") return "PREMIUM";
  if (promotion.tier === "NATIONAL") return promotion.aiProfile.financialCaution < 50 ? "PREMIUM" : "STANDARD";
  if (promotion.tier === "INDEPENDENT" || promotion.tier === "LOCAL") return "ACCESSIBLE";
  return "STANDARD";
}

function baseTicketPrice(strategy: TicketStrategy): number {
  switch (strategy) {
    case "ACCESSIBLE": return 32;
    case "STANDARD": return 48;
    case "PREMIUM": return 72;
    case "PRESTIGE": return 110;
  }
}

function demandMultiplierForTicketStrategy(strategy: TicketStrategy): number {
  switch (strategy) {
    case "ACCESSIBLE": return 1.14;
    case "STANDARD": return 1;
    case "PREMIUM": return 0.86;
    case "PRESTIGE": return 0.68;
  }
}

function promotionMarketState(state: WorldState, promotionId: string, marketId: string): PromotionMarketState {
  const marketState = state.promotionMarketStates.find((candidate) => candidate.promotionId === promotionId && candidate.marketId === marketId);
  if (!marketState) throw new Error(`missing promotion-market state for ${promotionId}/${marketId}`);
  return marketState;
}

function personEventValue(person: Person, contract: Contract, type: WrestlingEventType): number {
  const wrestling = (person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation) / 3;
  const star = (person.recognition + person.popularity + person.momentum) / 3;
  const role = ROLE_PRIORITY[contract.roleExpectation];
  return wrestling * (type === "MAJOR" ? 0.25 : 0.35) + star * (type === "MAJOR" ? 0.55 : 0.4) + role * 0.2;
}

function appearanceDateKey(personId: string, date: WrestlingEvent["date"]): string {
  return `${personId}:${date.year}:${date.week}:${date.day}`;
}

function chooseContractForPerson(contracts: Contract[]): Contract | null {
  const usable = contracts.filter((contract) => contract.datesUsed < contract.dateEntitlement);
  if (usable.length === 0) return null;
  return [...usable].sort((a, b) => {
    const remainingA = a.dateEntitlement - a.datesUsed;
    const remainingB = b.dateEntitlement - b.datesUsed;
    return remainingA - remainingB || a.id.localeCompare(b.id);
  })[0]!;
}

function selectAppearances(
  state: WorldState,
  promotion: Promotion,
  type: WrestlingEventType,
  eventDate: WrestlingEvent["date"],
  weeklyCounts: Map<string, number>,
  dateBookings: Set<string>,
): { person: Person; contract: Contract }[] {
  const contractsByPerson = new Map<string, Contract[]>();
  for (const contract of activeContractsForPromotion(state, promotion.id)) {
    if (contract.datesUsed >= contract.dateEntitlement) continue;
    const list = contractsByPerson.get(contract.personId) ?? [];
    list.push(contract);
    contractsByPerson.set(contract.personId, list);
  }

  const candidates: { person: Person; contract: Contract; score: number }[] = [];
  for (const [personId, contracts] of contractsByPerson) {
    const person = state.people.find((candidate) => candidate.id === personId);
    if (!person || person.status !== "ACTIVE") continue;
    if (dateBookings.has(appearanceDateKey(person.id, eventDate))) continue;
    const capacity = Math.max(1, Math.floor(serviceCapacityDatesPerWeek(person)));
    if ((weeklyCounts.get(person.id) ?? 0) >= capacity) continue;
    const contract = chooseContractForPerson(contracts);
    if (!contract) continue;
    candidates.push({ person, contract, score: personEventValue(person, contract, type) });
  }

  candidates.sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id));
  return candidates.slice(0, eventRosterTarget(promotion, type)).map(({ person, contract }) => ({ person, contract }));
}

function eventDayFor(state: WorldState, promotion: Promotion, type: WrestlingEventType): number {
  if (type === "MAJOR") return 7;
  const promotionIndex = state.promotions.findIndex((candidate) => candidate.id === promotion.id);
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  return 2 + ((promotionIndex + weekIndex) % 6);
}

function selectMarket(state: WorldState, promotion: Promotion, type: WrestlingEventType, rng: DeterministicRng): Market {
  const home = state.markets.find((market) => market.id === promotion.homeMarketId)!;
  if (type === "MAJOR") return home;
  const tierTravelFactor = promotion.tier === "GLOBAL" ? 1
    : promotion.tier === "NATIONAL" ? 0.8
      : promotion.tier === "RISING" ? 0.6
        : promotion.tier === "INDEPENDENT" ? 0.42
          : 0.25;
  const travelChance = tierTravelFactor * (0.08 + promotion.aiProfile.expansionAggression / 350);
  if (!rng.chance(travelChance)) return home;

  const candidates = state.markets
    .filter((market) => market.id !== home.id)
    .map((market) => ({ market, marketState: promotionMarketState(state, promotion.id, market.id) }))
    .sort((a, b) => (b.marketState.awareness + b.marketState.liveStrength) - (a.marketState.awareness + a.marketState.liveStrength) || a.market.id.localeCompare(b.market.id));
  const shortlist = candidates.slice(0, Math.min(6, candidates.length));
  return shortlist.length > 0 ? rng.pick(shortlist).market : home;
}

function ticketYield(strategy: TicketStrategy, market: Market): number {
  return Math.round(baseTicketPrice(strategy) * (0.72 + market.spendingIndex / 250) * 100) / 100;
}

function estimateDemand(state: WorldState, promotion: Promotion, market: Market, type: WrestlingEventType, strategy: TicketStrategy, people: Person[]): number {
  const local = promotionMarketState(state, promotion.id, market.id);
  const marketPotential = market.audiencePotential * 115;
  const localFactor = (0.25 + local.liveStrength / 155) * (0.68 + local.awareness / 310);
  const interestFactor = 0.68 + market.wrestlingInterest / 190;
  const mediaFactor = 0.78 + promotion.mediaReach / 245;
  const eventFactor = type === "MAJOR" ? 1.32 : 0.86;
  const top = [...people]
    .sort((a, b) => (b.recognition + b.popularity + b.skills.presentation) - (a.recognition + a.popularity + a.skills.presentation))
    .slice(0, 6);
  const starAverage = top.length === 0 ? 20 : top.reduce((sum, person) => sum + (person.recognition + person.popularity + person.skills.presentation) / 3, 0) / top.length;
  const starFactor = 0.74 + starAverage / 210;
  const ticketFactor = demandMultiplierForTicketStrategy(strategy);
  return Math.max(100, Math.round(marketPotential * localFactor * interestFactor * mediaFactor * eventFactor * starFactor * ticketFactor));
}

function chooseVenue(state: WorldState, marketId: string, eventDate: WrestlingEvent["date"], expectedDemand: number): Venue {
  const occupied = new Set(state.events
    .filter((event) => event.status === "SCHEDULED" && samePpwDate(event.date, eventDate))
    .map((event) => event.venueId));
  const available = state.venues
    .filter((venue) => venue.marketId === marketId && !occupied.has(venue.id))
    .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));
  const choices = available.length > 0 ? available : state.venues.filter((venue) => venue.marketId === marketId).sort((a, b) => a.capacity - b.capacity);
  const target = expectedDemand * 1.08;
  return choices.find((venue) => venue.capacity >= target) ?? choices[choices.length - 1]!;
}

function eventSeed(state: WorldState, promotion: Promotion, salt: string): number {
  const week = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  return deterministicSeedFromText(`${state.world.seed}:${week}:${promotion.id}:${salt}`);
}

export function shouldPromotionRunEvent(state: WorldState, promotion: Promotion): boolean {
  if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") return false;
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  return weekIndex % Math.max(1, promotion.eventCadenceWeeks) === 0;
}

export function planWorldEvents(state: WorldState): void {
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const start = weekIndex % state.promotions.length;
  const orderedPromotions = state.promotions.map((_, index) => state.promotions[(start + index) % state.promotions.length]!);
  const weeklyCounts = new Map<string, number>();
  const dateBookings = new Set<string>();
  for (const appearance of state.scheduledAppearances) {
    if (appearance.status === "CANCELLED" || !samePpwWeek(appearance.date, state.world.currentDate)) continue;
    weeklyCounts.set(appearance.personId, (weeklyCounts.get(appearance.personId) ?? 0) + 1);
    dateBookings.add(appearanceDateKey(appearance.personId, appearance.date));
  }

  for (const promotion of orderedPromotions) {
    if (!shouldPromotionRunEvent(state, promotion)) continue;
    const type: WrestlingEventType = (weekIndex + 1) % state.ruleset.majorEventIntervalWeeks === 0 ? "MAJOR" : "REGULAR";
    const rng = new DeterministicRng(eventSeed(state, promotion, "event-plan"));
    const eventDate = { ...state.world.currentDate, day: eventDayFor(state, promotion, type) };
    const market = selectMarket(state, promotion, type, rng);
    const strategy = ticketStrategyFor(promotion, type);
    const selected = selectAppearances(state, promotion, type, eventDate, weeklyCounts, dateBookings);
    const expectedDemand = estimateDemand(state, promotion, market, type, strategy, selected.map((entry) => entry.person));
    const venue = chooseVenue(state, market.id, eventDate, expectedDemand);
    const event: WrestlingEvent = {
      id: `event-${String(state.events.length + 1).padStart(7, "0")}`,
      worldId: state.world.id,
      promotionId: promotion.id,
      marketId: market.id,
      venueId: venue.id,
      date: eventDate,
      type,
      status: "SCHEDULED",
      ticketStrategy: strategy,
      expectedDemand,
      attendance: 0,
      ticketYield: ticketYield(strategy, market),
      gateRevenue: 0,
      totalCost: 0,
      netResult: 0,
      eventImportance: type === "MAJOR" ? 85 : 58,
    };
    state.events.push(event);

    for (const entry of selected) {
      const appearance: ScheduledAppearance = {
        id: `appearance-${String(state.scheduledAppearances.length + 1).padStart(8, "0")}`,
        worldId: state.world.id,
        eventId: event.id,
        promotionId: promotion.id,
        personId: entry.person.id,
        contractId: entry.contract.id,
        date: { ...eventDate },
        status: "COMMITTED",
      };
      state.scheduledAppearances.push(appearance);
      weeklyCounts.set(entry.person.id, (weeklyCounts.get(entry.person.id) ?? 0) + 1);
      dateBookings.add(appearanceDateKey(entry.person.id, eventDate));
    }
  }
}

function updateMarketAfterEvent(state: WorldState, event: WrestlingEvent, venue: Venue): void {
  const local = promotionMarketState(state, event.promotionId, event.marketId);
  const demandPerformance = event.expectedDemand <= 0 ? 0 : event.attendance / event.expectedDemand;
  const sellThrough = venue.capacity <= 0 ? 0 : event.attendance / venue.capacity;
  const importance = event.type === "MAJOR" ? 1.35 : 1;
  const strengthDelta = demandPerformance >= 0.95 ? 1.1 * importance
    : demandPerformance >= 0.72 ? 0.55 * importance
      : demandPerformance < 0.45 ? -0.45
        : 0.1;
  const awarenessDelta = event.marketId === state.promotions.find((promotion) => promotion.id === event.promotionId)!.homeMarketId
    ? (event.type === "MAJOR" ? 0.5 : 0.2)
    : (event.type === "MAJOR" ? 1.4 : 0.75);
  local.liveStrength = Math.round(clamp(local.liveStrength + strengthDelta, 2, 100) * 10) / 10;
  local.awareness = Math.round(clamp(local.awareness + awarenessDelta, 2, 100) * 10) / 10;
  local.loyalty = Math.round(clamp(local.loyalty + (sellThrough >= 0.75 ? 0.25 : sellThrough < 0.3 ? -0.2 : 0.05), 2, 100) * 10) / 10;
}

function resolveEvent(
  state: WorldState,
  event: WrestlingEvent,
  appearances: ScheduledAppearance[],
  competitionCount: number,
  promotion: Promotion,
  market: Market,
  venue: Venue,
  contractById: Map<string, Contract>,
): void {
  if (event.status !== "SCHEDULED") return;
  const writer = new LedgerWriter(state.world.id, state.ledger);

  if (appearances.length < state.ruleset.minEventParticipants) {
    event.status = "CANCELLED";
    for (const appearance of appearances) appearance.status = "CANCELLED";
    writer.append({
      date: event.date,
      type: "EVENT_CANCELLED",
      significance: event.type === "MAJOR" ? "MAJOR" : "NOTABLE",
      entityIds: [event.id, promotion.id],
      payload: { reason: "insufficient available contracted talent", participants: appearances.length },
    });
    return;
  }

  const competitionFactor = 1 / (1 + competitionCount * 0.14);
  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${event.id}:attendance`));
  const actualDemand = Math.max(0, Math.round(event.expectedDemand * competitionFactor * rng.float(0.92, 1.08)));
  event.attendance = Math.min(venue.capacity, actualDemand);
  event.gateRevenue = Math.round(event.attendance * event.ticketYield);

  recordFinancialTransaction(state, promotion, "GATE_REVENUE", event.gateRevenue, event.id);
  recordFinancialTransaction(state, promotion, "VENUE_COST", -venue.weeklyHireCost, event.id);
  const production = productionCost(promotion, event.type);
  recordFinancialTransaction(state, promotion, "PRODUCTION_COST", -production, event.id);
  const travel = travelCost(promotion, appearances.length, event.marketId !== promotion.homeMarketId);
  if (travel > 0) recordFinancialTransaction(state, promotion, "TRAVEL_COST", -travel, event.id);

  let appearanceCost = 0;
  for (const appearance of appearances) {
    const contract = contractById.get(appearance.contractId);
    if (!contract || contract.datesUsed >= contract.dateEntitlement) {
      appearance.status = "CANCELLED";
      continue;
    }
    contract.datesUsed += 1;
    appearance.status = "COMPLETED";
    if (contract.appearanceFee > 0) {
      appearanceCost += contract.appearanceFee;
      recordFinancialTransaction(state, promotion, "APPEARANCE_FEE", -contract.appearanceFee, appearance.id);
    }
  }

  event.totalCost = venue.weeklyHireCost + production + travel + appearanceCost;
  event.netResult = event.gateRevenue - event.totalCost;
  event.status = "COMPLETED";
  updateMarketAfterEvent(state, event, venue);

  writer.append({
    date: event.date,
    type: "EVENT_COMPLETED",
    significance: event.type === "MAJOR" ? "MAJOR" : "ROUTINE",
    entityIds: [event.id, promotion.id, market.id, venue.id],
    payload: {
      type: event.type,
      attendance: event.attendance,
      capacity: venue.capacity,
      gateRevenue: event.gateRevenue,
      eventCost: event.totalCost,
      eventNet: event.netResult,
      participants: appearances.filter((appearance) => appearance.status === "COMPLETED").length,
    },
  });
}

export function resolveWorldEvents(state: WorldState): void {
  const current = state.world.currentDate;
  const events = state.events
    .filter((event) => event.status === "SCHEDULED" && samePpwWeek(event.date, current))
    .sort((a, b) => a.date.day - b.date.day || a.id.localeCompare(b.id));
  const eventIds = new Set(events.map((event) => event.id));
  const appearancesByEvent = new Map<string, ScheduledAppearance[]>();
  for (const appearance of state.scheduledAppearances) {
    if (appearance.status !== "COMMITTED" || !eventIds.has(appearance.eventId)) continue;
    const list = appearancesByEvent.get(appearance.eventId) ?? [];
    list.push(appearance);
    appearancesByEvent.set(appearance.eventId, list);
  }
  const competitionByMarket = new Map<string, number>();
  for (const event of events) competitionByMarket.set(event.marketId, (competitionByMarket.get(event.marketId) ?? 0) + 1);
  const promotionById = new Map(state.promotions.map((promotion) => [promotion.id, promotion]));
  const marketById = new Map(state.markets.map((market) => [market.id, market]));
  const venueById = new Map(state.venues.map((venue) => [venue.id, venue]));
  const contractById = new Map(state.contracts.map((contract) => [contract.id, contract]));

  for (const event of events) {
    const promotion = promotionById.get(event.promotionId);
    const market = marketById.get(event.marketId);
    const venue = venueById.get(event.venueId);
    if (!promotion || !market || !venue) continue;
    resolveEvent(
      state,
      event,
      appearancesByEvent.get(event.id) ?? [],
      Math.max(0, (competitionByMarket.get(event.marketId) ?? 1) - 1),
      promotion,
      market,
      venue,
      contractById,
    );
  }
}

export function planAndResolveWorldEvents(state: WorldState): void {
  planWorldEvents(state);
  resolveWorldEvents(state);
}

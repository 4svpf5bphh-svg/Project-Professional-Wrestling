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
import { contractById, personById } from "./indexes.js";
import { competitionDemandFactor } from "./market-competition.js";
import { resolveEventCard } from "./matches.js";
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

function samePpwDate(
  a: { year: number; week: number; day: number },
  b: { year: number; week: number; day: number },
): boolean {
  return samePpwWeek(a, b) && a.day === b.day;
}

function eventRosterTarget(promotion: Promotion, type: WrestlingEventType): number {
  const regular = promotion.tier === "GLOBAL"
    ? 16
    : promotion.tier === "NATIONAL"
      ? 14
      : promotion.tier === "RISING"
        ? 12
        : promotion.tier === "INDEPENDENT"
          ? 10
          : 8;
  return type === "MAJOR" ? regular + 2 : regular;
}

function productionCost(promotion: Promotion, type: WrestlingEventType): number {
  const regular = promotion.tier === "GLOBAL"
    ? 260000
    : promotion.tier === "NATIONAL"
      ? 125000
      : promotion.tier === "RISING"
        ? 60000
        : promotion.tier === "INDEPENDENT"
          ? 25000
          : 12000;
  return type === "MAJOR" ? Math.round(regular * 1.75) : regular;
}

function travelCost(promotion: Promotion, participants: number, away: boolean): number {
  if (!away) return 0;
  const base = promotion.tier === "GLOBAL"
    ? 45000
    : promotion.tier === "NATIONAL"
      ? 30000
      : promotion.tier === "RISING"
        ? 18000
        : promotion.tier === "INDEPENDENT"
          ? 10000
          : 6000;
  return base + participants * (promotion.tier === "GLOBAL" ? 2000 : promotion.tier === "NATIONAL" ? 1500 : 1000);
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
  const marketState = state.promotionMarketStates.find(
    (entry) => entry.promotionId === promotionId && entry.marketId === marketId,
  );
  if (!marketState) throw new Error(`missing promotion-market state for ${promotionId}/${marketId}`);
  return marketState;
}

function personEventValue(person: Person, contract: Contract, type: WrestlingEventType): number {
  const wrestling = (person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation) / 3;
  const star = (person.recognition + person.popularity + person.momentum) / 3;
  const role = ROLE_PRIORITY[contract.roleExpectation];
  return wrestling * (type === "MAJOR" ? 0.25 : 0.35)
    + star * (type === "MAJOR" ? 0.55 : 0.4)
    + role * 0.2;
}

function appearanceDateKey(personId: string, date: WrestlingEvent["date"]): string {
  return `${personId}:${date.year}:${date.week}:${date.day}`;
}

function chooseContractForPerson(contracts: Contract[]): Contract | null {
  const usable = contracts.filter((contract) => contract.datesUsed < contract.dateEntitlement);
  if (!usable.length) return null;
  return [...usable].sort(
    (a, b) => (a.dateEntitlement - a.datesUsed) - (b.dateEntitlement - b.datesUsed) || a.id.localeCompare(b.id),
  )[0]!;
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
    const person = personById(state, personId);
    if (!person || person.status !== "ACTIVE") continue;
    if (dateBookings.has(appearanceDateKey(person.id, eventDate))) continue;
    const capacity = Math.max(1, Math.floor(serviceCapacityDatesPerWeek(person)));
    if ((weeklyCounts.get(person.id) ?? 0) >= capacity) continue;
    const contract = chooseContractForPerson(contracts);
    if (contract) candidates.push({ person, contract, score: personEventValue(person, contract, type) });
  }

  candidates.sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id));
  const target = eventRosterTarget(promotion, type);
  const selected = candidates.slice(0, target);
  const developmentSlots = type === "REGULAR"
    ? (promotion.aiProfile.developmentPreference >= 75 ? 2 : promotion.aiProfile.developmentPreference >= 45 ? 1 : 0)
    : (promotion.aiProfile.developmentPreference >= 88 ? 1 : 0);

  if (developmentSlots > 0) {
    const prospects = candidates
      .filter((candidate) => candidate.person.careerStage === "PROSPECT"
        || (candidate.person.biologicalAge < 27 && candidate.person.careerExperience < 25))
      .sort((a, b) => (b.person.developmentAptitude * 0.6 + b.score * 0.4)
        - (a.person.developmentAptitude * 0.6 + a.score * 0.4)
        || a.person.id.localeCompare(b.person.id));
    let inserted = 0;
    for (const prospect of prospects) {
      if (inserted >= developmentSlots) break;
      if (selected.some((candidate) => candidate.person.id === prospect.person.id)) {
        inserted += 1;
        continue;
      }
      const replaceIndex = [...selected]
        .map((candidate, index) => ({ candidate, index }))
        .reverse()
        .find(({ candidate }) => !(candidate.person.careerStage === "PROSPECT"
          || (candidate.person.biologicalAge < 27 && candidate.person.careerExperience < 25)))?.index;
      if (replaceIndex === undefined) break;
      selected[replaceIndex] = prospect;
      inserted += 1;
    }
    selected.sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id));
  }

  return selected.map(({ person, contract }) => ({ person, contract }));
}

function eventDayFor(state: WorldState, promotion: Promotion, type: WrestlingEventType): number {
  if (type === "MAJOR") return 7;
  const promotionIndex = state.promotions.findIndex((entry) => entry.id === promotion.id);
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  return 2 + ((promotionIndex + weekIndex) % 6);
}

function selectMarket(state: WorldState, promotion: Promotion, type: WrestlingEventType, rng: DeterministicRng): Market {
  const home = state.markets.find((market) => market.id === promotion.homeMarketId)!;
  if (type === "MAJOR") return home;
  const factor = promotion.tier === "GLOBAL"
    ? 1
    : promotion.tier === "NATIONAL"
      ? 0.8
      : promotion.tier === "RISING"
        ? 0.6
        : promotion.tier === "INDEPENDENT"
          ? 0.42
          : 0.25;
  const chance = factor * (0.08 + promotion.aiProfile.expansionAggression / 350);
  if (!rng.chance(chance)) return home;
  const candidates = state.markets
    .filter((market) => market.id !== home.id)
    .map((market) => ({ market, marketState: promotionMarketState(state, promotion.id, market.id) }))
    .sort((a, b) => (b.marketState.awareness + b.marketState.liveStrength)
      - (a.marketState.awareness + a.marketState.liveStrength)
      || a.market.id.localeCompare(b.market.id));
  const shortlist = candidates.slice(0, Math.min(6, candidates.length));
  return shortlist.length ? rng.pick(shortlist).market : home;
}

function ticketYield(strategy: TicketStrategy, market: Market): number {
  return Math.round(baseTicketPrice(strategy) * (0.72 + market.spendingIndex / 250) * 100) / 100;
}

function estimateDemand(
  state: WorldState,
  promotion: Promotion,
  market: Market,
  type: WrestlingEventType,
  strategy: TicketStrategy,
  people: Person[],
): number {
  const local = promotionMarketState(state, promotion.id, market.id);
  const marketPotential = market.audiencePotential * 115;
  const localFactor = (0.25 + local.liveStrength / 155) * (0.68 + local.awareness / 310);
  const interestFactor = 0.68 + market.wrestlingInterest / 190;
  const mediaFactor = 0.78 + promotion.mediaReach / 245;
  const eventFactor = type === "MAJOR" ? 1.32 : 0.86;
  const top = [...people]
    .sort((a, b) => (b.recognition + b.popularity + b.skills.presentation)
      - (a.recognition + a.popularity + a.skills.presentation))
    .slice(0, 6);
  const starAverage = top.length
    ? top.reduce((sum, person) => sum + (person.recognition + person.popularity + person.skills.presentation) / 3, 0) / top.length
    : 20;
  const starFactor = 0.74 + starAverage / 210;
  const ticketFactor = demandMultiplierForTicketStrategy(strategy);
  return Math.max(
    100,
    Math.round(marketPotential * localFactor * interestFactor * mediaFactor * eventFactor * starFactor * ticketFactor),
  );
}

function chooseVenue(
  state: WorldState,
  marketId: string,
  eventDate: WrestlingEvent["date"],
  expectedDemand: number,
): Venue {
  const occupied = new Set<string>();
  const targetWeek = ppwDateToWeekIndex(eventDate, state.ruleset.weeksPerYear);
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    const event = state.events[i]!;
    const eventWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    if (eventWeek < targetWeek) break;
    if (event.status === "SCHEDULED" && samePpwDate(event.date, eventDate)) occupied.add(event.venueId);
  }
  const available = state.venues
    .filter((venue) => venue.marketId === marketId && !occupied.has(venue.id))
    .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));
  const choices = available.length
    ? available
    : state.venues.filter((venue) => venue.marketId === marketId).sort((a, b) => a.capacity - b.capacity);
  const target = expectedDemand * 1.08;
  return choices.find((venue) => venue.capacity >= target) ?? choices[choices.length - 1]!;
}

function eventSeed(state: WorldState, promotion: Promotion, salt: string): number {
  return deterministicSeedFromText(
    `${state.world.seed}:${ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear)}:${promotion.id}:${salt}`,
  );
}

export function shouldPromotionRunEvent(state: WorldState, promotion: Promotion): boolean {
  if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") return false;
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  return weekIndex % Math.max(1, promotion.eventCadenceWeeks) === 0;
}

export function planWorldEvents(state: WorldState): void {
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const start = weekIndex % state.promotions.length;
  const orderedPromotions = state.promotions.map(
    (_, index) => state.promotions[(start + index) % state.promotions.length]!,
  );
  const weeklyCounts = new Map<string, number>();
  const dateBookings = new Set<string>();
  const currentWeekIndex = weekIndex;

  for (let i = state.scheduledAppearances.length - 1; i >= 0; i -= 1) {
    const appearance = state.scheduledAppearances[i]!;
    const appearanceWeek = ppwDateToWeekIndex(appearance.date, state.ruleset.weeksPerYear);
    if (appearanceWeek < currentWeekIndex) break;
    if (appearance.status === "CANCELLED" || appearanceWeek !== currentWeekIndex) continue;
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
      matchCount: 0,
      averageMatchRating: 0,
      bestMatchRating: 0,
      crowdResponse: 0,
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
        serviceCapacityAtBooking: Math.max(1, Math.floor(serviceCapacityDatesPerWeek(entry.person))),
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
  const qualityEffect = (event.averageMatchRating - 2.75) * 0.18 + (event.crowdResponse - 60) / 180;
  const strengthDelta = (demandPerformance >= 0.95
    ? 1.1 * importance
    : demandPerformance >= 0.72
      ? 0.55 * importance
      : demandPerformance < 0.45
        ? -0.45
        : 0.1) + qualityEffect;
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
  competitionFactor: number,
  promotion: Promotion,
  market: Market,
  venue: Venue,
  contractsById: Map<string, Contract>,
): void {
  if (event.status !== "SCHEDULED") return;
  const writer = new LedgerWriter(state.world.id, state.ledger);
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const eligibleAppearances = appearances.filter((appearance) => {
    const person = peopleById.get(appearance.personId);
    const eligible = Boolean(person) && person!.status === "ACTIVE";
    if (!eligible) appearance.status = "CANCELLED";
    return eligible;
  });
  const usable = eligibleAppearances.length - (eligibleAppearances.length % 2);
  if (usable < state.ruleset.minEventParticipants) {
    event.status = "CANCELLED";
    for (const appearance of eligibleAppearances) appearance.status = "CANCELLED";
    writer.append({
      date: event.date,
      type: "EVENT_CANCELLED",
      significance: event.type === "MAJOR" ? "MAJOR" : "NOTABLE",
      entityIds: [event.id, promotion.id],
      payload: { reason: "insufficient available contracted talent", participants: eligibleAppearances.length },
    });
    return;
  }

  const { usedPersonIds, completedMatches } = resolveEventCard(state, event, eligibleAppearances);
  if (!completedMatches.length || usedPersonIds.size < state.ruleset.minEventParticipants) {
    event.status = "CANCELLED";
    for (const appearance of eligibleAppearances) appearance.status = "CANCELLED";
    writer.append({
      date: event.date,
      type: "EVENT_CANCELLED",
      significance: event.type === "MAJOR" ? "MAJOR" : "NOTABLE",
      entityIds: [event.id, promotion.id],
      payload: { reason: "match card could not be completed", participants: usedPersonIds.size },
    });
    return;
  }

  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${event.id}:attendance`));
  const actualDemand = Math.max(0, Math.round(event.expectedDemand * competitionFactor * rng.float(0.92, 1.08)));
  event.attendance = Math.min(venue.capacity, actualDemand);
  event.gateRevenue = Math.round(event.attendance * event.ticketYield);
  recordFinancialTransaction(state, promotion, "GATE_REVENUE", event.gateRevenue, event.id);
  recordFinancialTransaction(state, promotion, "VENUE_COST", -venue.weeklyHireCost, event.id);
  const production = productionCost(promotion, event.type);
  recordFinancialTransaction(state, promotion, "PRODUCTION_COST", -production, event.id);
  const travel = travelCost(promotion, usedPersonIds.size, event.marketId !== promotion.homeMarketId);
  if (travel > 0) recordFinancialTransaction(state, promotion, "TRAVEL_COST", -travel, event.id);

  let appearanceCost = 0;
  for (const appearance of eligibleAppearances) {
    if (!usedPersonIds.has(appearance.personId)) {
      appearance.status = "CANCELLED";
      continue;
    }
    const contract = contractsById.get(appearance.contractId);
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
      participants: usedPersonIds.size,
      matches: event.matchCount,
      averageRating: event.averageMatchRating,
      bestRating: event.bestMatchRating,
      crowdResponse: event.crowdResponse,
    },
  });
}

export function resolveWorldEvents(state: WorldState): void {
  const currentWeekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const events: WrestlingEvent[] = [];
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    const event = state.events[i]!;
    const eventWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    if (eventWeek < currentWeekIndex) break;
    if (event.status === "SCHEDULED" && eventWeek === currentWeekIndex) events.push(event);
  }
  events.sort((a, b) => a.date.day - b.date.day || a.id.localeCompare(b.id));

  const eventIds = new Set(events.map((event) => event.id));
  const appearancesByEvent = new Map<string, ScheduledAppearance[]>();
  for (let i = state.scheduledAppearances.length - 1; i >= 0; i -= 1) {
    const appearance = state.scheduledAppearances[i]!;
    const week = ppwDateToWeekIndex(appearance.date, state.ruleset.weeksPerYear);
    if (week < currentWeekIndex) break;
    if (appearance.status !== "COMMITTED" || !eventIds.has(appearance.eventId)) continue;
    const list = appearancesByEvent.get(appearance.eventId) ?? [];
    list.push(appearance);
    appearancesByEvent.set(appearance.eventId, list);
  }
  for (const list of appearancesByEvent.values()) list.reverse();

  const eventsByMarket = new Map<string, WrestlingEvent[]>();
  for (const event of events) {
    const list = eventsByMarket.get(event.marketId) ?? [];
    list.push(event);
    eventsByMarket.set(event.marketId, list);
  }

  const promotionById = new Map(state.promotions.map((promotion) => [promotion.id, promotion]));
  const marketById = new Map(state.markets.map((market) => [market.id, market]));
  const venueById = new Map(state.venues.map((venue) => [venue.id, venue]));
  const currentContractById = new Map<string, Contract>();
  for (const appearances of appearancesByEvent.values()) {
    for (const appearance of appearances) {
      const contract = contractById(state, appearance.contractId);
      if (contract) currentContractById.set(contract.id, contract);
    }
  }

  for (const event of events) {
    const promotion = promotionById.get(event.promotionId);
    const market = marketById.get(event.marketId);
    const venue = venueById.get(event.venueId);
    if (!promotion || !market || !venue) continue;
    const competitionFactor = competitionDemandFactor(state, event, eventsByMarket.get(event.marketId) ?? []);
    resolveEvent(
      state,
      event,
      appearancesByEvent.get(event.id) ?? [],
      competitionFactor,
      promotion,
      market,
      venue,
      currentContractById,
    );
  }
}

export function planAndResolveWorldEvents(state: WorldState): void {
  planWorldEvents(state);
  resolveWorldEvents(state);
}

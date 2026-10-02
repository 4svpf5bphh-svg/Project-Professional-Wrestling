import type { Contract, WorldState } from "../../domain/src/types.js";
import { contractOverlaps, serviceCapacityDatesPerWeek } from "./contracts.js";

function samePpwWeek(a: { year: number; week: number }, b: { year: number; week: number }): boolean {
  return a.year === b.year && a.week === b.week;
}

function samePpwDate(a: { year: number; week: number; day: number }, b: { year: number; week: number; day: number }): boolean {
  return samePpwWeek(a, b) && a.day === b.day;
}

export function validateWorldInvariants(state: WorldState): string[] {
  const errors: string[] = [];
  const personIds = new Set<string>();
  const promotionIds = new Set(state.promotions.map((p) => p.id));
  const marketIds = new Set(state.markets.map((m) => m.id));
  const venueIds = new Set<string>();
  const venueById = new Map(state.venues.map((venue) => [venue.id, venue]));

  for (const venue of state.venues) {
    if (venueIds.has(venue.id)) errors.push(`duplicate venue id: ${venue.id}`);
    venueIds.add(venue.id);
    if (venue.worldId !== state.world.id) errors.push(`venue ${venue.id} crosses world boundary`);
    if (!marketIds.has(venue.marketId)) errors.push(`venue ${venue.id} references missing market`);
    if (venue.capacity <= 0 || venue.weeklyHireCost < 0) errors.push(`venue ${venue.id} has invalid economics`);
  }

  for (const person of state.people) {
    if (personIds.has(person.id)) errors.push(`duplicate person id: ${person.id}`);
    personIds.add(person.id);
    if (person.worldId !== state.world.id) errors.push(`person ${person.id} crosses world boundary`);
    if (!marketIds.has(person.homeMarketId)) errors.push(`person ${person.id} has invalid home market`);
    if (person.fatigue < 0 || person.fatigue > 100) errors.push(`person ${person.id} fatigue outside 0-100`);
    if (person.wear < 0 || person.wear > 100) errors.push(`person ${person.id} wear outside 0-100`);
    if (person.momentum < 0 || person.momentum > 100 || person.popularity < 0 || person.popularity > 100) errors.push(`person ${person.id} audience state outside 0-100`);
  }

  for (const promotion of state.promotions) {
    if (promotion.worldId !== state.world.id) errors.push(`promotion ${promotion.id} crosses world boundary`);
    if (!marketIds.has(promotion.homeMarketId)) errors.push(`promotion ${promotion.id} has invalid home market`);
    if (!Number.isFinite(promotion.cash)) errors.push(`promotion ${promotion.id} has non-finite cash`);
    if (promotion.runwayWeeks !== null && promotion.runwayWeeks < 0) errors.push(`promotion ${promotion.id} has negative runway`);
    if (!Number.isInteger(promotion.eventCadenceWeeks) || promotion.eventCadenceWeeks < 1) errors.push(`promotion ${promotion.id} has invalid event cadence`);
  }

  const marketStateKeys = new Set<string>();
  for (const marketState of state.promotionMarketStates) {
    const key = `${marketState.promotionId}:${marketState.marketId}`;
    if (marketStateKeys.has(key)) errors.push(`duplicate promotion-market state ${key}`);
    marketStateKeys.add(key);
    if (marketState.worldId !== state.world.id) errors.push(`promotion-market state ${key} crosses world boundary`);
    if (!promotionIds.has(marketState.promotionId)) errors.push(`promotion-market state ${key} references missing promotion`);
    if (!marketIds.has(marketState.marketId)) errors.push(`promotion-market state ${key} references missing market`);
    if (marketState.awareness < 0 || marketState.awareness > 100 || marketState.liveStrength < 0 || marketState.liveStrength > 100 || marketState.loyalty < 0 || marketState.loyalty > 100) {
      errors.push(`promotion-market state ${key} is outside 0-100 bounds`);
    }
  }
  for (const promotion of state.promotions) {
    for (const market of state.markets) {
      if (!marketStateKeys.has(`${promotion.id}:${market.id}`)) errors.push(`missing promotion-market state ${promotion.id}:${market.id}`);
    }
  }

  const contractIds = new Set<string>();
  for (const contract of state.contracts) {
    if (contractIds.has(contract.id)) errors.push(`duplicate contract id: ${contract.id}`);
    contractIds.add(contract.id);
    if (contract.worldId !== state.world.id) errors.push(`contract ${contract.id} crosses world boundary`);
    if (!personIds.has(contract.personId)) errors.push(`contract ${contract.id} references missing person`);
    if (!promotionIds.has(contract.promotionId)) errors.push(`contract ${contract.id} references missing promotion`);
    if (contract.dateEntitlement < 1) errors.push(`contract ${contract.id} has invalid date entitlement`);
    if (contract.datesUsed < 0 || contract.datesUsed > contract.dateEntitlement) errors.push(`contract ${contract.id} has invalid used dates`);
    if (contract.weeklyGuarantee < 0 || contract.appearanceFee < 0 || contract.signingBonus < 0) errors.push(`contract ${contract.id} has negative compensation`);
    if (contract.exclusivity === "EXCLUSIVE" && contract.family !== "EXCLUSIVE") errors.push(`contract ${contract.id} has exclusive rights without exclusive family`);
  }

  const contractById = new Map(state.contracts.map((contract) => [contract.id, contract]));
  const signedByPerson = new Map<string, Contract[]>();
  for (const contract of state.contracts.filter((candidate) => candidate.status === "SIGNED")) {
    const list = signedByPerson.get(contract.personId) ?? [];
    list.push(contract);
    signedByPerson.set(contract.personId, list);
  }
  for (const [personId, contracts] of signedByPerson) {
    for (let i = 0; i < contracts.length; i += 1) {
      for (let j = i + 1; j < contracts.length; j += 1) {
        const a = contracts[i]!;
        const b = contracts[j]!;
        if (!contractOverlaps(a, b, state.ruleset.weeksPerYear)) continue;
        if (a.exclusivity === "EXCLUSIVE" || b.exclusivity === "EXCLUSIVE") {
          errors.push(`person ${personId} has overlapping exclusive contracts ${a.id} and ${b.id}`);
        }
      }
    }
  }

  const offerIds = new Set<string>();
  for (const offer of state.contractOffers) {
    if (offerIds.has(offer.id)) errors.push(`duplicate contract offer id: ${offer.id}`);
    offerIds.add(offer.id);
    if (offer.worldId !== state.world.id) errors.push(`contract offer ${offer.id} crosses world boundary`);
    if (!personIds.has(offer.personId)) errors.push(`contract offer ${offer.id} references missing person`);
    if (!promotionIds.has(offer.promotionId)) errors.push(`contract offer ${offer.id} references missing promotion`);
  }

  const eventIds = new Set<string>();
  const eventById = new Map(state.events.map((event) => [event.id, event]));
  for (const event of state.events) {
    if (eventIds.has(event.id)) errors.push(`duplicate event id: ${event.id}`);
    eventIds.add(event.id);
    if (event.worldId !== state.world.id) errors.push(`event ${event.id} crosses world boundary`);
    if (!promotionIds.has(event.promotionId)) errors.push(`event ${event.id} references missing promotion`);
    if (!marketIds.has(event.marketId)) errors.push(`event ${event.id} references missing market`);
    if (!venueIds.has(event.venueId)) errors.push(`event ${event.id} references missing venue`);
    const venue = venueById.get(event.venueId);
    if (venue && venue.marketId !== event.marketId) errors.push(`event ${event.id} venue belongs to another market`);
    if (venue && event.attendance > venue.capacity) errors.push(`event ${event.id} attendance exceeds venue capacity`);
    if (event.attendance < 0 || event.gateRevenue < 0 || event.totalCost < 0) errors.push(`event ${event.id} has invalid economics`);
    if (event.matchCount < 0 || event.averageMatchRating < 0 || event.averageMatchRating > 5 || event.bestMatchRating < 0 || event.bestMatchRating > 5 || event.crowdResponse < 0 || event.crowdResponse > 100) errors.push(`event ${event.id} has invalid wrestling outputs`);
  }

  const appearanceIds = new Set<string>();
  const appearancesByPerson = new Map<string, typeof state.scheduledAppearances>();
  const appearanceKeySet = new Set<string>();
  for (const appearance of state.scheduledAppearances) {
    if (appearanceIds.has(appearance.id)) errors.push(`duplicate appearance id: ${appearance.id}`);
    appearanceIds.add(appearance.id);
    if (appearance.worldId !== state.world.id) errors.push(`appearance ${appearance.id} crosses world boundary`);
    const event = eventById.get(appearance.eventId);
    const contract = contractById.get(appearance.contractId);
    if (!event) errors.push(`appearance ${appearance.id} references missing event`);
    if (!contract) errors.push(`appearance ${appearance.id} references missing contract`);
    if (!personIds.has(appearance.personId)) errors.push(`appearance ${appearance.id} references missing person`);
    if (!promotionIds.has(appearance.promotionId)) errors.push(`appearance ${appearance.id} references missing promotion`);
    if (event && event.promotionId !== appearance.promotionId) errors.push(`appearance ${appearance.id} promotion does not match event`);
    if (contract && (contract.personId !== appearance.personId || contract.promotionId !== appearance.promotionId)) errors.push(`appearance ${appearance.id} does not match contract parties`);
    const personList = appearancesByPerson.get(appearance.personId) ?? [];
    personList.push(appearance);
    appearancesByPerson.set(appearance.personId, personList);
    appearanceKeySet.add(`${appearance.eventId}:${appearance.personId}`);
  }

  for (const person of state.people) {
    const appearances = (appearancesByPerson.get(person.id) ?? []).filter((appearance) => appearance.status !== "CANCELLED");
    for (let i = 0; i < appearances.length; i += 1) {
      for (let j = i + 1; j < appearances.length; j += 1) {
        if (samePpwDate(appearances[i]!.date, appearances[j]!.date)) errors.push(`person ${person.id} is double-booked on Y${appearances[i]!.date.year} W${appearances[i]!.date.week} D${appearances[i]!.date.day}`);
      }
    }
    const byWeek = new Map<string, number>();
    for (const appearance of appearances) {
      const key = `${appearance.date.year}:${appearance.date.week}`;
      byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
    }
    const capacity = Math.max(1, Math.floor(serviceCapacityDatesPerWeek(person)));
    for (const [week, count] of byWeek) {
      if (count > capacity) errors.push(`person ${person.id} exceeds service capacity in ${week}: ${count} > ${capacity}`);
    }
  }

  const completedByContract = new Map<string, number>();
  for (const appearance of state.scheduledAppearances.filter((candidate) => candidate.status === "COMPLETED")) {
    completedByContract.set(appearance.contractId, (completedByContract.get(appearance.contractId) ?? 0) + 1);
  }
  for (const contract of state.contracts) {
    if ((completedByContract.get(contract.id) ?? 0) !== contract.datesUsed) errors.push(`contract ${contract.id} datesUsed does not match completed appearances`);
  }

  const matchIds = new Set<string>();
  const matchById = new Map(state.matches.map((match) => [match.id, match]));
  const completedMatchesByEvent = new Map<string, typeof state.matches>();
  const participantsByMatch = new Map<string, typeof state.matchParticipants>();
  for (const participant of state.matchParticipants) {
    const list = participantsByMatch.get(participant.matchId) ?? [];
    list.push(participant);
    participantsByMatch.set(participant.matchId, list);
  }
  for (const match of state.matches) {
    if (matchIds.has(match.id)) errors.push(`duplicate match id: ${match.id}`);
    matchIds.add(match.id);
    if (match.worldId !== state.world.id) errors.push(`match ${match.id} crosses world boundary`);
    const event = eventById.get(match.eventId);
    if (!event) errors.push(`match ${match.id} references missing event`);
    if (event && event.promotionId !== match.promotionId) errors.push(`match ${match.id} promotion does not match event`);
    if (match.order < 1 || !Number.isInteger(match.order)) errors.push(`match ${match.id} has invalid card order`);
    if (match.status === "COMPLETED") {
      const eventMatches = completedMatchesByEvent.get(match.eventId) ?? [];
      eventMatches.push(match);
      completedMatchesByEvent.set(match.eventId, eventMatches);
      if (match.actualWinnerSide === null) errors.push(`completed match ${match.id} has no winner`);
      if (match.criticalRatingStars < 0.5 || match.criticalRatingStars > 5) errors.push(`match ${match.id} rating outside 0.5-5`);
      if (match.executionQuality < 0 || match.executionQuality > 100 || match.crowdResponse < 0 || match.crowdResponse > 100) errors.push(`match ${match.id} output outside 0-100`);
      if (match.actualLengthMinutes < 1) errors.push(`match ${match.id} has invalid actual length`);
    }
    const participants = participantsByMatch.get(match.id) ?? [];
    const sideA = participants.filter((participant) => participant.side === "A");
    const sideB = participants.filter((participant) => participant.side === "B");
    const expectedPerSide = match.type === "TAG" ? 2 : 1;
    if (sideA.length !== expectedPerSide || sideB.length !== expectedPerSide) errors.push(`match ${match.id} has invalid ${match.type} side sizes`);
    if (match.status === "COMPLETED" && match.actualWinnerSide) {
      for (const participant of participants) {
        if (participant.won !== (participant.side === match.actualWinnerSide)) errors.push(`match participant ${participant.id} winner flag is inconsistent`);
      }
    }
  }

  for (const event of state.events) {
    const completed = completedMatchesByEvent.get(event.id) ?? [];
    if (event.status === "COMPLETED") {
      if (event.matchCount !== completed.length) errors.push(`event ${event.id} matchCount does not match completed card`);
      const best = completed.length === 0 ? 0 : Math.max(...completed.map((match) => match.criticalRatingStars));
      if (Math.abs(event.bestMatchRating - best) > 0.001) errors.push(`event ${event.id} best match rating is inconsistent`);
    }
  }

  const matchParticipantIds = new Set<string>();
  for (const participant of state.matchParticipants) {
    if (matchParticipantIds.has(participant.id)) errors.push(`duplicate match participant id: ${participant.id}`);
    matchParticipantIds.add(participant.id);
    if (participant.worldId !== state.world.id) errors.push(`match participant ${participant.id} crosses world boundary`);
    if (!matchIds.has(participant.matchId)) errors.push(`match participant ${participant.id} references missing match`);
    if (!eventIds.has(participant.eventId)) errors.push(`match participant ${participant.id} references missing event`);
    if (!personIds.has(participant.personId)) errors.push(`match participant ${participant.id} references missing person`);
    if (!appearanceKeySet.has(`${participant.eventId}:${participant.personId}`)) errors.push(`match participant ${participant.id} has no event appearance`);
  }

  const injuryIds = new Set<string>();
  const activeInjuriesByPerson = new Map<string, number>();
  for (const injury of state.injuries) {
    if (injuryIds.has(injury.id)) errors.push(`duplicate injury id: ${injury.id}`);
    injuryIds.add(injury.id);
    if (injury.worldId !== state.world.id) errors.push(`injury ${injury.id} crosses world boundary`);
    if (!personIds.has(injury.personId)) errors.push(`injury ${injury.id} references missing person`);
    if (!matchIds.has(injury.matchId)) errors.push(`injury ${injury.id} references missing match`);
    if (!eventIds.has(injury.eventId)) errors.push(`injury ${injury.id} references missing event`);
    if (injury.weeksOut < 1 || injury.weeksRemaining < 0 || injury.weeksRemaining > injury.weeksOut) errors.push(`injury ${injury.id} has invalid duration`);
    if (injury.status === "ACTIVE") activeInjuriesByPerson.set(injury.personId, (activeInjuriesByPerson.get(injury.personId) ?? 0) + 1);
    if (injury.status === "RECOVERED" && injury.weeksRemaining !== 0) errors.push(`recovered injury ${injury.id} still has remaining weeks`);
  }
  for (const person of state.people) {
    const active = activeInjuriesByPerson.get(person.id) ?? 0;
    if (active > 1) errors.push(`person ${person.id} has multiple active injuries`);
    if (person.status === "INJURED" && active !== 1) errors.push(`injured person ${person.id} does not have exactly one active injury`);
    if (person.status === "ACTIVE" && active !== 0) errors.push(`active person ${person.id} still has active injury`);
  }

  const chemistryKeys = new Set<string>();
  for (const chemistry of state.workingChemistry) {
    const key = `${chemistry.personAId}:${chemistry.personBId}:${chemistry.context}`;
    if (chemistryKeys.has(key)) errors.push(`duplicate chemistry record ${key}`);
    chemistryKeys.add(key);
    if (chemistry.worldId !== state.world.id) errors.push(`chemistry ${chemistry.id} crosses world boundary`);
    if (!personIds.has(chemistry.personAId) || !personIds.has(chemistry.personBId)) errors.push(`chemistry ${chemistry.id} references missing person`);
    if (chemistry.personAId >= chemistry.personBId) errors.push(`chemistry ${chemistry.id} pair ordering is not canonical`);
    if (chemistry.familiarity < 0 || chemistry.familiarity > 100) errors.push(`chemistry ${chemistry.id} familiarity outside 0-100`);
  }

  const transactionIds = new Set<string>();
  for (const transaction of state.financialTransactions) {
    if (transactionIds.has(transaction.id)) errors.push(`duplicate financial transaction id: ${transaction.id}`);
    transactionIds.add(transaction.id);
    if (transaction.worldId !== state.world.id) errors.push(`financial transaction ${transaction.id} crosses world boundary`);
    if (!promotionIds.has(transaction.promotionId)) errors.push(`financial transaction ${transaction.id} references missing promotion`);
    if (!Number.isFinite(transaction.amount)) errors.push(`financial transaction ${transaction.id} has non-finite amount`);
  }

  const ledgerIds = new Set<string>();
  for (const event of state.ledger) {
    if (ledgerIds.has(event.id)) errors.push(`duplicate ledger id: ${event.id}`);
    ledgerIds.add(event.id);
    if (event.worldId !== state.world.id) errors.push(`ledger ${event.id} crosses world boundary`);
  }

  return errors;
}

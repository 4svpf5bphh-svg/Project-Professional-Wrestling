import type {
  Contract,
  ContractFamily,
  ContractOffer,
  ContractTerms,
  Id,
  Person,
  Promotion,
  PromotionTier,
  RoleExpectation,
  WorldState,
} from "../../domain/src/types.js";
import { addPpwWeeks, comparePpwDates, ppwDateToWeekIndex, weeksBetween } from "./clock.js";
import { recordFinancialTransaction } from "./transactions.js";
import { LedgerWriter } from "./ledger.js";
import { contractsEndingInWeek, contractsForPerson, contractsForPromotion } from "./indexes.js";
import { DeterministicRng, deterministicSeedFromText } from "./rng.js";

const ROLE_VALUE: Record<RoleExpectation, number> = {
  DEVELOPMENTAL: 25,
  REGULAR: 45,
  FEATURED: 62,
  UPPER_CARD: 76,
  MAIN_EVENT: 90,
  SPECIAL_ATTRACTION: 88,
};

const TIER_PRESTIGE: Record<PromotionTier, number> = {
  LOCAL: 25,
  INDEPENDENT: 42,
  RISING: 58,
  NATIONAL: 75,
  GLOBAL: 92,
};

export function contractIsActive(state: WorldState, contract: Contract): boolean {
  if (contract.status !== "SIGNED") return false;
  const weeksPerYear = state.ruleset.weeksPerYear;
  return comparePpwDates(state.world.currentDate, contract.startDate, weeksPerYear) >= 0
    && comparePpwDates(state.world.currentDate, contract.endDate, weeksPerYear) <= 0;
}

export function contractOverlaps(a: Pick<ContractTerms, "startDate" | "endDate">, b: Pick<ContractTerms, "startDate" | "endDate">, weeksPerYear: number): boolean {
  return comparePpwDates(a.startDate, b.endDate, weeksPerYear) <= 0
    && comparePpwDates(b.startDate, a.endDate, weeksPerYear) <= 0;
}

export function activeContractsForPerson(state: WorldState, personId: Id): Contract[] {
  return contractsForPerson(state, personId).filter((contract) => contractIsActive(state, contract));
}

export function activeContractsForPromotion(state: WorldState, promotionId: Id): Contract[] {
  return contractsForPromotion(state, promotionId).filter((contract) => contractIsActive(state, contract));
}

export function currentRosterPersonIds(state: WorldState, promotionId: Id): Id[] {
  return [...new Set(activeContractsForPromotion(state, promotionId).map((contract) => contract.personId))];
}

export function currentPromotionIdsForPerson(state: WorldState, personId: Id): Id[] {
  return [...new Set(activeContractsForPerson(state, personId).map((contract) => contract.promotionId))];
}

export function marketWeeklyValue(person: Person): number {
  const averageSkill = (person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation) / 3;
  const stageMultiplier = person.careerStage === "SPECIAL_ATTRACTION" ? 1.35
    : person.careerStage === "VETERAN" ? 1.1
      : person.careerStage === "PROSPECT" ? 0.75
        : 1;
  return Math.round((500 + person.recognition * 50 + person.popularity * 30 + averageSkill * 25) * stageMultiplier);
}

export function serviceCapacityDatesPerWeek(person: Person): number {
  const stageBase = person.careerStage === "PRIME" ? 1.9
    : person.careerStage === "PROSPECT" ? 1.55
      : person.careerStage === "VETERAN" ? 1.4
        : 1.0;
  const staminaFactor = 0.8 + person.skills.stamina / 250;
  const fatigueFactor = Math.max(0.65, 1 - person.fatigue / 200);
  return stageBase * staminaFactor * fatigueFactor;
}

function contractDensity(terms: ContractTerms, weeksPerYear: number): number {
  const termWeeks = Math.max(1, weeksBetween(terms.startDate, terms.endDate, weeksPerYear) + 1);
  return terms.dateEntitlement / termWeeks;
}

export function canAcceptContractTerms(state: WorldState, person: Person, terms: ContractTerms): { ok: boolean; reason: string | null } {
  const signed = contractsForPerson(state, person.id).filter((contract) => contract.status === "SIGNED" && contractOverlaps(contract, terms, state.ruleset.weeksPerYear));
  if (terms.exclusivity === "EXCLUSIVE" && signed.length > 0) {
    return { ok: false, reason: "exclusive offer overlaps another signed contract" };
  }
  if (terms.exclusivity !== "EXCLUSIVE" && signed.some((contract) => contract.exclusivity === "EXCLUSIVE")) {
    return { ok: false, reason: "existing exclusive contract blocks outside work" };
  }
  const currentDensity = signed.reduce((sum, contract) => sum + contractDensity(contract, state.ruleset.weeksPerYear), 0);
  const proposedDensity = contractDensity(terms, state.ruleset.weeksPerYear);
  if (currentDensity + proposedDensity > serviceCapacityDatesPerWeek(person) + 0.001) {
    return { ok: false, reason: "service capacity exceeded" };
  }
  return { ok: true, reason: null };
}

function roleForPerson(person: Person): RoleExpectation {
  const starScore = (person.recognition + person.popularity + person.skills.presentation) / 3;
  if (person.careerStage === "SPECIAL_ATTRACTION") return "SPECIAL_ATTRACTION";
  if (starScore >= 78) return "MAIN_EVENT";
  if (starScore >= 66) return "UPPER_CARD";
  if (starScore >= 52) return "FEATURED";
  if (person.careerStage === "PROSPECT" && starScore < 38) return "DEVELOPMENTAL";
  return "REGULAR";
}

function familyForPromotion(promotion: Promotion, person: Person, rng: DeterministicRng): ContractFamily {
  const starScore = (person.recognition + person.popularity + person.skills.presentation) / 3;
  const exclusiveChance = promotion.tier === "GLOBAL" ? 0.72
    : promotion.tier === "NATIONAL" ? 0.52
      : promotion.tier === "RISING" ? 0.27
        : promotion.tier === "INDEPENDENT" ? 0.08
          : 0.03;
  const adjusted = Math.min(0.9, exclusiveChance + (starScore >= 72 ? 0.08 : 0));
  return rng.chance(adjusted) ? "EXCLUSIVE" : "LIMITED_NON_EXCLUSIVE";
}

export function buildContractTerms(state: WorldState, promotion: Promotion, person: Person, rng: DeterministicRng, startDate = state.world.currentDate): ContractTerms {
  const family = familyForPromotion(promotion, person, rng);
  const market = marketWeeklyValue(person);
  const generosity = 0.88 + (100 - promotion.aiProfile.financialCaution) / 300 + promotion.aiProfile.riskTolerance / 600;
  const roleExpectation = roleForPerson(person);

  if (family === "EXCLUSIVE") {
    const termWeeks = rng.chance(0.55) ? 52 : 26;
    return {
      family,
      exclusivity: "EXCLUSIVE",
      roleExpectation,
      startDate: { ...startDate },
      endDate: addPpwWeeks(startDate, termWeeks - 1, state.ruleset.weeksPerYear),
      dateEntitlement: Math.max(12, Math.round(termWeeks * rng.float(0.5, 0.7))),
      weeklyGuarantee: Math.round(market * rng.float(1.0, 1.25) * generosity),
      appearanceFee: 0,
      signingBonus: Math.round(market * rng.float(3, 8) * generosity),
    };
  }

  const termWeeks = rng.chance(0.55) ? 26 : 13;
  return {
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation,
    startDate: { ...startDate },
    endDate: addPpwWeeks(startDate, termWeeks - 1, state.ruleset.weeksPerYear),
    dateEntitlement: Math.max(3, Math.round(termWeeks * rng.float(0.22, 0.42))),
    weeklyGuarantee: Math.round(market * rng.float(0.12, 0.26) * generosity),
    appearanceFee: Math.round(market * rng.float(0.8, 1.15) * generosity),
    signingBonus: Math.round(market * rng.float(0.5, 2.0) * generosity),
  };
}

export function buildOneOffTerms(state: WorldState, promotion: Promotion, person: Person, rng: DeterministicRng, startDate = state.world.currentDate): ContractTerms {
  const market = marketWeeklyValue(person);
  return {
    family: "ONE_OFF",
    exclusivity: "OPEN",
    roleExpectation: roleForPerson(person),
    startDate: { ...startDate },
    endDate: { ...startDate },
    dateEntitlement: 1,
    weeklyGuarantee: 0,
    appearanceFee: Math.round(market * rng.float(1.2, 1.8)),
    signingBonus: 0,
  };
}

export function createSignedContract(state: WorldState, person: Person, promotion: Promotion, terms: ContractTerms, sourceOfferId: Id | null, recordLedger = true): Contract {
  const contract: Contract = {
    id: `contract-${String(state.contracts.length + 1).padStart(6, "0")}`,
    worldId: state.world.id,
    personId: person.id,
    promotionId: promotion.id,
    status: "SIGNED",
    datesUsed: 0,
    signedDate: { ...state.world.currentDate },
    sourceOfferId,
    family: terms.family,
    exclusivity: terms.exclusivity,
    roleExpectation: terms.roleExpectation,
    startDate: { ...terms.startDate },
    endDate: { ...terms.endDate },
    dateEntitlement: terms.dateEntitlement,
    weeklyGuarantee: terms.weeklyGuarantee,
    appearanceFee: terms.appearanceFee,
    signingBonus: terms.signingBonus,
  };
  state.contracts.push(contract);

  if (terms.signingBonus > 0) {
    recordFinancialTransaction(state, promotion, "CONTRACT_SIGNING_BONUS", -terms.signingBonus, contract.id);
  }

  if (recordLedger) {
    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: sourceOfferId ? "CONTRACT_SIGNED" : "GENESIS_CONTRACT_ESTABLISHED",
      significance: terms.exclusivity === "EXCLUSIVE" && person.recognition >= 75 ? "NOTABLE" : "ROUTINE",
      entityIds: [contract.id, person.id, promotion.id],
      payload: {
        family: terms.family,
        exclusivity: terms.exclusivity,
        dates: terms.dateEntitlement,
        weeklyGuarantee: terms.weeklyGuarantee,
      },
    });
  }

  return contract;
}

export function expireContracts(state: WorldState): void {
  const writer = new LedgerWriter(state.world.id, state.ledger);
  const currentIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  for (const contract of contractsEndingInWeek(state, currentIndex - 1)) {
    if (contract.status !== "SIGNED") continue;
    contract.status = "EXPIRED";
    writer.append({
      date: state.world.currentDate,
      type: "CONTRACT_EXPIRED",
      significance: "ROUTINE",
      entityIds: [contract.id, contract.personId, contract.promotionId],
      payload: { datesUsed: contract.datesUsed, dateEntitlement: contract.dateEntitlement },
    });
  }
}

export function targetRosterSize(promotion: Promotion): number {
  switch (promotion.tier) {
    case "GLOBAL": return 46;
    case "NATIONAL": return 36;
    case "RISING": return 29;
    case "INDEPENDENT": return 24;
    case "LOCAL": return 16;
  }
}

function personValueForPromotion(person: Person, promotion: Promotion): number {
  const skill = (person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation) / 3;
  return skill * (0.45 + promotion.aiProfile.matchQualityPreference / 250)
    + person.recognition * (0.25 + promotion.aiProfile.starPreference / 220)
    + person.popularity * 0.25
    + (person.careerStage === "PROSPECT" ? promotion.aiProfile.developmentPreference * 0.22 : 0);
}

function isDevelopmentProspect(person: Person): boolean {
  return person.careerStage === "PROSPECT" || (person.biologicalAge < 27 && person.careerExperience < 25);
}

function prospectRosterTarget(promotion: Promotion, rosterTarget: number): number {
  const ratio = 0.08 + promotion.aiProfile.developmentPreference / 800;
  return Math.max(2, Math.round(rosterTarget * ratio));
}

function hasSamePromotionFutureContract(state: WorldState, personId: Id, promotionId: Id, afterDate = state.world.currentDate): boolean {
  return contractsForPerson(state, personId).some((contract) => contract.promotionId === promotionId
    && contract.status === "SIGNED"
    && comparePpwDates(contract.endDate, afterDate, state.ruleset.weeksPerYear) >= 0);
}

function offerSeed(state: WorldState, promotion: Promotion, person: Person, salt: string): number {
  return deterministicSeedFromText(`${state.world.seed}:${ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear)}:${promotion.id}:${person.id}:${salt}`);
}

function createOffer(state: WorldState, promotion: Promotion, person: Person, offerKind: "RECRUITMENT" | "RENEWAL", startDate: typeof state.world.currentDate): ContractOffer {
  const rng = new DeterministicRng(offerSeed(state, promotion, person, offerKind));
  const terms = buildContractTerms(state, promotion, person, rng, startDate);
  const offer: ContractOffer = {
    id: `offer-${String(state.contractOffers.length + 1).padStart(7, "0")}`,
    worldId: state.world.id,
    personId: person.id,
    promotionId: promotion.id,
    submittedDate: { ...state.world.currentDate },
    status: "PENDING",
    offerKind,
    resolvedUtility: null,
    rejectionReason: null,
    ...terms,
  };
  state.contractOffers.push(offer);
  return offer;
}

function renewalCandidates(state: WorldState, promotion: Promotion): Contract[] {
  const currentIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  return contractsForPromotion(state, promotion.id).filter((contract) => {
    if (contract.status !== "SIGNED" || !contractIsActive(state, contract)) return false;
    const endIndex = ppwDateToWeekIndex(contract.endDate, state.ruleset.weeksPerYear);
    if (endIndex - currentIndex > state.ruleset.renewalWindowWeeks) return false;
    return !contractsForPerson(state, contract.personId).some((other) => other.id !== contract.id
      && other.promotionId === promotion.id
      && other.status === "SIGNED"
      && comparePpwDates(other.startDate, contract.endDate, state.ruleset.weeksPerYear) > 0);
  });
}

export function generateAiContractOffers(state: WorldState): void {
  for (const promotion of state.promotions) {
    if (promotion.controllerType !== "AI" || promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") continue;

    const roster = currentRosterPersonIds(state, promotion.id);
    const target = targetRosterSize(promotion);
    const distressPenalty = promotion.financialDistress === "CRISIS" ? 0.25
      : promotion.financialDistress === "DISTRESSED" ? 0.55
        : promotion.financialDistress === "WATCH" ? 0.8
          : 1;

    for (const contract of renewalCandidates(state, promotion)) {
      const person = state.people.find((candidate) => candidate.id === contract.personId);
      if (!person) continue;
      const quality = personValueForPromotion(person, promotion);
      const keepThreshold = 52 + (100 - promotion.aiProfile.loyalty) * 0.12 + (1 - distressPenalty) * 25;
      if (quality < keepThreshold) continue;
      const startDate = addPpwWeeks(contract.endDate, 1, state.ruleset.weeksPerYear);
      createOffer(state, promotion, person, "RENEWAL", startDate);
    }

    if (promotion.financialDistress === "CRISIS") continue;
    const deficit = Math.max(0, target - roster.length);
    const recruitmentCount = Math.min(deficit, state.ruleset.maxRecruitmentOffersPerPromotionPerWeek);
    if (recruitmentCount <= 0) continue;

    const candidates = state.people
      .filter((person) => person.status === "ACTIVE")
      .filter((person) => !hasSamePromotionFutureContract(state, person.id, promotion.id))
      .filter((person) => {
        const existing = activeContractsForPerson(state, person.id);
        if (existing.some((contract) => contract.exclusivity === "EXCLUSIVE")) return false;
        return existing.length < 4;
      })
      .sort((a, b) => personValueForPromotion(b, promotion) - personValueForPromotion(a, promotion) || a.id.localeCompare(b.id));

    const weeklyRng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${promotion.id}:${ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear)}:recruitment`));
    const shortlist = candidates.slice(0, Math.min(candidates.length, Math.max(8, recruitmentCount * 6)));
    const selected = new Set<string>();

    const rosterPeople = roster.map((personId) => state.people.find((person) => person.id === personId)).filter((person): person is Person => Boolean(person));
    const currentProspects = rosterPeople.filter(isDevelopmentProspect).length;
    const prospectDeficit = Math.max(0, prospectRosterTarget(promotion, target) - currentProspects);
    if (prospectDeficit > 0 && promotion.aiProfile.developmentPreference >= 30 && recruitmentCount > 0) {
      const prospectShortlist = candidates
        .filter(isDevelopmentProspect)
        .sort((a, b) => (b.developmentAptitude * 0.55 + personValueForPromotion(b, promotion) * 0.45)
          - (a.developmentAptitude * 0.55 + personValueForPromotion(a, promotion) * 0.45)
          || a.id.localeCompare(b.id))
        .slice(0, 10);
      if (prospectShortlist.length > 0) {
        const candidate = prospectShortlist[weeklyRng.int(0, prospectShortlist.length - 1)]!;
        selected.add(candidate.id);
        createOffer(state, promotion, candidate, "RECRUITMENT", state.world.currentDate);
      }
    }

    if (selected.size < recruitmentCount && promotion.tier !== "GLOBAL") {
      const outsideWorkShortlist = candidates
        .filter((candidate) => !selected.has(candidate.id))
        .filter((candidate) => {
          const active = activeContractsForPerson(state, candidate.id);
          return active.length > 0 && active.every((contract) => contract.exclusivity !== "EXCLUSIVE");
        })
        .slice(0, 10);
      if (outsideWorkShortlist.length > 0) {
        const candidate = outsideWorkShortlist[weeklyRng.int(0, outsideWorkShortlist.length - 1)]!;
        selected.add(candidate.id);
        createOffer(state, promotion, candidate, "RECRUITMENT", state.world.currentDate);
      }
    }

    let attempts = 0;
    while (selected.size < recruitmentCount && selected.size < candidates.length && attempts < Math.max(20, shortlist.length * 4)) {
      attempts += 1;
      const pool = shortlist.filter((candidate) => !selected.has(candidate.id));
      if (pool.length === 0) break;
      const candidate = pool[weeklyRng.int(0, pool.length - 1)]!;
      selected.add(candidate.id);
      createOffer(state, promotion, candidate, "RECRUITMENT", state.world.currentDate);
    }
  }
}

function weeklyEquivalent(offer: ContractOffer, state: WorldState): number {
  const termWeeks = Math.max(1, weeksBetween(offer.startDate, offer.endDate, state.ruleset.weeksPerYear) + 1);
  return offer.weeklyGuarantee + offer.signingBonus / termWeeks + offer.appearanceFee * offer.dateEntitlement / termWeeks;
}

function relationshipLoyaltyScore(state: WorldState, person: Person, promotion: Promotion): number {
  const hasPriorRelationship = contractsForPerson(state, person.id).some((contract) => contract.promotionId === promotion.id);
  const baseline = hasPriorRelationship ? 78 : 48;
  const trust = state.promotionTalentTrust?.find(
    (entry) => entry.personId === person.id && entry.promotionId === promotion.id,
  )?.trust ?? 50;
  return Math.max(0, Math.min(100, baseline + (trust - 50) * 0.3));
}

export function evaluateContractOffer(state: WorldState, offer: ContractOffer): number {
  const person = state.people.find((candidate) => candidate.id === offer.personId);
  const promotion = state.promotions.find((candidate) => candidate.id === offer.promotionId);
  if (!person || !promotion) return 0;

  const market = Math.max(1, marketWeeklyValue(person));
  const moneyScore = Math.max(0, Math.min(100, 50 + ((weeklyEquivalent(offer, state) - market * 0.7) / market) * 65));
  const roleScore = ROLE_VALUE[offer.roleExpectation];
  const prestigeScore = TIER_PRESTIGE[promotion.tier];
  const termWeeks = Math.max(1, weeksBetween(offer.startDate, offer.endDate, state.ruleset.weeksPerYear) + 1);
  const density = offer.dateEntitlement / termWeeks;
  const scheduleScore = Math.max(10, Math.min(100, 92 - density * 35 - (offer.exclusivity === "EXCLUSIVE" ? 18 : 0)));
  const loyaltyScore = relationshipLoyaltyScore(state, person, promotion);
  const exposureScore = promotion.mediaReach;
  const priorities = person.priorities;
  const weightTotal = priorities.money + priorities.role + priorities.prestige + priorities.schedule + priorities.loyalty + priorities.exposure;
  const raw = (
    moneyScore * priorities.money
    + roleScore * priorities.role
    + prestigeScore * priorities.prestige
    + scheduleScore * priorities.schedule
    + loyaltyScore * priorities.loyalty
    + exposureScore * priorities.exposure
  ) / weightTotal;
  const uncertaintyRng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${offer.id}:utility`));
  return Math.round((raw + uncertaintyRng.float(-3, 3)) * 10) / 10;
}

export function resolveContractOffers(state: WorldState): void {
  const currentIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const pending: ContractOffer[] = [];
  for (let i = state.contractOffers.length - 1; i >= 0; i -= 1) {
    const offer = state.contractOffers[i]!;
    const submittedIndex = ppwDateToWeekIndex(offer.submittedDate, state.ruleset.weeksPerYear);
    if (submittedIndex < currentIndex) break;
    if (offer.status === "PENDING" && submittedIndex === currentIndex) pending.push(offer);
  }
  pending.reverse(); // Preserve original submission order while scanning only the current-week tail.
  const byPerson = new Map<Id, ContractOffer[]>();
  for (const offer of pending) {
    const list = byPerson.get(offer.personId) ?? [];
    list.push(offer);
    byPerson.set(offer.personId, list);
  }

  for (const [personId, offers] of byPerson) {
    const person = state.people.find((candidate) => candidate.id === personId);
    if (!person) continue;
    for (const offer of offers) offer.resolvedUtility = evaluateContractOffer(state, offer);
    offers.sort((a, b) => (b.resolvedUtility ?? 0) - (a.resolvedUtility ?? 0) || a.id.localeCompare(b.id));

    const viableExclusive = offers.filter((offer) => offer.exclusivity === "EXCLUSIVE" && (offer.resolvedUtility ?? 0) >= state.ruleset.offerAcceptanceThreshold);
    let exclusiveAccepted = false;
    for (const offer of viableExclusive) {
      const terms: ContractTerms = offer;
      const capacity = canAcceptContractTerms(state, person, terms);
      if (!capacity.ok || exclusiveAccepted) {
        offer.status = "REJECTED";
        offer.rejectionReason = capacity.reason ?? "stronger exclusive offer accepted";
        continue;
      }
      const promotion = state.promotions.find((candidate) => candidate.id === offer.promotionId)!;
      createSignedContract(state, person, promotion, terms, offer.id);
      offer.status = "ACCEPTED";
      exclusiveAccepted = true;
    }

    for (const offer of offers) {
      if (offer.status !== "PENDING") continue;
      if (exclusiveAccepted && contractOverlaps(offer, offers.find((candidate) => candidate.status === "ACCEPTED")!, state.ruleset.weeksPerYear)) {
        offer.status = "REJECTED";
        offer.rejectionReason = "overlaps accepted exclusive offer";
        continue;
      }
      if ((offer.resolvedUtility ?? 0) < state.ruleset.offerAcceptanceThreshold) {
        offer.status = "REJECTED";
        offer.rejectionReason = "offer utility below acceptance threshold";
        continue;
      }
      const capacity = canAcceptContractTerms(state, person, offer);
      if (!capacity.ok) {
        offer.status = "REJECTED";
        offer.rejectionReason = capacity.reason;
        continue;
      }
      const promotion = state.promotions.find((candidate) => candidate.id === offer.promotionId)!;
      createSignedContract(state, person, promotion, offer, offer.id);
      offer.status = "ACCEPTED";
    }
  }
}

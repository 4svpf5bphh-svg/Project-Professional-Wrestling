import type {
  ContractOffer,
  ContractTerms,
  Person,
  Promotion,
} from "../../domain/src/types.js";
import {
  activeContractsForPerson,
  addPpwWeeks,
  canAcceptContractTerms,
  createSignedContract,
  currentRosterPersonIds,
  evaluateContractOffer,
  LedgerWriter,
  marketWeeklyValue,
  minimumViableRoster,
  nextEntityId,
} from "../../sim-core/src/index.js";
import { activityForPlayer } from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const STEWARDSHIP_CARETAKER_TERM_WEEKS = 4;
export const STEWARDSHIP_CARETAKER_DATES = 2;
export const STEWARDSHIP_CARETAKER_RESERVE_WEEKS = 2;
const STEWARDSHIP_CARETAKER_CYCLE_LEDGER_TYPE = "STEWARDSHIP_CARETAKER_RECRUITMENT_CYCLE";
const STEWARDSHIP_CARETAKER_SIGNING_LEDGER_TYPE = "STEWARDSHIP_CARETAKER_TALENT_SIGNED";

export interface StewardshipCaretakerResult {
  promotionsConsidered: number;
  promotionsUnderstaffed: number;
  cyclesProcessed: number;
  offersSubmitted: number;
  signedContracts: number;
}

function requireCycleKey(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Stewardship caretaker cycle key must use YYYY-MM-DD UTC format");
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("Stewardship caretaker cycle key is not a valid UTC date");
  }
  return normalized;
}

function caretakerCycleAlreadyProcessed(
  aggregate: ApplicationWorldAggregate,
  promotionId: string,
  cycleKey: string,
): boolean {
  for (let index = aggregate.state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = aggregate.state.ledger[index]!;
    if (entry.type !== STEWARDSHIP_CARETAKER_CYCLE_LEDGER_TYPE) continue;
    if (entry.entityIds[0] !== promotionId) continue;
    if (String(entry.payload.cycleKey ?? "") === cycleKey) return true;
  }
  return false;
}

function caretakerTerms(aggregate: ApplicationWorldAggregate, person: Person): ContractTerms {
  const market = marketWeeklyValue(person);
  return {
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: person.careerStage === "PROSPECT" ? "DEVELOPMENTAL" : "REGULAR",
    startDate: { ...aggregate.state.world.currentDate },
    endDate: addPpwWeeks(
      aggregate.state.world.currentDate,
      STEWARDSHIP_CARETAKER_TERM_WEEKS - 1,
      aggregate.state.ruleset.weeksPerYear,
    ),
    dateEntitlement: STEWARDSHIP_CARETAKER_DATES,
    weeklyGuarantee: Math.round(market * 0.1),
    appearanceFee: Math.round(market * 1.15),
    signingBonus: 0,
  };
}

function nominalCommitment(terms: ContractTerms): number {
  return terms.weeklyGuarantee * STEWARDSHIP_CARETAKER_TERM_WEEKS
    + terms.appearanceFee * terms.dateEntitlement
    + terms.signingBonus;
}

function freeAgentCandidates(aggregate: ApplicationWorldAggregate): Person[] {
  return aggregate.state.people
    .filter((person) => person.status === "ACTIVE")
    .filter((person) => person.careerStage !== "SPECIAL_ATTRACTION")
    .filter((person) => activeContractsForPerson(aggregate.state, person.id).length === 0)
    .filter((person) => !aggregate.state.contractOffers.some((offer) => (
      offer.personId === person.id && offer.status === "PENDING"
    )))
    .sort((a, b) => {
      const cost = marketWeeklyValue(a) - marketWeeklyValue(b);
      if (cost !== 0) return cost;
      const aQuality = a.skills.inRingQuality + a.skills.matchCraft + a.skills.presentation;
      const bQuality = b.skills.inRingQuality + b.skills.matchCraft + b.skills.presentation;
      return bQuality - aQuality || a.id.localeCompare(b.id);
    });
}

function submitCaretakerOffer(
  aggregate: ApplicationWorldAggregate,
  promotion: Promotion,
  person: Person,
  terms: ContractTerms,
): { accepted: boolean; contractId: string | null } {
  const capacity = canAcceptContractTerms(aggregate.state, person, terms);
  if (!capacity.ok) return { accepted: false, contractId: null };

  const offer: ContractOffer = {
    id: nextEntityId(aggregate.state, "contractOffer"),
    worldId: aggregate.state.world.id,
    personId: person.id,
    promotionId: promotion.id,
    submittedDate: { ...aggregate.state.world.currentDate },
    status: "PENDING",
    offerKind: "RECRUITMENT",
    resolvedUtility: null,
    rejectionReason: null,
    ...terms,
  };
  aggregate.state.contractOffers.push(offer);
  offer.resolvedUtility = evaluateContractOffer(aggregate.state, offer);
  if (offer.resolvedUtility < aggregate.state.ruleset.offerAcceptanceThreshold) {
    offer.status = "REJECTED";
    offer.rejectionReason = "caretaker bridge terms declined";
    return { accepted: false, contractId: null };
  }

  offer.status = "ACCEPTED";
  const contract = createSignedContract(
    aggregate.state,
    person,
    promotion,
    terms,
    offer.id,
    false,
  );
  new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger).append({
    date: aggregate.state.world.currentDate,
    type: STEWARDSHIP_CARETAKER_SIGNING_LEDGER_TYPE,
    significance: "ROUTINE",
    entityIds: [promotion.id, person.id, contract.id],
    payload: {
      offerId: offer.id,
      termWeeks: STEWARDSHIP_CARETAKER_TERM_WEEKS,
      dates: STEWARDSHIP_CARETAKER_DATES,
      weeklyGuarantee: terms.weeklyGuarantee,
      appearanceFee: terms.appearanceFee,
      resolvedUtility: offer.resolvedUtility,
    },
  });
  return { accepted: true, contractId: contract.id };
}

/**
 * Keep a genuinely inactive human promotion capable of fulfilling minimum weekly
 * obligations without turning Stewardship into a roster-building advantage.
 *
 * The caretaker:
 * - only acts while the real owner is STEWARDED;
 * - recruits only to the universal minimum-viable roster floor, never target size;
 * - uses free agents with no pending offers, so it cannot jump active negotiations;
 * - excludes special attractions and ranks by low market cost first;
 * - uses four-week/two-date non-exclusive bridge deals with no signing bonus;
 * - respects wrestler acceptance and Service Capacity;
 * - never recruits in CRISIS and preserves two weeks of fixed-overhead cash;
 * - is idempotent per promotion/real cycle.
 */
export function runStewardshipCaretakerRecruitment(
  aggregate: ApplicationWorldAggregate,
  rawCycleKey: string,
): StewardshipCaretakerResult {
  const cycleKey = requireCycleKey(rawCycleKey);
  const result: StewardshipCaretakerResult = {
    promotionsConsidered: 0,
    promotionsUnderstaffed: 0,
    cyclesProcessed: 0,
    offersSubmitted: 0,
    signedContracts: 0,
  };
  const engagement = aggregate.engagement;
  if (!engagement) return result;

  const writer = new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger);
  for (const control of activePromotionControls(aggregate.ownership)) {
    const activity = activityForPlayer(engagement, control.playerId);
    if (activity?.status !== "STEWARDED") continue;
    const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
    if (!promotion || promotion.controllerType !== "HUMAN") continue;
    if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") continue;
    result.promotionsConsidered += 1;

    const rosterBefore = currentRosterPersonIds(aggregate.state, promotion.id).length;
    const floor = minimumViableRoster(aggregate.state, promotion);
    if (rosterBefore >= floor) continue;
    result.promotionsUnderstaffed += 1;

    if (promotion.financialDistress === "CRISIS" || promotion.cash <= 0) continue;
    if (caretakerCycleAlreadyProcessed(aggregate, promotion.id, cycleKey)) continue;

    const needed = floor - rosterBefore;
    const maxSignings = Math.min(
      needed,
      Math.max(0, aggregate.state.ruleset.survivalEmergencyRecruitmentPerCycle),
    );
    const reserveFloor = promotion.weeklyFixedOverhead * STEWARDSHIP_CARETAKER_RESERVE_WEEKS;
    let committedNominal = 0;
    let offersSubmitted = 0;
    let signed = 0;
    let attempts = 0;
    const maxAttempts = Math.max(6, maxSignings * 6);

    for (const person of freeAgentCandidates(aggregate)) {
      if (signed >= maxSignings || attempts >= maxAttempts) break;
      attempts += 1;
      const terms = caretakerTerms(aggregate, person);
      const commitment = nominalCommitment(terms);
      if (promotion.cash - committedNominal - commitment < reserveFloor) continue;
      const beforeOffers = aggregate.state.contractOffers.length;
      const outcome = submitCaretakerOffer(aggregate, promotion, person, terms);
      if (aggregate.state.contractOffers.length > beforeOffers) offersSubmitted += 1;
      if (!outcome.accepted) continue;
      committedNominal += commitment;
      signed += 1;
    }

    writer.append({
      date: aggregate.state.world.currentDate,
      type: STEWARDSHIP_CARETAKER_CYCLE_LEDGER_TYPE,
      significance: "ROUTINE",
      entityIds: [promotion.id],
      payload: {
        playerId: control.playerId,
        cycleKey,
        rosterBefore,
        rosterAfter: currentRosterPersonIds(aggregate.state, promotion.id).length,
        minimumViableRoster: floor,
        offersSubmitted,
        signedContracts: signed,
        maxSignings,
        nominalCommitment: committedNominal,
      },
    });

    result.cyclesProcessed += 1;
    result.offersSubmitted += offersSubmitted;
    result.signedContracts += signed;
  }

  return result;
}

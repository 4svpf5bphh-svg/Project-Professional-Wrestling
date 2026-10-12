import type {
  Contract,
  ContractOffer,
  ContractTerms,
  Id,
} from "../../domain/src/types.js";
import {
  canAcceptContractTerms,
  comparePpwDates,
  createSignedContract,
  evaluateContractOffer,
  LedgerWriter,
  nextEntityId,
  recordFinancialTransaction,
  weeksBetween,
} from "../../sim-core/src/index.js";
import { activityForPlayer, activeSchedulerDaysBetween } from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import { executeAgreedStewardshipRelease } from "./stewardship-release.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const STEWARDSHIP_BUYOUT_NOTICE_DAYS = 7;
const STEWARDSHIP_BUYOUT_LEDGER_TYPE = "STEWARDSHIP_RIVAL_BUYOUT_EXECUTED";

export interface StewardshipBuyoutPlan extends ContractTerms {
  requestId: string;
  buyerPromotionId: Id;
}

export interface StewardshipBuyoutQuote {
  requestId: string;
  sellerPromotionId: Id;
  buyerPromotionId: Id;
  personId: Id;
  sourceContractId: Id;
  remainingGuaranteeWeeks: number;
  remainingAppearanceDates: number;
  buyoutValue: number;
  noticeDaysElapsed: number;
  noticeDaysRequired: number;
}

export interface StewardshipBuyoutResult extends StewardshipBuyoutQuote {
  replacementContractId: Id;
  acceptedOfferId: Id;
  replacementUtility: number;
  alreadyExecuted: boolean;
}

function requireCycleKey(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error("buyout cycle key must use YYYY-MM-DD UTC format");
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("buyout cycle key is not a valid UTC date");
  }
  return normalized;
}

function daysBetween(startCycleKey: string, endCycleKey: string): number {
  return Math.max(0, Math.floor((Date.parse(`${endCycleKey}T00:00:00.000Z`) - Date.parse(`${startCycleKey}T00:00:00.000Z`)) / 86_400_000));
}

function requireReplacementTerms(aggregate: ApplicationWorldAggregate, plan: StewardshipBuyoutPlan): void {
  if (plan.family === "ONE_OFF") throw new Error("Stewardship buyout replacement cannot be a one-off contract");
  if (plan.family === "EXCLUSIVE" && plan.exclusivity !== "EXCLUSIVE") {
    throw new Error("exclusive buyout replacement requires EXCLUSIVE exclusivity");
  }
  if (plan.family === "LIMITED_NON_EXCLUSIVE" && plan.exclusivity !== "NON_EXCLUSIVE") {
    throw new Error("limited buyout replacement requires NON_EXCLUSIVE exclusivity");
  }
  if (comparePpwDates(plan.startDate, aggregate.state.world.currentDate, aggregate.state.ruleset.weeksPerYear) < 0) {
    throw new Error("buyout replacement cannot start in the past");
  }
  if (comparePpwDates(plan.endDate, plan.startDate, aggregate.state.ruleset.weeksPerYear) < 0) {
    throw new Error("buyout replacement end date cannot precede its start date");
  }
  for (const [value, label] of [
    [plan.dateEntitlement, "date entitlement"],
    [plan.weeklyGuarantee, "weekly guarantee"],
    [plan.appearanceFee, "appearance fee"],
    [plan.signingBonus, "signing bonus"],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`buyout ${label} must be a non-negative integer`);
  }
  if (plan.dateEntitlement < 1) throw new Error("buyout replacement requires at least one date");
}

function remainingContractValue(aggregate: ApplicationWorldAggregate, contract: Contract): {
  remainingGuaranteeWeeks: number;
  remainingAppearanceDates: number;
  buyoutValue: number;
} {
  const remainingGuaranteeWeeks = Math.max(
    0,
    weeksBetween(aggregate.state.world.currentDate, contract.endDate, aggregate.state.ruleset.weeksPerYear) + 1,
  );
  const remainingAppearanceDates = Math.max(0, contract.dateEntitlement - contract.datesUsed);
  return {
    remainingGuaranteeWeeks,
    remainingAppearanceDates,
    buyoutValue: Math.max(0, Math.round(
      contract.weeklyGuarantee * remainingGuaranteeWeeks
      + contract.appearanceFee * remainingAppearanceDates,
    )),
  };
}

function previousBuyout(
  aggregate: ApplicationWorldAggregate,
  requestId: string,
  buyerPromotionId: Id,
): StewardshipBuyoutResult | null {
  for (let index = aggregate.state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = aggregate.state.ledger[index]!;
    if (entry.type !== STEWARDSHIP_BUYOUT_LEDGER_TYPE) continue;
    if (String(entry.payload.requestId ?? "") !== requestId || entry.entityIds[1] !== buyerPromotionId) continue;
    return {
      requestId,
      sellerPromotionId: entry.entityIds[0] ?? "",
      buyerPromotionId,
      personId: entry.entityIds[2] ?? "",
      sourceContractId: String(entry.payload.sourceContractId ?? ""),
      remainingGuaranteeWeeks: Number(entry.payload.remainingGuaranteeWeeks ?? 0),
      remainingAppearanceDates: Number(entry.payload.remainingAppearanceDates ?? 0),
      buyoutValue: Number(entry.payload.buyoutValue ?? 0),
      noticeDaysElapsed: Number(entry.payload.noticeDaysElapsed ?? STEWARDSHIP_BUYOUT_NOTICE_DAYS),
      noticeDaysRequired: STEWARDSHIP_BUYOUT_NOTICE_DAYS,
      replacementContractId: String(entry.payload.replacementContractId ?? ""),
      acceptedOfferId: String(entry.payload.acceptedOfferId ?? ""),
      replacementUtility: Number(entry.payload.replacementUtility ?? 0),
      alreadyExecuted: true,
    };
  }
  return null;
}

function sourceContext(
  aggregate: ApplicationWorldAggregate,
  requestId: string,
  buyerPromotionId: Id,
  currentCycleKey: string,
): { request: NonNullable<ApplicationWorldAggregate["engagement"]>["stewardshipExitRequests"][number]; contract: Contract; quote: StewardshipBuyoutQuote } {
  const engagement = aggregate.engagement;
  if (!engagement) throw new Error("World has no engagement state");
  const request = engagement.stewardshipExitRequests.find((candidate) => candidate.requestId === requestId);
  if (!request) throw new Error(`unknown Stewardship exit request ${requestId}`);
  if (request.status !== "OPEN") throw new Error("rival buyout requires an open Stewardship exit request");

  const sellerControl = activePromotionControls(aggregate.ownership)
    .find((control) => control.promotionId === request.promotionId);
  if (!sellerControl) throw new Error("rival buyout requires an actively controlled seller promotion");
  const sellerActivity = activityForPlayer(engagement, sellerControl.playerId);
  if (sellerActivity?.status !== "STEWARDED") {
    throw new Error("rival buyout is unavailable once the seller owner is active again");
  }

  const buyer = aggregate.state.promotions.find((candidate) => candidate.id === buyerPromotionId);
  if (!buyer) throw new Error(`unknown buyer promotion ${buyerPromotionId}`);
  if (buyer.id === request.promotionId) throw new Error("seller promotion cannot buy out its own contract");
  if (buyer.lifecycle === "DORMANT" || buyer.lifecycle === "CLOSED") {
    throw new Error("inactive promotion cannot execute a rival buyout");
  }

  const contract = aggregate.state.contracts.find((candidate) => candidate.id === request.contractId);
  if (!contract || contract.status !== "SIGNED") throw new Error("buyout source contract is no longer signed");
  if (contract.personId !== request.personId || contract.promotionId !== request.promotionId) {
    throw new Error("Stewardship buyout request does not match its source contract");
  }
  if (aggregate.state.scheduledAppearances.some((appearance) => appearance.contractId === contract.id && appearance.status === "COMMITTED")) {
    throw new Error("cannot execute rival buyout while the source contract has committed materialized appearances");
  }

  const noticeDaysElapsed = activeSchedulerDaysBetween(aggregate.engagement, requireCycleKey(request.requestedCycleKey), currentCycleKey);
  if (noticeDaysElapsed < STEWARDSHIP_BUYOUT_NOTICE_DAYS) {
    throw new Error(`rival buyout notice period has ${STEWARDSHIP_BUYOUT_NOTICE_DAYS - noticeDaysElapsed} day(s) remaining`);
  }
  const value = remainingContractValue(aggregate, contract);
  return {
    request,
    contract,
    quote: {
      requestId,
      sellerPromotionId: request.promotionId,
      buyerPromotionId,
      personId: request.personId,
      sourceContractId: contract.id,
      ...value,
      noticeDaysElapsed,
      noticeDaysRequired: STEWARDSHIP_BUYOUT_NOTICE_DAYS,
    },
  };
}

export function stewardshipBuyoutQuote(
  aggregate: ApplicationWorldAggregate,
  rawRequestId: string,
  buyerPromotionId: Id,
  rawCurrentCycleKey: string,
): StewardshipBuyoutQuote {
  const requestId = rawRequestId.trim();
  if (!requestId) throw new Error("requestId must not be empty");
  const currentCycleKey = requireCycleKey(rawCurrentCycleKey);
  return sourceContext(aggregate, requestId, buyerPromotionId, currentCycleKey).quote;
}

export function executeStewardshipRivalBuyout(
  aggregate: ApplicationWorldAggregate,
  plan: StewardshipBuyoutPlan,
  rawCurrentCycleKey: string,
): StewardshipBuyoutResult {
  const requestId = plan.requestId.trim();
  const buyerPromotionId = plan.buyerPromotionId.trim();
  if (!requestId) throw new Error("requestId must not be empty");
  if (!buyerPromotionId) throw new Error("buyerPromotionId must not be empty");
  const prior = previousBuyout(aggregate, requestId, buyerPromotionId);
  if (prior) return prior;

  const currentCycleKey = requireCycleKey(rawCurrentCycleKey);
  requireReplacementTerms(aggregate, plan);
  const { request, contract, quote } = sourceContext(aggregate, requestId, buyerPromotionId, currentCycleKey);
  const buyer = aggregate.state.promotions.find((candidate) => candidate.id === buyerPromotionId)!;
  const seller = aggregate.state.promotions.find((candidate) => candidate.id === request.promotionId);
  const person = aggregate.state.people.find((candidate) => candidate.id === request.personId);
  if (!seller || !person || person.status === "RETIRED") throw new Error("buyout source promotion or wrestler is unavailable");

  const validationState = structuredClone(aggregate.state);
  const validationContract = validationState.contracts.find((candidate) => candidate.id === contract.id);
  if (!validationContract) throw new Error("buyout validation lost source contract");
  validationContract.status = "TERMINATED";
  const validationPerson = validationState.people.find((candidate) => candidate.id === person.id)!;
  const capacity = canAcceptContractTerms(validationState, validationPerson, plan);
  if (!capacity.ok) throw new Error(capacity.reason ?? "buyout replacement terms cannot be accepted");

  const offerPreview: ContractOffer = {
    id: `stewardship-buyout-preview:${requestId}:${buyerPromotionId}`,
    worldId: aggregate.state.world.id,
    personId: person.id,
    promotionId: buyer.id,
    submittedDate: { ...aggregate.state.world.currentDate },
    status: "PENDING",
    offerKind: "RECRUITMENT",
    resolvedUtility: null,
    rejectionReason: null,
    family: plan.family,
    exclusivity: plan.exclusivity,
    roleExpectation: plan.roleExpectation,
    startDate: { ...plan.startDate },
    endDate: { ...plan.endDate },
    dateEntitlement: plan.dateEntitlement,
    weeklyGuarantee: plan.weeklyGuarantee,
    appearanceFee: plan.appearanceFee,
    signingBonus: plan.signingBonus,
  };
  const replacementUtility = evaluateContractOffer(aggregate.state, offerPreview);
  if (replacementUtility < aggregate.state.ruleset.offerAcceptanceThreshold) {
    throw new Error("wrestler rejected the rival buyout replacement terms");
  }

  const immediateCost = quote.buyoutValue + plan.signingBonus;
  if (buyer.cash < immediateCost) throw new Error("buyer promotion cannot afford the buyout and signing bonus");

  const acceptedOffer: ContractOffer = {
    ...offerPreview,
    id: nextEntityId(aggregate.state, "contractOffer"),
    status: "ACCEPTED",
    resolvedUtility: replacementUtility,
  };
  aggregate.state.contractOffers.push(acceptedOffer);

  request.status = "SETTLED";
  executeAgreedStewardshipRelease(aggregate, requestId);
  if (quote.buyoutValue > 0) {
    recordFinancialTransaction(aggregate.state, buyer, "CONTRACT_BUYOUT", -quote.buyoutValue, requestId);
    recordFinancialTransaction(aggregate.state, seller, "CONTRACT_BUYOUT", quote.buyoutValue, requestId);
  }
  const replacement = createSignedContract(aggregate.state, person, buyer, plan, acceptedOffer.id);

  new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger).append({
    date: aggregate.state.world.currentDate,
    type: STEWARDSHIP_BUYOUT_LEDGER_TYPE,
    significance: "NOTABLE",
    entityIds: [seller.id, buyer.id, person.id, replacement.id],
    payload: {
      requestId,
      sourceContractId: contract.id,
      replacementContractId: replacement.id,
      acceptedOfferId: acceptedOffer.id,
      buyoutValue: quote.buyoutValue,
      remainingGuaranteeWeeks: quote.remainingGuaranteeWeeks,
      remainingAppearanceDates: quote.remainingAppearanceDates,
      noticeDaysElapsed: quote.noticeDaysElapsed,
      replacementUtility,
    },
  });

  return {
    ...quote,
    replacementContractId: replacement.id,
    acceptedOfferId: acceptedOffer.id,
    replacementUtility,
    alreadyExecuted: false,
  };
}

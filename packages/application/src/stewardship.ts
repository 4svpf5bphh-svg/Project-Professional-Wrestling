import type { ContractFamily, Id, WorldState } from "../../domain/src/types.js";
import {
  activeContractsForPromotion,
  contractIsActive,
  ensurePromotionTalentTrust,
  LedgerWriter,
  ppwDateToWeekIndex,
  promotionTalentTrustFor,
} from "../../sim-core/src/index.js";
import { activityForPlayer } from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const STEWARDSHIP_TRUST_PRESSURE_PER_WEEK = 3;
export const STEWARDSHIP_EXIT_GRACE_DAYS = 14;
export const STEWARDSHIP_EXIT_TRUST_THRESHOLD = 40;
const STEWARDSHIP_TRUST_FLOOR = 10;
const STEWARDSHIP_PRESSURE_LEDGER_TYPE = "STEWARDSHIP_TALENT_TRUST_PRESSURE";

export interface StewardshipPressureResult {
  promotionsAffected: number;
  relationshipsAffected: number;
  totalTrustDrop: number;
}

export type StewardshipExitEligibilityReason =
  | "ELIGIBLE"
  | "NO_ACTIVE_HUMAN_CONTROL"
  | "NOT_STEWARDED"
  | "STEWARDSHIP_START_UNKNOWN"
  | "GRACE_PERIOD"
  | "ONE_OFF_CONTRACT"
  | "INACTIVE_CONTRACT"
  | "TRUST_TOO_HIGH";

export interface StewardshipExitEligibility {
  contractId: Id;
  promotionId: Id;
  personId: Id;
  family: ContractFamily;
  eligible: boolean;
  reason: StewardshipExitEligibilityReason;
  stewardedDays: number;
  trust: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function requireUtcCycleKey(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Stewardship exit cycle key must use YYYY-MM-DD UTC format");
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("Stewardship exit cycle key is not a valid UTC date");
  }
  return normalized;
}

function realDaysBetween(startCycleKey: string, endCycleKey: string): number {
  const startMs = Date.parse(`${startCycleKey}T00:00:00.000Z`);
  const endMs = Date.parse(`${endCycleKey}T00:00:00.000Z`);
  return Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
}

function currentRelationshipTrust(
  aggregate: ApplicationWorldAggregate,
  promotionId: Id,
  personId: Id,
): number {
  return aggregate.state.promotionTalentTrust?.find((relationship) => (
    relationship.promotionId === promotionId && relationship.personId === personId
  ))?.trust ?? 50;
}

function stewardshipPressureAlreadyAppliedThisWeek(state: WorldState, promotionId: Id): boolean {
  const currentWeek = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    const entryWeek = ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
    if (entryWeek < currentWeek) break;
    if (
      entryWeek === currentWeek
      && entry.type === STEWARDSHIP_PRESSURE_LEDGER_TYPE
      && entry.entityIds[0] === promotionId
    ) {
      return true;
    }
  }
  return false;
}

export function applyStewardshipTalentTrustPressure(
  aggregate: ApplicationWorldAggregate,
): StewardshipPressureResult {
  const result: StewardshipPressureResult = {
    promotionsAffected: 0,
    relationshipsAffected: 0,
    totalTrustDrop: 0,
  };
  const engagement = aggregate.engagement;
  if (!engagement) return result;

  ensurePromotionTalentTrust(aggregate.state);
  const writer = new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger);

  for (const control of activePromotionControls(aggregate.ownership)) {
    const activity = activityForPlayer(engagement, control.playerId);
    if (activity?.status !== "STEWARDED") continue;
    if (stewardshipPressureAlreadyAppliedThisWeek(aggregate.state, control.promotionId)) continue;

    const personIds = [...new Set(
      activeContractsForPromotion(aggregate.state, control.promotionId)
        .filter((contract) => contract.family !== "ONE_OFF")
        .map((contract) => contract.personId),
    )];

    let promotionTrustDrop = 0;
    for (const personId of personIds) {
      const relationship = promotionTalentTrustFor(aggregate.state, control.promotionId, personId);
      const before = relationship.trust;
      relationship.trust = round1(Math.max(
        STEWARDSHIP_TRUST_FLOOR,
        relationship.trust - STEWARDSHIP_TRUST_PRESSURE_PER_WEEK,
      ));
      promotionTrustDrop += before - relationship.trust;
    }

    writer.append({
      date: aggregate.state.world.currentDate,
      type: STEWARDSHIP_PRESSURE_LEDGER_TYPE,
      significance: "ROUTINE",
      entityIds: [control.promotionId],
      payload: {
        playerId: control.playerId,
        relationshipsAffected: personIds.length,
        trustDropPerRelationship: STEWARDSHIP_TRUST_PRESSURE_PER_WEEK,
        totalTrustDrop: round1(promotionTrustDrop),
      },
    });

    result.promotionsAffected += 1;
    result.relationshipsAffected += personIds.length;
    result.totalTrustDrop = round1(result.totalTrustDrop + promotionTrustDrop);
  }

  return result;
}

export function stewardshipExitEligibilityForContract(
  aggregate: ApplicationWorldAggregate,
  contractId: Id,
  rawCurrentCycleKey: string,
): StewardshipExitEligibility {
  const currentCycleKey = requireUtcCycleKey(rawCurrentCycleKey);
  const contract = aggregate.state.contracts.find((candidate) => candidate.id === contractId);
  if (!contract) throw new Error(`unknown contract ${contractId}`);

  const trust = currentRelationshipTrust(aggregate, contract.promotionId, contract.personId);
  const base = {
    contractId: contract.id,
    promotionId: contract.promotionId,
    personId: contract.personId,
    family: contract.family,
    stewardedDays: 0,
    trust,
  };

  if (contract.family === "ONE_OFF") {
    return { ...base, eligible: false, reason: "ONE_OFF_CONTRACT" };
  }
  if (!contractIsActive(aggregate.state, contract)) {
    return { ...base, eligible: false, reason: "INACTIVE_CONTRACT" };
  }

  const control = activePromotionControls(aggregate.ownership)
    .find((candidate) => candidate.promotionId === contract.promotionId);
  if (!control) {
    return { ...base, eligible: false, reason: "NO_ACTIVE_HUMAN_CONTROL" };
  }

  const activity = aggregate.engagement
    ? activityForPlayer(aggregate.engagement, control.playerId)
    : null;
  if (activity?.status !== "STEWARDED") {
    return { ...base, eligible: false, reason: "NOT_STEWARDED" };
  }
  if (activity.statusSinceCycleKey === null) {
    return { ...base, eligible: false, reason: "STEWARDSHIP_START_UNKNOWN" };
  }

  const stewardshipStart = requireUtcCycleKey(activity.statusSinceCycleKey);
  const stewardedDays = realDaysBetween(stewardshipStart, currentCycleKey);
  const withDuration = { ...base, stewardedDays };
  if (stewardedDays < STEWARDSHIP_EXIT_GRACE_DAYS) {
    return { ...withDuration, eligible: false, reason: "GRACE_PERIOD" };
  }
  if (trust > STEWARDSHIP_EXIT_TRUST_THRESHOLD) {
    return { ...withDuration, eligible: false, reason: "TRUST_TOO_HIGH" };
  }

  return { ...withDuration, eligible: true, reason: "ELIGIBLE" };
}

export function stewardshipExitEligibleContracts(
  aggregate: ApplicationWorldAggregate,
  rawCurrentCycleKey: string,
): StewardshipExitEligibility[] {
  return aggregate.state.contracts
    .filter((contract) => contract.status === "SIGNED")
    .map((contract) => stewardshipExitEligibilityForContract(aggregate, contract.id, rawCurrentCycleKey))
    .filter((eligibility) => eligibility.eligible);
}

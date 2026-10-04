import { LedgerWriter } from "../../sim-core/src/index.js";
import { activityForPlayer } from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import { executeAgreedStewardshipRelease } from "./stewardship-release.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const STEWARDSHIP_AUTO_RELEASE_GRACE_DAYS = 14;
const AUTO_SETTLED_LEDGER_TYPE = "STEWARDSHIP_EARLY_RELEASE_AUTO_SETTLED";

export interface StewardshipAutoReleaseResult {
  eligibleRequests: number;
  releasedContracts: number;
  deferredCommittedAppearances: number;
}

function requireCycleKey(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("automatic Stewardship release cycle key must use YYYY-MM-DD UTC format");
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("automatic Stewardship release cycle key is not a valid UTC date");
  }
  return normalized;
}

function realDaysBetween(startCycleKey: string, endCycleKey: string): number {
  return Math.max(0, Math.floor((Date.parse(`${endCycleKey}T00:00:00.000Z`) - Date.parse(`${startCycleKey}T00:00:00.000Z`)) / 86_400_000));
}

export function settleOverdueStewardshipExitRequests(
  aggregate: ApplicationWorldAggregate,
  rawCurrentCycleKey: string,
): StewardshipAutoReleaseResult {
  const result: StewardshipAutoReleaseResult = {
    eligibleRequests: 0,
    releasedContracts: 0,
    deferredCommittedAppearances: 0,
  };
  const engagement = aggregate.engagement;
  if (!engagement) return result;
  const currentCycleKey = requireCycleKey(rawCurrentCycleKey);
  const controlsByPromotion = new Map(
    activePromotionControls(aggregate.ownership).map((control) => [control.promotionId, control]),
  );
  const writer = new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger);

  for (const request of engagement.stewardshipExitRequests) {
    if (request.status !== "OPEN") continue;
    const control = controlsByPromotion.get(request.promotionId);
    if (!control) continue;
    const activity = activityForPlayer(engagement, control.playerId);
    if (activity?.status !== "STEWARDED") continue;

    const requestedCycleKey = requireCycleKey(request.requestedCycleKey);
    const openDays = realDaysBetween(requestedCycleKey, currentCycleKey);
    if (openDays < STEWARDSHIP_AUTO_RELEASE_GRACE_DAYS) continue;
    result.eligibleRequests += 1;

    const contract = aggregate.state.contracts.find((candidate) => candidate.id === request.contractId);
    if (
      !contract
      || contract.status !== "SIGNED"
      || contract.promotionId !== request.promotionId
      || contract.personId !== request.personId
    ) {
      continue;
    }

    const committedAppearance = aggregate.state.scheduledAppearances.some((appearance) => (
      appearance.contractId === contract.id && appearance.status === "COMMITTED"
    ));
    if (committedAppearance) {
      result.deferredCommittedAppearances += 1;
      continue;
    }

    request.status = "SETTLED";
    writer.append({
      date: aggregate.state.world.currentDate,
      type: AUTO_SETTLED_LEDGER_TYPE,
      significance: "NOTABLE",
      entityIds: [request.promotionId, request.personId, request.contractId],
      payload: {
        requestId: request.requestId,
        openDays,
        graceDays: STEWARDSHIP_AUTO_RELEASE_GRACE_DAYS,
        reason: "owner remained stewarded through the release-request grace period",
      },
    });
    executeAgreedStewardshipRelease(aggregate, request.requestId);
    result.releasedContracts += 1;
  }

  return result;
}

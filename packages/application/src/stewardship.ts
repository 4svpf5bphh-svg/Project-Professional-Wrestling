import type { Id, WorldState } from "../../domain/src/types.js";
import {
  activeContractsForPromotion,
  ensurePromotionTalentTrust,
  LedgerWriter,
  ppwDateToWeekIndex,
  promotionTalentTrustFor,
} from "../../sim-core/src/index.js";
import { activityForPlayer } from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const STEWARDSHIP_TRUST_PRESSURE_PER_WEEK = 3;
const STEWARDSHIP_TRUST_FLOOR = 10;
const STEWARDSHIP_PRESSURE_LEDGER_TYPE = "STEWARDSHIP_TALENT_TRUST_PRESSURE";

export interface StewardshipPressureResult {
  promotionsAffected: number;
  relationshipsAffected: number;
  totalTrustDrop: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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

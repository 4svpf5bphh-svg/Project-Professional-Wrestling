import type { PromotionTalentTrust } from "../../domain/src/talent-trust.js";
import type { WorldState } from "../../domain/src/types.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pairKey(promotionId: string, personId: string): string {
  return `${promotionId}|${personId}`;
}

export function ensurePromotionTalentTrust(state: WorldState): PromotionTalentTrust[] {
  if (!state.promotionTalentTrust) state.promotionTalentTrust = [];
  const existing = new Set(state.promotionTalentTrust.map((entry) => pairKey(entry.promotionId, entry.personId)));
  for (const contract of state.contracts) {
    const key = pairKey(contract.promotionId, contract.personId);
    if (existing.has(key)) continue;
    state.promotionTalentTrust.push({
      worldId: state.world.id,
      promotionId: contract.promotionId,
      personId: contract.personId,
      trust: 50,
      lastEvaluatedYear: 0,
    });
    existing.add(key);
  }
  return state.promotionTalentTrust;
}

export function promotionTalentTrustFor(
  state: WorldState,
  promotionId: string,
  personId: string,
): PromotionTalentTrust {
  const record = ensurePromotionTalentTrust(state).find(
    (entry) => entry.promotionId === promotionId && entry.personId === personId,
  );
  if (!record) throw new Error(`missing talent trust for ${promotionId}/${personId}`);
  return record;
}

function annualTreatmentEvidence(appearances: number): number {
  if (appearances >= 12) return 76;
  if (appearances >= 6) return 70;
  if (appearances >= 3) return 62;
  if (appearances >= 1) return 54;
  return 38;
}

export function processTalentTrustForWeek(state: WorldState): void {
  if (state.world.currentDate.week !== state.ruleset.weeksPerYear) return;

  const year = state.world.currentDate.year;
  const relationships = ensurePromotionTalentTrust(state);
  const relevantPairs = new Set<string>();
  const appearancesByPair = new Map<string, number>();
  const terminationsByPair = new Map<string, number>();
  const dormantPromotions = new Set<string>();

  for (const contract of state.contracts) {
    const overlapsYear = contract.signedDate.year === year
      || contract.endDate.year === year
      || (
        contract.status === "SIGNED"
        && contract.startDate.year <= year
        && contract.endDate.year >= year
      );
    if (overlapsYear) relevantPairs.add(pairKey(contract.promotionId, contract.personId));
  }

  for (let index = state.scheduledAppearances.length - 1; index >= 0; index -= 1) {
    const appearance = state.scheduledAppearances[index]!;
    if (appearance.date.year < year) break;
    if (appearance.date.year !== year || appearance.status !== "COMPLETED") continue;
    const key = pairKey(appearance.promotionId, appearance.personId);
    relevantPairs.add(key);
    appearancesByPair.set(key, (appearancesByPair.get(key) ?? 0) + 1);
  }

  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.date.year < year) break;
    if (entry.date.year !== year) continue;
    if (entry.type === "CONTRACT_TERMINATED_DURING_RESTRUCTURING") {
      const promotionId = entry.entityIds[0];
      const personId = entry.entityIds[1];
      if (!promotionId || !personId) continue;
      const key = pairKey(promotionId, personId);
      relevantPairs.add(key);
      terminationsByPair.set(key, (terminationsByPair.get(key) ?? 0) + 1);
    }
    if (entry.type === "PROMOTION_ENTERED_DORMANCY") {
      const promotionId = entry.entityIds[0];
      if (promotionId) dormantPromotions.add(promotionId);
    }
  }

  for (const relationship of relationships) {
    const key = pairKey(relationship.promotionId, relationship.personId);
    if (!relevantPairs.has(key) || relationship.lastEvaluatedYear === year) continue;

    const appearances = appearancesByPair.get(key) ?? 0;
    const terminations = terminationsByPair.get(key) ?? 0;
    const dormant = dormantPromotions.has(relationship.promotionId)
      || state.promotions.find((promotion) => promotion.id === relationship.promotionId)?.lifecycle === "DORMANT";

    let evidence = annualTreatmentEvidence(appearances);
    evidence -= terminations * 45;
    if (dormant) evidence -= 25;
    evidence = clamp(evidence, 10, 90);

    const responseWeight = terminations > 0 || dormant ? 0.45 : 0.3;
    relationship.trust = round1(clamp(
      relationship.trust + (evidence - relationship.trust) * responseWeight,
    ));
    relationship.lastEvaluatedYear = year;
  }
}

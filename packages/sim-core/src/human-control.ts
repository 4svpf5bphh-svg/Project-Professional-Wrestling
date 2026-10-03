import type { Id, Promotion, WorldState } from "../../domain/src/types.js";
import { LedgerWriter } from "./ledger.js";

export interface HumanPromotionClaimOptions {
  name?: string;
}

function normalizedPromotionName(name: string | undefined): string | null {
  if (name === undefined) return null;
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) throw new Error("promotion name must contain at least 2 characters");
  if (normalized.length > 80) throw new Error("promotion name must contain at most 80 characters");
  return normalized;
}

export function claimIndependentPromotionForHuman(
  state: WorldState,
  promotionId: Id,
  options: HumanPromotionClaimOptions = {},
): Promotion {
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion) throw new Error(`unknown promotion ${promotionId}`);
  if (promotion.controllerType !== "AI") throw new Error(`${promotionId} is already human-controlled`);
  const existingHuman = state.promotions.find((candidate) => candidate.controllerType === "HUMAN");
  if (existingHuman) {
    throw new Error(`ALPHA-1A already has human promotion ${existingHuman.id}`);
  }
  if (promotion.tier !== "INDEPENDENT") {
    throw new Error("ALPHA-1A human claim requires an Independent promotion");
  }
  if (promotion.lifecycle !== "ACTIVE") {
    throw new Error("ALPHA-1A human claim requires an active promotion");
  }

  const previousName = promotion.name;
  const requestedName = normalizedPromotionName(options.name);
  if (requestedName !== null) {
    const duplicate = state.promotions.some(
      (candidate) => candidate.id !== promotion.id && candidate.name.toLowerCase() === requestedName.toLowerCase(),
    );
    if (duplicate) throw new Error(`promotion name already exists: ${requestedName}`);
    promotion.name = requestedName;
  }
  promotion.controllerType = "HUMAN";

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "HUMAN_PROMOTION_CLAIMED",
    significance: "HISTORIC",
    entityIds: [promotion.id, promotion.homeMarketId],
    payload: {
      previousName,
      name: promotion.name,
      tier: promotion.tier,
    },
  });

  return promotion;
}

export function humanControlledPromotions(state: WorldState): Promotion[] {
  return state.promotions.filter((promotion) => promotion.controllerType === "HUMAN");
}

import type { Id, Promotion, WorldState } from "../../domain/src/types.js";
import { LedgerWriter } from "./ledger.js";

export type HumanPromotionTakeoverMode = "CONTINUE" | "REBRAND";

export interface HumanPromotionClaimOptions {
  takeoverMode?: HumanPromotionTakeoverMode;
  name?: string;
}

function takeoverMode(options: HumanPromotionClaimOptions): HumanPromotionTakeoverMode {
  if (options.takeoverMode !== undefined) return options.takeoverMode;
  return options.name === undefined ? "CONTINUE" : "REBRAND";
}

function normalizedPromotionName(name: string | undefined): string | null {
  if (name === undefined) return null;
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) throw new Error("promotion name must contain at least 2 characters");
  if (normalized.length > 80) throw new Error("promotion name must contain at most 80 characters");
  return normalized;
}

function renameUntouchedGenericShowSeries(
  state: WorldState,
  promotionId: Id,
  previousName: string,
  nextName: string,
): void {
  for (const series of state.showSeries ?? []) {
    if (series.promotionId !== promotionId) continue;
    if (series.name === `${previousName} Flagship`) series.name = `${nextName} Flagship`;
    if (series.name === `${previousName} Premium`) series.name = `${nextName} Premium`;
  }
}

export function claimIndependentPromotionForHuman(
  state: WorldState,
  promotionId: Id,
  options: HumanPromotionClaimOptions = {},
): Promotion {
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion) throw new Error(`unknown promotion ${promotionId}`);
  if (promotion.controllerType !== "AI") throw new Error(`${promotionId} is already human-controlled`);
  const takeoverEligibility = promotion.playerTakeoverEligibility
    ?? (promotion.tier === "INDEPENDENT" ? "STANDARD" : "LOCKED");
  if (takeoverEligibility !== "STANDARD") {
    throw new Error("human claim requires a promotion open to standard takeover");
  }
  if (promotion.lifecycle !== "ACTIVE") {
    throw new Error("human claim requires an active promotion");
  }

  const previousName = promotion.name;
  const mode = takeoverMode(options);
  const requestedName = normalizedPromotionName(options.name);
  if (mode === "CONTINUE" && requestedName !== null) {
    throw new Error("continue takeover cannot rename the promotion");
  }
  if (mode === "REBRAND" && requestedName === null) {
    throw new Error("rebrand takeover requires a promotion name");
  }
  if (mode === "REBRAND") {
    const duplicate = state.promotions.some(
      (candidate) => candidate.id !== promotion.id && candidate.name.toLowerCase() === requestedName!.toLowerCase(),
    );
    if (duplicate) throw new Error(`promotion name already exists: ${requestedName}`);
    promotion.name = requestedName!;
    renameUntouchedGenericShowSeries(state, promotion.id, previousName, promotion.name);
  }
  promotion.controllerType = "HUMAN";

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "HUMAN_PROMOTION_CLAIMED",
    significance: "HISTORIC",
    entityIds: [promotion.id, promotion.homeMarketId],
    payload: {
      takeoverMode: mode,
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

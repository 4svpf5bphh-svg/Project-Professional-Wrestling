import type { Market, Promotion, Ruleset, World } from "../../domain/src/types.js";
import type { DeterministicRng } from "./rng.js";

export interface WorldPromotionSourceContext {
  world: World;
  ruleset: Ruleset;
  markets: readonly Market[];
  rng: DeterministicRng;
}

export type WorldPromotionSource = (context: WorldPromotionSourceContext) => Promotion[];

export function validateWorldPromotionSourceResult(
  context: WorldPromotionSourceContext,
  promotions: Promotion[],
): Promotion[] {
  if (promotions.length !== context.ruleset.promotions) {
    throw new Error(
      `promotion source returned ${promotions.length} promotions; expected ${context.ruleset.promotions}`,
    );
  }

  const ids = new Set<string>();
  const normalizedNames = new Set<string>();
  const marketIds = new Set(context.markets.map((market) => market.id));

  for (const promotion of promotions) {
    if (promotion.worldId !== context.world.id) {
      throw new Error(
        `promotion source company ${promotion.id} belongs to ${promotion.worldId}, expected ${context.world.id}`,
      );
    }
    if (!promotion.id.trim()) throw new Error("promotion source company id must not be empty");
    if (ids.has(promotion.id)) throw new Error(`promotion source produced duplicate company id ${promotion.id}`);
    ids.add(promotion.id);

    const name = promotion.name.trim();
    if (!name) throw new Error(`promotion source company ${promotion.id} must have a display name`);
    const normalizedName = name.toLocaleLowerCase("en");
    if (normalizedNames.has(normalizedName)) {
      throw new Error(`promotion source produced duplicate company name ${promotion.name}`);
    }
    normalizedNames.add(normalizedName);

    if (!marketIds.has(promotion.homeMarketId)) {
      throw new Error(`promotion source company ${promotion.id} references missing home market ${promotion.homeMarketId}`);
    }

    if (promotion.identity) {
      if (!promotion.identity.canonicalName.trim()) {
        throw new Error(`promotion source company ${promotion.id} has an empty canonical identity`);
      }
      if (promotion.identity.origin !== "REAL_WORLD" && promotion.identity.origin !== "FICTIONAL") {
        throw new Error(`promotion source company ${promotion.id} has an invalid identity origin`);
      }
    }

    if (promotion.contractPolicy) {
      const { exclusiveContractChance, starExclusiveBonus, outsideBookingPolicy } = promotion.contractPolicy;
      if (!Number.isFinite(exclusiveContractChance) || exclusiveContractChance < 0 || exclusiveContractChance > 100) {
        throw new Error(`promotion source company ${promotion.id} has invalid exclusive contract chance`);
      }
      if (!Number.isFinite(starExclusiveBonus) || starExclusiveBonus < 0 || starExclusiveBonus > 100) {
        throw new Error(`promotion source company ${promotion.id} has invalid star exclusive bonus`);
      }
      if (!["PROHIBITED", "APPROVAL_REQUIRED", "PERMITTED"].includes(outsideBookingPolicy)) {
        throw new Error(`promotion source company ${promotion.id} has invalid outside booking policy`);
      }
    }
  }

  for (const promotion of promotions) {
    const parentId = promotion.identity?.parentPromotionId ?? null;
    if (parentId === null) continue;
    if (parentId === promotion.id) {
      throw new Error(`promotion source company ${promotion.id} cannot be its own parent`);
    }
    if (!ids.has(parentId)) {
      throw new Error(`promotion source company ${promotion.id} references missing parent company ${parentId}`);
    }
  }

  return promotions;
}

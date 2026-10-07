import type {
  PromotionContractPolicy,
  PromotionTier,
} from "../../domain/src/types.js";
import { generatedFictionalPromotionSource } from "../../sim-core/src/genesis.js";
import type { WorldPromotionSource } from "../../sim-core/src/promotion-source.js";

export const REAL_PROMOTION_CATALOG_REVIEWED_ON = "2026-10-07";

export type RealPromotionKey =
  | "WWE"
  | "AEW"
  | "NJPW"
  | "NXT"
  | "TNA"
  | "CMLL"
  | "AAA"
  | "ROH"
  | "NOAH"
  | "STARDOM";

export interface RealPromotionTemplate {
  key: RealPromotionKey;
  name: string;
  tier: PromotionTier;
  parentKey: RealPromotionKey | null;
  contractPolicy: PromotionContractPolicy;
}

/**
 * PPW simulation defaults, not claims about private real-world contract terms.
 * They encode the public-facing contrast we want the game world to reproduce:
 * WWE-style lockdown at one end, more outside-booking flexibility elsewhere.
 *
 * Template order intentionally matches Genesis tier slots:
 * 1 Global, 2 National, 2 Rising, then Independent companies.
 * Any remaining source slots stay fictional and may be used for player takeover.
 */
export const REAL_PROMOTION_TEMPLATES: readonly RealPromotionTemplate[] = [
  {
    key: "WWE",
    name: "WWE",
    tier: "GLOBAL",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 95,
      starExclusiveBonus: 5,
      outsideBookingPolicy: "PROHIBITED",
    },
  },
  {
    key: "AEW",
    name: "AEW",
    tier: "NATIONAL",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 62,
      starExclusiveBonus: 8,
      outsideBookingPolicy: "APPROVAL_REQUIRED",
    },
  },
  {
    key: "NJPW",
    name: "NJPW",
    tier: "NATIONAL",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 50,
      starExclusiveBonus: 8,
      outsideBookingPolicy: "APPROVAL_REQUIRED",
    },
  },
  {
    key: "NXT",
    name: "NXT",
    tier: "RISING",
    parentKey: "WWE",
    contractPolicy: {
      exclusiveContractChance: 95,
      starExclusiveBonus: 5,
      outsideBookingPolicy: "PROHIBITED",
    },
  },
  {
    key: "TNA",
    name: "TNA Wrestling",
    tier: "RISING",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 28,
      starExclusiveBonus: 8,
      outsideBookingPolicy: "PERMITTED",
    },
  },
  {
    key: "CMLL",
    name: "CMLL",
    tier: "INDEPENDENT",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 24,
      starExclusiveBonus: 6,
      outsideBookingPolicy: "APPROVAL_REQUIRED",
    },
  },
  {
    key: "AAA",
    name: "AAA",
    tier: "INDEPENDENT",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 22,
      starExclusiveBonus: 6,
      outsideBookingPolicy: "PERMITTED",
    },
  },
  {
    key: "ROH",
    name: "ROH",
    tier: "INDEPENDENT",
    parentKey: "AEW",
    contractPolicy: {
      exclusiveContractChance: 35,
      starExclusiveBonus: 8,
      outsideBookingPolicy: "PERMITTED",
    },
  },
  {
    key: "NOAH",
    name: "Pro Wrestling NOAH",
    tier: "INDEPENDENT",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 38,
      starExclusiveBonus: 8,
      outsideBookingPolicy: "APPROVAL_REQUIRED",
    },
  },
  {
    key: "STARDOM",
    name: "STARDOM",
    tier: "INDEPENDENT",
    parentKey: null,
    contractPolicy: {
      exclusiveContractChance: 42,
      starExclusiveBonus: 8,
      outsideBookingPolicy: "APPROVAL_REQUIRED",
    },
  },
] as const;

const keys = new Set(REAL_PROMOTION_TEMPLATES.map((template) => template.key));
if (keys.size !== REAL_PROMOTION_TEMPLATES.length) {
  throw new Error("real promotion catalog contains duplicate keys");
}
for (const template of REAL_PROMOTION_TEMPLATES) {
  if (template.parentKey !== null && !keys.has(template.parentKey)) {
    throw new Error(`real promotion catalog ${template.key} references missing parent ${template.parentKey}`);
  }
}

export const realPromotionEcosystemSource: WorldPromotionSource = (context) => {
  if (context.ruleset.promotions < REAL_PROMOTION_TEMPLATES.length) {
    throw new Error(
      `real promotion ecosystem requires at least ${REAL_PROMOTION_TEMPLATES.length} promotion slots; `
      + `World requested ${context.ruleset.promotions}`,
    );
  }

  const generated = generatedFictionalPromotionSource(context);
  const idByKey = new Map<RealPromotionKey, string>();
  REAL_PROMOTION_TEMPLATES.forEach((template, index) => {
    idByKey.set(template.key, generated[index]!.id);
  });

  return generated.map((promotion, index) => {
    const template = REAL_PROMOTION_TEMPLATES[index];
    if (!template) return promotion;
    const parentPromotionId = template.parentKey === null
      ? null
      : idByKey.get(template.parentKey)!;
    return {
      ...promotion,
      name: template.name,
      tier: template.tier,
      identity: {
        origin: "REAL_WORLD",
        canonicalName: template.name,
        parentPromotionId,
      },
      contractPolicy: { ...template.contractPolicy },
      playerTakeoverEligibility: "LOCKED",
    };
  });
};

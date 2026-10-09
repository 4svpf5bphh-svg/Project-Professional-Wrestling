import type {
  Promotion,
  PromotionShowSeries,
  PromotionShowSeriesRole,
  Ruleset,
  WrestlingEventType,
} from "../../domain/src/types.js";
import { defaultPromotionShowSeries } from "../../sim-core/src/show-calendar.js";
import type { RealPromotionKey } from "./real-promotions.js";

type RealShowProfile = {
  regular: ReadonlyArray<{
    name: string;
    role: Extract<PromotionShowSeriesRole, "FLAGSHIP" | "SECONDARY" | "DEVELOPMENTAL">;
    cadenceMultiplier: number;
    anchorWeek: number;
    importance: number;
  }>;
  recurringSpecialName: string;
  crownName: string;
  crownImportance: number;
};

const REAL_SHOW_PROFILES: Readonly<Record<RealPromotionKey, RealShowProfile>> = {
  WWE: {
    regular: [
      { name: "Monday Night Raw", role: "FLAGSHIP", cadenceMultiplier: 2, anchorWeek: 0, importance: 76 },
      { name: "Friday Night SmackDown", role: "SECONDARY", cadenceMultiplier: 2, anchorWeek: 1, importance: 75 },
    ],
    recurringSpecialName: "WWE Premium Live Event",
    crownName: "WrestleMania",
    crownImportance: 100,
  },
  AEW: {
    regular: [
      { name: "AEW Dynamite", role: "FLAGSHIP", cadenceMultiplier: 2, anchorWeek: 0, importance: 72 },
      { name: "AEW Collision", role: "SECONDARY", cadenceMultiplier: 2, anchorWeek: 1, importance: 66 },
    ],
    recurringSpecialName: "AEW PPV",
    crownName: "AEW All In",
    crownImportance: 97,
  },
  NJPW: {
    regular: [
      { name: "NJPW Road Series", role: "FLAGSHIP", cadenceMultiplier: 1, anchorWeek: 0, importance: 68 },
    ],
    recurringSpecialName: "NJPW Major Event",
    crownName: "Wrestle Kingdom",
    crownImportance: 99,
  },
  NXT: {
    regular: [
      { name: "NXT", role: "FLAGSHIP", cadenceMultiplier: 1, anchorWeek: 0, importance: 63 },
    ],
    recurringSpecialName: "NXT Special Event",
    crownName: "NXT Stand & Deliver",
    crownImportance: 93,
  },
  TNA: {
    regular: [
      { name: "TNA iMPACT!", role: "FLAGSHIP", cadenceMultiplier: 1, anchorWeek: 0, importance: 64 },
    ],
    recurringSpecialName: "TNA Special Event",
    crownName: "Bound For Glory",
    crownImportance: 94,
  },
  CMLL: {
    regular: [
      { name: "CMLL Super Viernes", role: "FLAGSHIP", cadenceMultiplier: 1, anchorWeek: 0, importance: 66 },
    ],
    recurringSpecialName: "CMLL Major Event",
    crownName: "CMLL Anniversary Show",
    crownImportance: 96,
  },
  ROH: {
    regular: [
      { name: "ROH Wrestling", role: "FLAGSHIP", cadenceMultiplier: 1, anchorWeek: 0, importance: 60 },
    ],
    recurringSpecialName: "ROH Special Event",
    crownName: "ROH Supercard of Honor",
    crownImportance: 92,
  },
  STARDOM: {
    regular: [
      { name: "STARDOM Live", role: "FLAGSHIP", cadenceMultiplier: 1, anchorWeek: 0, importance: 64 },
    ],
    recurringSpecialName: "STARDOM Major Event",
    crownName: "STARDOM Dream Queendom",
    crownImportance: 95,
  },
};

function realPromotionKey(promotion: Promotion): RealPromotionKey | null {
  if (promotion.identity?.origin !== "REAL_WORLD") return null;
  const canonical = promotion.identity.canonicalName;
  if (canonical === "TNA Wrestling") return "TNA";
  if (canonical === "WWE" || canonical === "AEW" || canonical === "NJPW" || canonical === "NXT"
    || canonical === "CMLL" || canonical === "ROH" || canonical === "STARDOM") return canonical;
  return null;
}

function series(
  worldId: string,
  promotion: Promotion,
  suffix: string,
  name: string,
  role: PromotionShowSeriesRole,
  eventType: WrestlingEventType,
  cadenceWeeks: number,
  anchorWeek: number,
  eventImportance: number,
): PromotionShowSeries {
  return {
    id: `show-series:${promotion.id}:${suffix}`,
    worldId,
    promotionId: promotion.id,
    name,
    role,
    eventType,
    cadenceWeeks,
    anchorWeek,
    eventImportance,
    active: true,
  };
}

/**
 * PPW calendar compression for the real-promotion Alpha World.
 *
 * This is intentionally not a literal copy of real weekly broadcasting.
 * PPW allows one Regular slot per promotion/week, so multi-show companies
 * alternate their regular identities while the separate Special slot carries
 * premium events. Other promotions preserve the cadence already implied by
 * their PPW tier.
 */
export function realPromotionShowSeriesSource(
  worldId: string,
  promotions: readonly Promotion[],
  ruleset: Ruleset,
): PromotionShowSeries[] {
  return promotions.flatMap((promotion) => {
    const key = realPromotionKey(promotion);
    if (!key) return defaultPromotionShowSeries(worldId, promotion, ruleset);

    const profile = REAL_SHOW_PROFILES[key];
    const regularCadence = Math.max(1, Math.floor(promotion.eventCadenceWeeks));
    const recurringSpecialCadence = regularCadence * Math.max(2, Math.floor(ruleset.majorEventIntervalWeeks));
    const recurringSpecialAnchor = Math.min(
      recurringSpecialCadence - 1,
      regularCadence * 3,
    );
    const crownCadence = Math.max(1, Math.floor(ruleset.weeksPerYear));
    const crownAnchor = Math.min(crownCadence - 1, 13);

    const regular = profile.regular.map((show, index) => series(
      worldId,
      promotion,
      index === 0 ? "flagship" : `secondary-${index}`,
      show.name,
      show.role,
      "REGULAR",
      regularCadence * show.cadenceMultiplier,
      show.anchorWeek,
      show.importance,
    ));
    return [
      ...regular,
      series(
        worldId,
        promotion,
        "special",
        profile.recurringSpecialName,
        "SPECIAL",
        "MAJOR",
        recurringSpecialCadence,
        recurringSpecialAnchor,
        87,
      ),
      series(
        worldId,
        promotion,
        "premium",
        profile.crownName,
        "PREMIUM",
        "MAJOR",
        crownCadence,
        crownAnchor,
        profile.crownImportance,
      ),
    ];
  });
}

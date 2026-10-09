import type {
  Id,
  PpwDate,
  Promotion,
  PromotionShowOccurrence,
  PromotionShowSeries,
  PromotionShowSeriesRole,
  Ruleset,
  WorldState,
} from "../../domain/src/types.js";
import { addPpwWeeks, ppwDateToWeekIndex } from "./clock.js";

function seriesId(promotionId: Id, role: "FLAGSHIP" | "PREMIUM"): Id {
  return `show-series:${promotionId}:${role.toLowerCase()}`;
}

export function defaultPromotionShowSeries(
  worldId: Id,
  promotion: Promotion,
  ruleset: Ruleset,
): PromotionShowSeries[] {
  const regularCadence = Math.max(1, Math.floor(promotion.eventCadenceWeeks));
  const premiumEveryShows = Math.max(2, Math.floor(ruleset.majorEventIntervalWeeks));
  const premiumCadence = regularCadence * premiumEveryShows;
  return [
    {
      id: seriesId(promotion.id, "FLAGSHIP"),
      worldId,
      promotionId: promotion.id,
      name: `${promotion.name} Flagship`,
      role: "FLAGSHIP",
      eventType: "REGULAR",
      cadenceWeeks: regularCadence,
      anchorWeek: 0,
      eventImportance: 58,
      active: true,
    },
    {
      id: seriesId(promotion.id, "PREMIUM"),
      worldId,
      promotionId: promotion.id,
      name: `${promotion.name} Premium`,
      role: "PREMIUM",
      eventType: "MAJOR",
      cadenceWeeks: premiumCadence,
      anchorWeek: regularCadence * (premiumEveryShows - 1),
      eventImportance: 85,
      active: true,
    },
  ];
}

export function seedWorldPromotionShowSeries(
  worldId: Id,
  promotions: readonly Promotion[],
  ruleset: Ruleset,
): PromotionShowSeries[] {
  return promotions.flatMap((promotion) => defaultPromotionShowSeries(worldId, promotion, ruleset));
}

function seriesForPromotion(
  state: Pick<WorldState, "world" | "ruleset" | "promotions" | "showSeries">,
  promotionId: Id,
): PromotionShowSeries[] {
  const persisted = (state.showSeries ?? []).filter((series) => series.promotionId === promotionId && series.active);
  if (persisted.length > 0) return persisted;
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  return promotion ? defaultPromotionShowSeries(state.world.id, promotion, state.ruleset) : [];
}

export function promotionShowSeriesDueForDate(
  state: Pick<WorldState, "world" | "ruleset" | "promotions" | "showSeries">,
  promotionId: Id,
  date: PpwDate,
): PromotionShowSeries[] {
  const weekIndex = ppwDateToWeekIndex(date, state.ruleset.weeksPerYear);
  return seriesForPromotion(state, promotionId)
    .filter((series) => (
      weekIndex >= series.anchorWeek
      && (weekIndex - series.anchorWeek) % Math.max(1, series.cadenceWeeks) === 0
    ))
    .sort((left, right) => {
      const rank = (role: PromotionShowSeriesRole): number => {
        if (role === "PREMIUM") return 5;
        if (role === "SPECIAL") return 4;
        if (role === "FLAGSHIP") return 3;
        if (role === "SECONDARY") return 2;
        return 1;
      };
      return rank(right.role) - rank(left.role) || left.id.localeCompare(right.id);
    });
}

/**
 * Alpha currently supports one required operating show in a due week.
 * Multiple due identities are therefore resolved to one primary series.
 * Future multi-show scheduling should consume promotionShowSeriesDueForDate()
 * directly rather than weakening this selection rule.
 */
export function primaryPromotionShowSeriesForDate(
  state: Pick<WorldState, "world" | "ruleset" | "promotions" | "showSeries">,
  promotionId: Id,
  date: PpwDate,
): PromotionShowSeries | null {
  return promotionShowSeriesDueForDate(state, promotionId, date)[0] ?? null;
}


export function promotionShowOccurrenceId(
  showSeriesId: Id,
  date: Pick<PpwDate, "year" | "week">,
): Id {
  return `show-occurrence:${showSeriesId}:Y${date.year}:W${date.week}`;
}

function sameWeek(
  left: Pick<PpwDate, "year" | "week">,
  right: Pick<PpwDate, "year" | "week">,
): boolean {
  return left.year === right.year && left.week === right.week;
}

/**
 * Project the shared World calendar without duplicating recurrence data.
 * A due Show Series creates a stable occurrence identity for that PPW week.
 * Once a canonical WrestlingEvent exists, the occurrence picks up its actual
 * day, market, venue and status.
 */
export function promotionShowOccurrencesBetween(
  state: Pick<WorldState, "world" | "ruleset" | "promotions" | "showSeries" | "events">,
  startDate: PpwDate,
  weeks: number,
  promotionId?: Id,
): PromotionShowOccurrence[] {
  if (!Number.isSafeInteger(weeks) || weeks < 1 || weeks > 260) {
    throw new Error("calendar occurrence horizon must be from 1 to 260 PPW weeks");
  }

  const promotionIds = promotionId
    ? [promotionId]
    : state.promotions
      .filter((promotion) => promotion.lifecycle !== "CLOSED" && promotion.lifecycle !== "DORMANT")
      .map((promotion) => promotion.id);

  const occurrences: PromotionShowOccurrence[] = [];
  for (let offset = 0; offset < weeks; offset += 1) {
    const weekDate = addPpwWeeks(
      { year: startDate.year, week: startDate.week, day: 1 },
      offset,
      state.ruleset.weeksPerYear,
    );
    for (const candidatePromotionId of promotionIds) {
      for (const series of promotionShowSeriesDueForDate(state, candidatePromotionId, weekDate)) {
        const event = state.events.find((candidate) => (
          candidate.promotionId === candidatePromotionId
          && candidate.showSeriesId === series.id
          && sameWeek(candidate.date, weekDate)
          && candidate.status !== "CANCELLED"
        )) ?? state.events.find((candidate) => (
          candidate.promotionId === candidatePromotionId
          && candidate.showSeriesId === series.id
          && sameWeek(candidate.date, weekDate)
        )) ?? null;

        occurrences.push({
          id: promotionShowOccurrenceId(series.id, weekDate),
          worldId: state.world.id,
          promotionId: candidatePromotionId,
          showSeriesId: series.id,
          name: series.name,
          role: series.role,
          eventType: series.eventType,
          eventImportance: series.eventImportance,
          year: weekDate.year,
          week: weekDate.week,
          day: event?.date.day ?? null,
          marketId: event?.marketId ?? null,
          venueId: event?.venueId ?? null,
          eventId: event?.id ?? null,
          status: event?.status ?? "CALENDAR",
        });
      }
    }
  }

  return occurrences.sort((left, right) => (
    left.year - right.year
    || left.week - right.week
    || (left.day ?? 8) - (right.day ?? 8)
    || right.eventImportance - left.eventImportance
    || left.name.localeCompare(right.name)
  ));
}

export function promotionShowSeriesById(
  state: Pick<WorldState, "showSeries">,
  showSeriesId: Id,
): PromotionShowSeries | null {
  return state.showSeries?.find((series) => series.id === showSeriesId) ?? null;
}

export function validatePromotionShowSeriesState(
  state: Pick<WorldState, "world" | "promotions" | "showSeries">,
): string[] {
  const errors: string[] = [];
  const promotionIds = new Set(state.promotions.map((promotion) => promotion.id));
  const ids = new Set<Id>();
  const flagshipByPromotion = new Map<Id, number>();

  for (const series of state.showSeries ?? []) {
    if (ids.has(series.id)) errors.push(`duplicate show series id: ${series.id}`);
    ids.add(series.id);
    if (series.worldId !== state.world.id) errors.push(`show series ${series.id} crosses world boundary`);
    if (!promotionIds.has(series.promotionId)) errors.push(`show series ${series.id} references missing promotion`);
    if (!Number.isSafeInteger(series.cadenceWeeks) || series.cadenceWeeks < 1) errors.push(`show series ${series.id} has invalid cadence`);
    if (!Number.isSafeInteger(series.anchorWeek) || series.anchorWeek < 0 || series.anchorWeek >= Math.max(1, series.cadenceWeeks)) {
      errors.push(`show series ${series.id} has invalid anchor week`);
    }
    if (!Number.isFinite(series.eventImportance) || series.eventImportance < 0 || series.eventImportance > 100) {
      errors.push(`show series ${series.id} has invalid event importance`);
    }
    if (series.active && series.role === "FLAGSHIP") {
      flagshipByPromotion.set(series.promotionId, (flagshipByPromotion.get(series.promotionId) ?? 0) + 1);
    }
  }

  if ((state.showSeries ?? []).length > 0) {
    for (const promotion of state.promotions) {
      if ((flagshipByPromotion.get(promotion.id) ?? 0) !== 1) {
        errors.push(`promotion ${promotion.id} requires exactly one active flagship show series`);
      }
    }
  }
  return errors;
}

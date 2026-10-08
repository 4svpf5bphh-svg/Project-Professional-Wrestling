import type { Person, PpwDate, WorldState } from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { PromotionWrestlerPresentation } from "../../domain/src/promotion-presentation.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { contractIsActive } from "./contracts.js";
import { LedgerWriter } from "./ledger.js";
import { deterministicSeedFromText } from "./rng.js";

type AlignmentAwarePerson = Person & { alignment?: WrestlerAlignment };

export const WRESTLER_ALIGNMENTS = ["FACE", "HEEL", "TWEENER"] as const satisfies readonly WrestlerAlignment[];

export type PromotionAlignmentChangeMethod =
  | "INITIAL_PRESENTATION"
  | "JUST_SIGNED"
  | "RETURNING"
  | "OFFSCREEN_SWITCH"
  | "TURN";

export interface PromotionAlignmentChangeContext {
  method: Exclude<PromotionAlignmentChangeMethod, "TURN">;
  naturalReset: boolean;
}

export interface PromotionAlignmentChangeResult {
  promotionId: string;
  personId: string;
  previousAlignment: WrestlerAlignment;
  alignment: WrestlerAlignment;
  method: PromotionAlignmentChangeMethod;
  changed: boolean;
}

export function isWrestlerAlignment(value: unknown): value is WrestlerAlignment {
  return value === "FACE" || value === "HEEL" || value === "TWEENER";
}

export function defaultWrestlerAlignment(worldSeed: number, personId: string): WrestlerAlignment {
  const bucket = (deterministicSeedFromText(`${worldSeed >>> 0}:${personId}:alignment`) >>> 0) % 100;
  if (bucket < 42) return "FACE";
  if (bucket < 84) return "HEEL";
  return "TWEENER";
}

export function wrestlerAlignment(person: Person, worldSeed: number): WrestlerAlignment {
  const explicit = (person as AlignmentAwarePerson).alignment;
  return isWrestlerAlignment(explicit) ? explicit : defaultWrestlerAlignment(worldSeed, person.id);
}

export function setWrestlerAlignment(person: Person, alignment: WrestlerAlignment): void {
  if (!isWrestlerAlignment(alignment)) throw new Error(`unsupported wrestler alignment ${String(alignment)}`);
  (person as AlignmentAwarePerson).alignment = alignment;
}

export function wrestlerAlignmentForPromotion(
  state: WorldState,
  promotionId: string,
  personId: string,
): WrestlerAlignment {
  const override = (state.promotionWrestlerPresentations ?? []).find((entry) => (
    entry.promotionId === promotionId && entry.personId === personId
  ));
  if (override && isWrestlerAlignment(override.alignment)) return override.alignment;
  const person = state.people.find((candidate) => candidate.id === personId);
  if (!person) throw new Error(`unknown wrestler ${personId}`);
  return wrestlerAlignment(person, state.world.seed);
}

export function setPromotionWrestlerAlignment(
  state: WorldState,
  promotionId: string,
  personId: string,
  alignment: WrestlerAlignment,
): PromotionWrestlerPresentation {
  if (!isWrestlerAlignment(alignment)) throw new Error(`unsupported wrestler alignment ${String(alignment)}`);
  if (!state.promotions.some((promotion) => promotion.id === promotionId)) {
    throw new Error(`unknown promotion ${promotionId}`);
  }
  if (!state.people.some((person) => person.id === personId)) {
    throw new Error(`unknown wrestler ${personId}`);
  }

  const entries = state.promotionWrestlerPresentations ??= [];
  const existing = entries.find((entry) => entry.promotionId === promotionId && entry.personId === personId);
  if (existing) {
    existing.alignment = alignment;
    existing.changedDate = { ...state.world.currentDate };
    return structuredClone(existing);
  }

  const created: PromotionWrestlerPresentation = {
    worldId: state.world.id,
    promotionId,
    personId,
    alignment,
    changedDate: { ...state.world.currentDate },
  };
  entries.push(created);
  return structuredClone(created);
}

function sameWeek(state: WorldState, left: PpwDate, right: PpwDate): boolean {
  return ppwDateToWeekIndex(left, state.ruleset.weeksPerYear) === ppwDateToWeekIndex(right, state.ruleset.weeksPerYear);
}

export function promotionAlignmentChangeContext(
  state: WorldState,
  promotionId: string,
  personId: string,
): PromotionAlignmentChangeContext {
  const existing = (state.promotionWrestlerPresentations ?? []).find((entry) => (
    entry.promotionId === promotionId && entry.personId === personId
  ));

  const changedThisWeek = state.ledger.some((entry) => (
    entry.type === "PROMOTION_ALIGNMENT_CHANGED"
    && entry.payload.promotionId === promotionId
    && entry.payload.personId === personId
    && entry.payload.changed === true
    && sameWeek(state, entry.date, state.world.currentDate)
  ));
  if (changedThisWeek) return { method: "OFFSCREEN_SWITCH", naturalReset: false };

  const justClaimed = state.ledger.some((entry) => (
    entry.type === "HUMAN_PROMOTION_CLAIMED"
    && entry.entityIds.includes(promotionId)
    && sameWeek(state, entry.date, state.world.currentDate)
  ));
  const justSigned = state.contracts.some((contract) => (
    contract.promotionId === promotionId
    && contract.personId === personId
    && contract.status === "SIGNED"
    && contractIsActive(state, contract)
    && sameWeek(state, contract.startDate, state.world.currentDate)
  ));
  if (!existing && justClaimed) return { method: "INITIAL_PRESENTATION", naturalReset: true };
  if (justSigned) return { method: "JUST_SIGNED", naturalReset: true };

  const returning = state.ledger.some((entry) => (
    entry.type === "WRESTLER_CLEARED_TO_RETURN"
    && entry.entityIds.includes(personId)
    && sameWeek(state, entry.date, state.world.currentDate)
  ));
  if (returning) return { method: "RETURNING", naturalReset: true };

  return { method: "OFFSCREEN_SWITCH", naturalReset: false };
}

export function changePromotionWrestlerAlignment(
  state: WorldState,
  promotionId: string,
  personId: string,
  alignment: WrestlerAlignment,
  options: {
    method?: PromotionAlignmentChangeMethod;
    sourceEventId?: string | null;
    sourceSegmentId?: string | null;
  } = {},
): PromotionAlignmentChangeResult {
  const previousAlignment = wrestlerAlignmentForPromotion(state, promotionId, personId);
  const method = options.method ?? promotionAlignmentChangeContext(state, promotionId, personId).method;
  const changed = previousAlignment !== alignment;
  const sourceEventDate = options.sourceEventId
    ? state.events.find((event) => event.id === options.sourceEventId)?.date ?? null
    : null;
  const changeDate = sourceEventDate ? { ...sourceEventDate } : { ...state.world.currentDate };
  if (changed) {
    setPromotionWrestlerAlignment(state, promotionId, personId, alignment);
    const presentation = (state.promotionWrestlerPresentations ?? []).find((entry) => (
      entry.promotionId === promotionId && entry.personId === personId
    ));
    if (presentation) presentation.changedDate = { ...changeDate };
  }

  new LedgerWriter(state.world.id, state.ledger).append({
    date: changeDate,
    type: "PROMOTION_ALIGNMENT_CHANGED",
    significance: method === "TURN" ? "NOTABLE" : "ROUTINE",
    entityIds: [personId, promotionId, ...(options.sourceEventId ? [options.sourceEventId] : [])],
    payload: {
      promotionId,
      personId,
      previousAlignment,
      alignment,
      method,
      changed,
      sourceEventId: options.sourceEventId ?? null,
      sourceSegmentId: options.sourceSegmentId ?? null,
    },
  });

  return { promotionId, personId, previousAlignment, alignment, method, changed };
}

export function recentAlignmentVolatilityPenalty(
  state: WorldState,
  promotionId: string,
  personIds: readonly string[],
  lookbackWeeks = 8,
): number {
  const current = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  let worst = 0;

  for (const personId of new Set(personIds)) {
    let offscreen = 0;
    let turns = 0;
    for (const entry of state.ledger) {
      if (entry.type !== "PROMOTION_ALIGNMENT_CHANGED") continue;
      if (entry.payload.promotionId !== promotionId || entry.payload.personId !== personId || entry.payload.changed !== true) continue;
      const age = current - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
      if (age < 0 || age >= lookbackWeeks) continue;
      if (entry.payload.method === "OFFSCREEN_SWITCH") offscreen += 1;
      else if (entry.payload.method === "TURN") turns += 1;
    }
    const changes = offscreen + turns;
    const confusion = offscreen * 1.1 + Math.max(0, changes - 1) * 0.65;
    worst = Math.max(worst, confusion);
  }

  return -Math.min(3, Math.round(worst * 10) / 10);
}

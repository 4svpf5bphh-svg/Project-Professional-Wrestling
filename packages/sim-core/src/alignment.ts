import type { Person, WorldState } from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { PromotionWrestlerPresentation } from "../../domain/src/promotion-presentation.js";
import { deterministicSeedFromText } from "./rng.js";

type AlignmentAwarePerson = Person & { alignment?: WrestlerAlignment };

export const WRESTLER_ALIGNMENTS = ["FACE", "HEEL", "TWEENER"] as const satisfies readonly WrestlerAlignment[];

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

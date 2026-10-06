import type { Person } from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
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

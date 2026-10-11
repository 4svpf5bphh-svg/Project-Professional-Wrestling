/**
 * Portable on-screen wrestler identity. A wrestler has at most one authoritative
 * active identity in a World, independent of all promotion contracts.
 *
 * Legacy promotion-owned edits stay in engagement; they are NOT silently
 * promoted into a wrestler's shared career and must not overwrite another
 * company's active portrayal. A future consent-aware command will be the only
 * writer to this collection.
 */
import type { Id, PpwDate } from "./types.js";

export type IdentityMoveCategory = "STRIKE"|"GRAPPLE"|"SUBMISSION"|"AERIAL"|"POWER"|"OTHER";
export type PortableIdentityProvenance = "CURATED"|"NEGOTIATED"|"LEGACY_MIGRATED"|"UNCURATED_BASELINE";
export interface PortableIdentityMove {
  name: string;
  category: IdentityMoveCategory;
}
export interface PortableIdentityPersona {
  personaName: string;
  gimmickId: string;
  primaryStyle: string;
  secondaryStyle: string|null;
  signatureMoves: PortableIdentityMove[];
  finishingMoves: PortableIdentityMove[];
  introducedDate: PpwDate;
  provenance: PortableIdentityProvenance;
}
export interface PortableIdentityEra {
  persona: PortableIdentityPersona;
  endedDate: PpwDate;
  /** The promotion whose booker and wrestler negotiated the next version. */
  changedByPromotionId: Id|null;
}
export interface PortableWrestlerIdentity {
  worldId: Id;
  personId: Id;
  revision: number;
  active: PortableIdentityPersona;
  history: PortableIdentityEra[];
}

declare module "./types.js" {
  interface WorldState {
    /** Absent on pre-v9 Worlds; an empty collection uses curated read fallbacks. */
    wrestlerIdentities?: PortableWrestlerIdentity[];
  }
}

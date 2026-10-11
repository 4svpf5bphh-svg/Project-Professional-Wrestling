/**
 * Resolve the public portable career identity without mutating a World.
 * Curated known moves are real-world reference data; absence of curation
 * remains explicitly incomplete rather than a fabricated signature/finisher.
 * Promotion-local edits are NOT portable history until the wrestler and all
 * affected controllers have passed a separately validated negotiation.
 */
import type {Person,WorldState} from "../../domain/src/types.js";
import type {PortableWrestlerIdentity,PortableIdentityPersona} from "../../domain/src/wrestler-identity.js";
import {portableWrestlerIdentityRecord} from "../../sim-core/src/wrestler-identity.js";
import {curatedCharacterFor} from "../../content/src/real-wrestler-characters.js";
import {alternatePersonaReferencesFor, type DocumentedAlternatePersona} from "../../content/src/verified-alternate-personas.js";
import {defaultWrestlerCreativeFields} from "./wrestler-creative.js";
import {authoredPersonaForPerson} from "../../sim-core/src/identity-generation.js";

export interface WrestlerPortableIdentityView {
  source:"WORLD_RECORD"|"CURATED_BASELINE"|"UNCURATED_BASELINE"|"GAME_AUTHORED";
  active:PortableIdentityPersona;
  history:PortableWrestlerIdentity["history"];
  /** Curated real-world context; never converted to PPW career history on read. */
  documentedAlternates:DocumentedAlternatePersona[];
  revision:number;
  /** Empty fields mean genuinely uncurated / undocumented repertoire. */
  completeness:{hasSignature:boolean;hasFinisher:boolean;hasGimmick:boolean};
}
export function wrestlerPortableIdentityFor(state:WorldState,person:Person):WrestlerPortableIdentityView {
  const existing=portableWrestlerIdentityRecord(state,person.id);
  const curated=curatedCharacterFor(person.name);
  const base=defaultWrestlerCreativeFields(person);
  const generated=authoredPersonaForPerson(person);
  const curatedSignatures=curated
    ? ("signatureMoves" in curated
      ? curated.signatureMoves.map(move=>({...move,source:"VERIFIED" as const}))
      : curated.signatureMove?[{...curated.signatureMove,source:"VERIFIED" as const}]:[])
    : [];
  const curatedFinishers=curated
    ? ("finishingMoves" in curated
      ? curated.finishingMoves.map(move=>({...move,source:"VERIFIED" as const}))
      : curated.finishingMove?[{...curated.finishingMove,source:"VERIFIED" as const}]:[])
    : [];
  const active:PortableIdentityPersona=existing?.active??(curated?{
    personaName:base.ringName,
    gimmickId:base.gimmickArchetype,
    primaryStyle:base.primaryStyle,
    secondaryStyle:base.secondaryStyle,
    signatureMoves:curatedSignatures.length?curatedSignatures:generated.signatureMoves,
    finishingMoves:curatedFinishers.length?curatedFinishers:generated.finishingMoves,
    introducedDate:{...person.debutDate},
    provenance:"CURATED",
  }:generated);
  const complete={
    hasSignature:active.signatureMoves.length>0,
    hasFinisher:active.finishingMoves.length>0,
    hasGimmick:active.gimmickId!=="AUTHENTIC",
  };
  return {
    source:existing?"WORLD_RECORD":curated?"CURATED_BASELINE":"GAME_AUTHORED",
    active:structuredClone(active),
    history:existing?structuredClone(existing.history):[],
    documentedAlternates:alternatePersonaReferencesFor(person.name),
    revision:existing?.revision??0,
    completeness:complete,
  };
}

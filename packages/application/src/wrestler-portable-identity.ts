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
import {defaultWrestlerCreativeFields} from "./wrestler-creative.js";

export interface WrestlerPortableIdentityView {
  source:"WORLD_RECORD"|"CURATED_BASELINE"|"UNCURATED_BASELINE";
  active:PortableIdentityPersona;
  history:PortableWrestlerIdentity["history"];
  revision:number;
  /** Empty fields mean genuinely uncurated / undocumented repertoire. */
  completeness:{hasSignature:boolean;hasFinisher:boolean;hasGimmick:boolean};
}
export function wrestlerPortableIdentityFor(state:WorldState,person:Person):WrestlerPortableIdentityView {
  const existing=portableWrestlerIdentityRecord(state,person.id);
  const curated=curatedCharacterFor(person.name);
  const base=defaultWrestlerCreativeFields(person);
  const active=existing?.active??{
    personaName:base.ringName,
    gimmickId:base.gimmickArchetype,
    primaryStyle:base.primaryStyle,
    secondaryStyle:base.secondaryStyle,
    signatureMoves:curated && "signatureMoves" in curated
      ? curated.signatureMoves.map(move=>({...move}))
      : base.signatureMove?[{...base.signatureMove}]:[],
    finishingMoves:curated && "finishingMoves" in curated
      ? curated.finishingMoves.map(move=>({...move}))
      : base.finishingMove?[{...base.finishingMove}]:[],
    introducedDate:{...person.debutDate},
    provenance:curated?"CURATED" as const:"UNCURATED_BASELINE" as const,
  };
  const complete={
    hasSignature:active.signatureMoves.length>0,
    hasFinisher:active.finishingMoves.length>0,
    hasGimmick:active.gimmickId!=="AUTHENTIC",
  };
  return {
    source:existing?"WORLD_RECORD":curated?"CURATED_BASELINE":"UNCURATED_BASELINE",
    active:structuredClone(active),
    history:existing?structuredClone(existing.history):[],
    revision:existing?.revision??0,
    completeness:complete,
  };
}

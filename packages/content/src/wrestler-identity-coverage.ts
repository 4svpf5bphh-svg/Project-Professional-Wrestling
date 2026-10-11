/**
 * Alpha editorial curation of a wrestler's initial portable persona.
 *
 * New Worlds: replace algorithmic seed records only when exact-name published
 * curation exists. Existing Worlds: fill MISSING records only, never change
 * player-authored eras, historical promotions or local presentation edits.
 * Missing facts in a curated record use conspicuously PPW-authored move names,
 * never misrepresented as real documented finishers.
 */
import type {WorldState,Person} from "../../domain/src/types.js";
import type {PortableWrestlerIdentity,PortableIdentityMove} from "../../domain/src/wrestler-identity.js";
import {authoredWrestlerIdentity} from "../../sim-core/src/identity-generation.js";
import {curatedCharacterFor} from "./real-wrestler-characters.js";
import {fullRealRosterIdentityFor} from "./full-real-roster-identity-guide.js";
type CurationMode="NEW_WORLD"|"EXISTING_WORLD";

function initialIdentity(state:WorldState,person:Person):PortableWrestlerIdentity {
  const authored=authoredWrestlerIdentity(state,person);
  const curated=curatedCharacterFor(person.name);
  if(!curated){
    const guide=fullRealRosterIdentityFor(person.name);
    if(!guide)return authored; // Only for future fictional prospects or unknown imports.
    return {
      ...authored,
      active:{
        ...authored.active,
        gimmickId:guide.gimmickArchetype,
        primaryStyle:guide.primaryStyle,
        secondaryStyle:guide.secondaryStyle,
        signatureMoves:guide.signatureMoves.map(move=>({...move})),
        finishingMoves:guide.finishingMoves.map(move=>({...move})),
        provenance:"ROSTER_APPROXIMATION",
      },
    };
  }
  const signatures="signatureMoves" in curated
    ? curated.signatureMoves.map(m=>({...m,source:"VERIFIED" as const}))
    : curated.signatureMove?[{...curated.signatureMove,source:"VERIFIED" as const}]:[];
  const finishers="finishingMoves" in curated
    ? curated.finishingMoves.map(m=>({...m,source:"VERIFIED" as const}))
    : curated.finishingMove?[{...curated.finishingMove,source:"VERIFIED" as const}]:[];
  const authoredOnly=(moves:PortableIdentityMove[])=>moves.map(m=>({...m,source:"PPW_AUTHORED" as const}));
  return {
    ...authored,
    active:{
      ...authored.active,
      gimmickId:curated.gimmickArchetype,
      primaryStyle:curated.primaryStyle,
      secondaryStyle:curated.secondaryStyle,
      signatureMoves:signatures.length?signatures:authoredOnly(authored.active.signatureMoves),
      finishingMoves:finishers.length?finishers:authoredOnly(authored.active.finishingMoves),
      provenance:"CURATED",
    },
  };
}

/** Explicit, repeatable World preparation. Does not invent a player decision. */
export function completeAlphaWrestlerIdentityCoverage(state:WorldState,mode:CurationMode="EXISTING_WORLD"):number {
  const records=(state.wrestlerIdentities??=[]);
  const byPerson=new Map(records.map(record=>[record.personId,record]));
  let changes=0;
  for(const person of state.people){
    const current=byPerson.get(person.id);
    if(!current){
      records.push(initialIdentity(state,person));
      changes++;
      continue;
    }
    // Called only in first bootstrap, before any gameplay, existing records
    // must be untouched, even when later source catalogues are expanded.
    if(mode==="NEW_WORLD" && current.active.provenance==="GAME_AUTHORED"
      &&current.revision===1&&current.history.length===0
      &&(curatedCharacterFor(person.name)||fullRealRosterIdentityFor(person.name))){
      const index=records.indexOf(current);
      records[index]=initialIdentity(state,person);
      changes++;
    }
  }
  return changes;
}

/**
 * Pure shared-World identity validation. No roster editing or match/contract
 * logic can mutate these records without a future authorised World command.
 */
import type { WorldState } from "../../domain/src/types.js";
import type { PortableWrestlerIdentity, PortableIdentityPersona } from "../../domain/src/wrestler-identity.js";
import { comparePpwDates } from "./clock.js";

function validPersona(p:PortableIdentityPersona, state:WorldState):boolean {
  if(!p || typeof p.personaName!=="string" || !p.personaName.trim()
    ||p.personaName.length>60||typeof p.gimmickId!=="string"||!p.gimmickId.trim()
    ||p.gimmickId.length>100||typeof p.primaryStyle!=="string"||!p.primaryStyle.trim()
    ||p.primaryStyle.length>50||!(p.secondaryStyle===null
      ||typeof p.secondaryStyle==="string"&&p.secondaryStyle.length<=50&&p.secondaryStyle!==p.primaryStyle)
    ||!p.introducedDate||!Number.isInteger(p.introducedDate.year)||p.introducedDate.year<1
    ||!Number.isInteger(p.introducedDate.week)||p.introducedDate.week<1
    ||p.introducedDate.week>state.ruleset.weeksPerYear
    ||!Number.isInteger(p.introducedDate.day)||p.introducedDate.day<1||p.introducedDate.day>7
    ||!["CURATED","NEGOTIATED","LEGACY_MIGRATED","UNCURATED_BASELINE","GAME_AUTHORED"].includes(p.provenance)
    ||!Array.isArray(p.signatureMoves)||!Array.isArray(p.finishingMoves)
    ||p.signatureMoves.length>12||p.finishingMoves.length>12) return false;
  const validMoves=(list:PortableIdentityPersona["signatureMoves"])=>{
    const names=new Set<string>();
    for(const m of list){
      if(!m || typeof m.name!=="string" || !m.name.trim() || m.name.length>80
        || !["STRIKE","GRAPPLE","SUBMISSION","AERIAL","POWER","OTHER"].includes(m.category)
        ||names.has(m.name.toLocaleLowerCase("en-GB"))
        || (m.source!==undefined && m.source!=="VERIFIED" && m.source!=="PPW_AUTHORED")) return false;
      names.add(m.name.toLocaleLowerCase("en-GB"));
    }
    return true;
  };
  return validMoves(p.signatureMoves)&&validMoves(p.finishingMoves);
}
export function validatePortableWrestlerIdentities(state:WorldState):void {
  const people=new Set(state.people.map(x=>x.id));
  const promotions=new Set(state.promotions.map(x=>x.id));
  const seen=new Set<string>();
  for(const record of state.wrestlerIdentities??[]){
    if(!record ||record.worldId!==state.world.id ||!people.has(record.personId)
      ||seen.has(record.personId)||!Number.isSafeInteger(record.revision)
      ||record.revision<1||!validPersona(record.active,state)
      ||!Array.isArray(record.history)||record.history.length>100) {
      throw new Error("invalid or duplicate shared wrestler identity");
    }
    seen.add(record.personId);
    let preceding=null as PortableIdentityPersona|null;
    for(const era of record.history){
      if(!era||!validPersona(era.persona,state)
        ||!era.endedDate||!Number.isInteger(era.endedDate.year)||era.endedDate.year<1
        ||!Number.isInteger(era.endedDate.week)||!Number.isInteger(era.endedDate.day)
        ||era.endedDate.day<1||era.endedDate.day>7
        ||era.endedDate.week<1||era.endedDate.week>state.ruleset.weeksPerYear
        ||(era.changedByPromotionId!==null&&!promotions.has(era.changedByPromotionId))
        ||comparePpwDates(era.persona.introducedDate,era.endedDate,state.ruleset.weeksPerYear)>0
        ||preceding && comparePpwDates(preceding.introducedDate,era.persona.introducedDate,state.ruleset.weeksPerYear)>=0)
        throw new Error("invalid shared wrestler identity history");
      preceding=era.persona;
    }
    if(preceding && comparePpwDates(preceding.introducedDate,record.active.introducedDate,state.ruleset.weeksPerYear)>=0)
      throw new Error("shared wrestler identity history is not chronological");
  }
}
/** No implicit mutable record creation for lookups, previews or AI promotions. */
export function portableWrestlerIdentityRecord(state:WorldState,personId:string):PortableWrestlerIdentity|null {
  const record=(state.wrestlerIdentities??[]).find(x=>x.personId===personId);
  return record?structuredClone(record):null;
}

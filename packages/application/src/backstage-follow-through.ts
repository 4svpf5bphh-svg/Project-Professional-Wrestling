/**
 * Observe actual booker follow-through on previously considered creative pitches.
 *
 * This is evidence and history ONLY. It doesn't create teams, programmes,
 * scripts, outcomes or wrestling relationships. Match chemistry and programme
 * heat are already simulated elsewhere; no second bonus is applied here.
 */
import type { Id, PpwDate } from "../../domain/src/types.js";
import type { Programme } from "../../domain/src/programmes.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";
import type { BackstageConversation } from "./engagement.js";
import { activePromotionControlForPromotion } from "./ownership.js";

type Baseline = NonNullable<BackstageConversation["creativeBaseline"]>;
type FollowThrough = NonNullable<BackstageConversation["creativeFollowThrough"]>;

function atLeast(a:PpwDate,b:PpwDate,yearWeeks:number):boolean {
  return comparePpwDates(a,b,yearWeeks)>=0;
}
function strictlyAfter(a:PpwDate,b:PpwDate,yearWeeks:number):boolean {
  return comparePpwDates(a,b,yearWeeks)>0;
}
function matchPair(refs: {kind:string;entityId:Id}[],id:Id):boolean {
  return refs.some(ref=>ref.kind==="PERSON" && ref.entityId===id);
}
function opposed(programme:Programme,a:Id,b:Id):boolean {
  return (matchPair(programme.sideA,a)&&matchPair(programme.sideB,b))
    || (matchPair(programme.sideA,b)&&matchPair(programme.sideB,a));
}
function validMatchSide(
  aggregate: ApplicationWorldAggregate,matchId:Id,a:Id,b:Id,
): boolean {
  const people=aggregate.state.matchParticipants.filter(p=>p.matchId===matchId);
  const groups=new Map<string,Id[]>();
  for(const p of people){const side=groups.get(p.side)??[];side.push(p.personId);groups.set(p.side,side)}
  return [...groups.values()].some(ids=>ids.length===2&&ids.includes(a)&&ids.includes(b)
    && ids[0]!==ids[1]);
}

/** Take a genuine baseline at the response command, including same-day edits. */
export function creativeBaselineAtResponse(
  aggregate:ApplicationWorldAggregate,
  conversation:BackstageConversation,
): Baseline {
  const state=aggregate.state;
  const record=aggregate.engagement?.wrestlerCreativeProfiles?.find(x=>
    x.promotionId===conversation.promotionId&&x.personId===conversation.wrestlerId);
  return {
    existingProgrammeIds:(state.programmes??[]).filter(p=>
      p.promotionId===conversation.promotionId
      &&comparePpwDates(p.startedDate,state.world.currentDate,
        state.ruleset.weeksPerYear)===0).map(p=>p.id),
    existingCompletedMatchIds:state.matches.filter(m=>
      m.promotionId===conversation.promotionId&&m.status==="COMPLETED"
      &&state.events.some(e=>e.id===m.eventId&&comparePpwDates(
        e.date,state.world.currentDate,state.ruleset.weeksPerYear)===0)).map(m=>m.id),
    lastPresentationRevision:(record?.history??[]).reduce((best,entry)=>Math.max(best,entry.revision),0),
  };
}

function evidenceFor(aggregate:ApplicationWorldAggregate,conversation:BackstageConversation):FollowThrough|null{
  const state=aggregate.state;
  const date=conversation.responseDate;
  if(!date) return null;
  const weeksPerYear=state.ruleset.weeksPerYear;
  const baseline=conversation.creativeBaseline;
  // Old saves lack a baseline; same-day actions are ambiguous, so require
  // a *later date* instead of accidentally crediting work done before the reply.
  const after=(when:PpwDate):boolean=>baseline
    ? atLeast(when,date,weeksPerYear):strictlyAfter(when,date,weeksPerYear);
  const evidence=(kind:FollowThrough["kind"],id:Id,when:PpwDate):FollowThrough=>({
    kind,evidenceId:id,happenedDate:{...when},recordedDate:{...state.world.currentDate},
  });

  if(conversation.response==="CONSIDER_RIVALRY"&&conversation.rivalPersonId){
    const programme=(state.programmes??[]).filter(p=>
      p.promotionId===conversation.promotionId
      && !baseline?.existingProgrammeIds.includes(p.id)
      && after(p.startedDate)
      && opposed(p,conversation.wrestlerId,conversation.rivalPersonId!))
      .sort((a,b)=>comparePpwDates(a.startedDate,b.startedDate,weeksPerYear)
        ||a.id.localeCompare(b.id))[0];
    if(programme)return evidence("PROGRAMME_STARTED",programme.id,programme.startedDate);
  }
  if(conversation.response==="CONSIDER_GIMMICK_CHANGE"){
    const record=aggregate.engagement?.wrestlerCreativeProfiles?.find(p=>
      p.promotionId===conversation.promotionId&&p.personId===conversation.wrestlerId);
    const change=record?.history.find(entry=>
      (baseline?entry.revision>baseline.lastPresentationRevision:strictlyAfter(entry.date,date,weeksPerYear))
      && after(entry.date)
      && (entry.previous.ringName!==entry.next.ringName
        ||entry.previous.gimmickArchetype!==entry.next.gimmickArchetype
        ||entry.previous.gimmickDescription!==entry.next.gimmickDescription));
    if(change)return evidence("GIMMICK_UPDATED",
      `creative:${conversation.promotionId}:${conversation.wrestlerId}:rev${change.revision}`,change.date);
  }
  if(conversation.response==="CONSIDER_TAG_TEAM"&&conversation.partnerPersonId){
    const eventById=new Map(state.events.filter(e=>
      e.promotionId===conversation.promotionId&&e.status==="COMPLETED").map(e=>[e.id,e]));
    const appearances=new Map<Id,Set<string>>();
    for(const a of state.scheduledAppearances){
      if(a.promotionId!==conversation.promotionId||a.status!=="COMPLETED"||!eventById.has(a.eventId))continue;
      const group=appearances.get(a.eventId)??new Set<string>();
      group.add(a.personId+"|"+a.contractId);appearances.set(a.eventId,group);
    }
    const matches=state.matches.filter(m=>m.promotionId===conversation.promotionId
      &&m.type==="TAG"&&m.status==="COMPLETED"
      &&!baseline?.existingCompletedMatchIds.includes(m.id)
      &&eventById.has(m.eventId)
      &&after(eventById.get(m.eventId)!.date)
      &&validMatchSide(aggregate,m.id,conversation.wrestlerId,conversation.partnerPersonId!))
      .filter(m=>{
        const a=appearances.get(m.eventId);
        return a?.has(conversation.wrestlerId+"|"+conversation.sourceContractId)
          && [...a].some(token=>token.startsWith(conversation.partnerPersonId+"|"));
      }).sort((a,b)=>comparePpwDates(eventById.get(a.eventId)!.date,
        eventById.get(b.eventId)!.date,weeksPerYear)||a.id.localeCompare(b.id));
    if(matches[0])return evidence("TAG_MATCH_BOOKED",
      matches[0].id,eventById.get(matches[0].eventId)!.date);
  }
  return null;
}

/**
 * Called once in the persisted World Lock transaction after actual show
 * resolution. Repeated invocations are idempotent; read views never write.
 */
export function assessCreativeFollowThrough(aggregate:ApplicationWorldAggregate):number{
  let recorded=0;
  for(const conversation of aggregate.engagement?.backstageConversations??[]){
    if(conversation.status!=="ANSWERED"||conversation.creativeFollowThrough)continue;
    if(!["CONSIDER_TAG_TEAM","CONSIDER_RIVALRY","CONSIDER_GIMMICK_CHANGE"].includes(
      conversation.response??""))continue;
    // No credit for subsequent AI booking after a promotion lost human control.
    if(!activePromotionControlForPromotion(aggregate.ownership,conversation.promotionId))continue;
    const today=ppwDateToWeekIndex(aggregate.state.world.currentDate,aggregate.state.ruleset.weeksPerYear);
    const responded=conversation.responseDate
      ?ppwDateToWeekIndex(conversation.responseDate,aggregate.state.ruleset.weeksPerYear):today;
    // A casual "consider" is not an indefinitely outstanding promise.
    // Bound the audit window so 100-year Worlds don't rescan ancient offers.
    if(today-responded>26)continue;
    const result=evidenceFor(aggregate,conversation);
    if(!result)continue;
    conversation.creativeFollowThrough=result;
    recorded++;
  }
  return recorded;
}

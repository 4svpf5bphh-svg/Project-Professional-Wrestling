declare const process: { exitCode?: number };
import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { claimIndependentPromotionForPlayer } from "../packages/application/src/ownership.js";
import { activeContractsForPromotion } from "../packages/sim-core/src/index.js";
import { addPpwWeeks } from "../packages/sim-core/src/clock.js";
import { openBackstageConversation, createWorldEngagementState } from "../packages/application/src/engagement.js";
import { respondBackstageConversationCommand, buildPlayerBackstageView } from "../packages/application/src/backstage.js";
import { assessWorkingConcernFollowThrough } from "../packages/application/src/backstage-working-follow-through.js";
import { cloneApplicationWorld } from "../packages/application/src/world-aggregate.js";
import type { Match, WrestlingEvent } from "../packages/domain/src/types.js";

let passed=0,failed=0;
const ok=(v:unknown,m:string)=>{if(!v)throw Error(m);};
function test(n:string,fn:()=>void){try{fn();passed++;console.log("PASS "+n);}catch(e){failed++;console.error("FAIL "+n+" "+e);}}
function fixture(reply:"DISCUSS_WORKING_PLAN"|"KEEP_WORKING_PAIR"|"CONSIDER_PARTNER_CHANGE"){
  const a=createAlphaWorldAggregate({seed:90471,playerId:"owner"});
  const promotion=a.state.promotions.find(p=>p.playerTakeoverEligibility==="STANDARD" &&p.lifecycle==="ACTIVE")!;
  claimIndependentPromotionForPlayer(a.state,a.ownership,"owner",promotion.id);
  a.engagement=createWorldEngagementState(a.state.world.id);
  const contracts=activeContractsForPromotion(a.state,promotion.id).slice(0,3);
  ok(contracts.length===3,"needs three signed roster workers");
  const [lead,partner,alternative]=contracts;
  for(const c of contracts){c.datesUsed=0;c.dateEntitlement=20;c.endDate=addPpwWeeks(a.state.world.currentDate,25,a.state.ruleset.weeksPerYear);}
  const notice=openBackstageConversation(a.engagement!,{
    conversationId:"test:working:"+reply,worldId:a.state.world.id,promotionId:promotion.id,
    wrestlerId:lead!.personId,partnerPersonId:partner!.personId,sourceContractId:lead!.id,
    kind:"WORKING_PARTNERSHIP_CONCERN",createdDate:{...a.state.world.currentDate},
    status:"OPEN",response:null,responseDate:null,promisedRole:null,
    observedMatchShows:3,observedFeaturedShows:0,workingSourceLedgerId:"ledger:known",
    workingTrustDelta:-0.6,professionalTrustAtPitch:55,
  });
  return {a,promotion,lead:lead!,partner:partner!,alternative:alternative!,notice,reply};
}
function book(f:ReturnType<typeof fixture>,otherId:string,id:string,weekOffset:number,
  status:"COMPLETED"|"SCHEDULED"="COMPLETED",foreign=false){
  const {a,promotion,lead}=f,state=a.state;
  const promotionId=foreign ?state.promotions.find(p=>p.id!==promotion.id)!.id:promotion.id;
  const date=addPpwWeeks(f.notice.createdDate,weekOffset,state.ruleset.weeksPerYear);
  date.day=weekOffset===0?1:6;
  const venue=state.venues.find(v=>v.marketId===promotion.homeMarketId)!;
  const eventId="event:"+id,matchId="match:"+id;
  const event:WrestlingEvent={id:eventId,worldId:state.world.id,promotionId,
    marketId:promotion.homeMarketId,venueId:venue.id,date,
    type:"REGULAR",status,ticketStrategy:"STANDARD",expectedDemand:100,
    attendance:100,ticketYield:20,gateRevenue:2000,totalCost:1000,netResult:1000,
    eventImportance:50,matchCount:1,averageMatchRating:3,
    bestMatchRating:3,crowdResponse:70};
  const match:Match={id:matchId,worldId:state.world.id,eventId,promotionId,order:1,
    type:"TAG",status,intent:"COMPETITIVE",plannedLengthMinutes:12,
    actualLengthMinutes:12,intendedWinnerSide:"A",actualWinnerSide:"A",
    finishChangedDueToInjury:false,executionQuality:73,
    criticalRatingStars:3,crowdResponse:70};
  state.events.push(event);state.matches.push(match);
  const others=state.people.filter(p=>p.id!==lead.personId&&p.id!==otherId).slice(0,2);
  const ids=[lead.personId,otherId,others[0]!.id,others[1]!.id];
  state.matchParticipants.push(...ids.map((personId,i)=>({
    id:matchId+":person:"+i,worldId:state.world.id,eventId,matchId,
    personId,side:i<2?"A" as const:"B" as const,won:i<2,
  })));
  for(const personId of [lead.personId,otherId]){
    const contract=activeContractsForPromotion(state,promotion.id).find(c=>c.personId===personId)!;
    state.scheduledAppearances.push({
      id:matchId+":date:"+personId,worldId:state.world.id,
      eventId,promotionId,personId,contractId:contract.id,date,
      serviceCapacityAtBooking:1,status:status==="COMPLETED"?"COMPLETED":"COMMITTED",
    });
  }
}
function answer(f:ReturnType<typeof fixture>){
  respondBackstageConversationCommand(f.a,{
    requestId:"response:"+f.reply,worldId:f.a.state.world.id,playerId:"owner",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:f.notice.conversationId,response:f.reply},
  });
}
test("Earlier work is excluded, completed future partnership is frozen once and remembered",()=>{
  const f=fixture("DISCUSS_WORKING_PLAN");
  book(f,f.partner.personId,"before",0);answer(f);
  ok(f.notice.creativeBaseline?.existingCompletedMatchIds.includes("match:before"),
    "response lacked a proper same-date baseline");
  ok(assessWorkingConcernFollowThrough(f.a)===0,"previous work received false credit");
  book(f,f.partner.personId,"after",1);
  f.a.state.world.currentDate=addPpwWeeks(f.a.state.world.currentDate,2,f.a.state.ruleset.weeksPerYear);
  const before=JSON.stringify(f.a.state);
  ok(assessWorkingConcernFollowThrough(f.a)===1,"completed later partnership missing");
  ok(f.notice.workingFollowThrough?.kind==="PARTNERS_REBOOKED"
    &&f.notice.workingFollowThrough.evidenceMatchId==="match:after",
    "future evidence not frozen");
  ok(assessWorkingConcernFollowThrough(f.a)===0 &&JSON.stringify(f.a.state)===before,
    "World Lock retry changed wrestling simulation");
  ok(buildPlayerBackstageView(f.a,"owner").conversations.some(c=>
    c.workingFollowThrough?.evidenceMatchId==="match:after"),"private read view missing history");
  ok(cloneApplicationWorld(f.a).engagement?.backstageConversations.some(c=>
    c.workingFollowThrough?.evidenceMatchId==="match:after"),"save/restore lost history");
  f.a.state.world.currentDate=addPpwWeeks(f.a.state.world.currentDate,1,f.a.state.ruleset.weeksPerYear);
  const later=openBackstageConversation(f.a.engagement!,{
    conversationId:"test:later-pitch",worldId:f.a.state.world.id,promotionId:f.promotion.id,
    wrestlerId:f.lead.personId,partnerPersonId:f.partner.personId,sourceContractId:f.lead.id,
    kind:"TAG_TEAM_PITCH",createdDate:{...f.a.state.world.currentDate},status:"OPEN",
    response:null,responseDate:null,promisedRole:null,observedMatchShows:0,
    observedFeaturedShows:0,sharedTagMatches:2,averageCrowdResponse:73,
  });
  ok(later.continuity?.lastWorkingDecision?.response==="DISCUSS_WORKING_PLAN"
    &&later.continuity.lastWorkingDecision.observedLaterKind==="PARTNERS_REBOOKED",
    "the next conversation forgot recorded work with this exact pair");
  const frozen=JSON.stringify(later.continuity);
  f.notice.workingFollowThrough=undefined;
  ok(JSON.stringify(later.continuity)===frozen,"future edits changed past frozen continuity");
});
test("Alternative partner is an observed fact, not a team edit, and outside shows never count",()=>{
  const f=fixture("CONSIDER_PARTNER_CHANGE");answer(f);
  book(f,f.partner.personId,"old",1);
  book(f,f.alternative.personId,"foreign",1,"COMPLETED",true);
  f.a.state.world.currentDate=addPpwWeeks(f.a.state.world.currentDate,2,f.a.state.ruleset.weeksPerYear);
  ok(assessWorkingConcernFollowThrough(f.a)===0,
    "old partner or outside match was misreported as the booker's new pairing");
  book(f,f.alternative.personId,"new",2);
  f.a.state.world.currentDate=addPpwWeeks(f.notice.createdDate,3,f.a.state.ruleset.weeksPerYear);
  const before=JSON.stringify(f.a.state);
  ok(assessWorkingConcernFollowThrough(f.a)===1
    &&f.notice.workingFollowThrough?.kind==="ALTERNATE_PARTNER_APPEARED"
    &&f.notice.workingFollowThrough.counterpartPersonId===f.alternative.personId,
    "verified alternative match not recorded");
  ok(assessWorkingConcernFollowThrough(f.a)===0&&JSON.stringify(f.a.state)===before,
    "alternative record mutated roster, trust or wrestling results");
});
console.log("\nWorking concern follow-through: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;

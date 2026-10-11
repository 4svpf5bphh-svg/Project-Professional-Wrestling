declare const process: { exitCode?: number };
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { openBackstageConversation } from "../packages/application/src/engagement.js";
import { createAlphaWorldAggregate, claimAlphaPromotion, loadAlphaPlayerSession } from "../packages/web-adapter/src/alpha-service.js";
import { loadAlphaBackstage, respondAlphaBackstage, discussAlphaBackstageProgrammeCreative } from "../packages/web-adapter/src/backstage-service.js";
import { createProgramme } from "../packages/sim-core/src/programmes.js";
import { lockWorldForResolution } from "../packages/application/src/runtime.js";

let passed=0;let failed=0;
function ok(value:unknown,message:string):void{if(!value)throw Error(message);}
async function test(name:string,fn:()=>Promise<void>):Promise<void>{
  try{await fn();passed++;console.log("PASS "+name);}
  catch(error){failed++;console.error("FAIL "+name+": "+String(error));}
}
await test("Backstage server endpoints persist responses, isolate owners and are idempotent",async()=>{
  const repository=new InMemoryApplicationWorldRepository();
  const aggregate=createAlphaWorldAggregate({seed:91120,playerId:"owner"});
  await repository.initialize(aggregate);
  const worldId=aggregate.state.world.id;
  const promotion=(await loadAlphaPlayerSession(repository,worldId,"owner")).availableIndependentPromotions[0]!;
  await claimAlphaPromotion(repository,worldId,"owner",{promotionId:promotion.promotionId,requestId:"claim-backstage-service"});
  await repository.transact(worldId,null,(current)=>{
    const contract=current.state.contracts.find(x=>x.promotionId===promotion.promotionId && x.status==="SIGNED")!;
    const engagement=current.engagement!;
    openBackstageConversation(engagement,{
      conversationId:"backstage:test:service",worldId,promotionId:promotion.promotionId,
      wrestlerId:contract.personId,sourceContractId:contract.id,kind:"ROLE_USAGE_CONCERN",
      createdDate:{...current.state.world.currentDate},status:"OPEN",
      response:null,responseDate:null,promisedRole:"UPPER_CARD",
      observedMatchShows:4,observedFeaturedShows:0,
    });
  });
  const before=await loadAlphaBackstage(repository,worldId,"owner");
  ok(before.openCount===1 && before.conversations[0]?.conversationId==="backstage:test:service",
    "owner cannot see request");
  let denied=false;
  try{await loadAlphaBackstage(repository,worldId,"intruder");}catch{denied=true;}
  ok(denied,"non-member got another owner's Backstage history");
  denied=false;
  try{await respondAlphaBackstage(repository,worldId,"intruder",{
    requestId:"invalid",conversationId:"backstage:test:service",response:"HEAR_OUT",
  });}catch{denied=true;}
  ok(denied,"non-member answered Backstage conversation");
  const response={requestId:"backstage-service-answer",conversationId:"backstage:test:service",response:"STAND_FIRM" as const};
  const after=await respondAlphaBackstage(repository,worldId,"owner",response);
  ok(after.openCount===0 && after.conversations[0]?.response==="STAND_FIRM",
    "response did not persist");
  const replay=await respondAlphaBackstage(repository,worldId,"owner",response);
  ok(replay.openCount===0 && replay.conversations.length===1,"replayed service response duplicated state");
  const persisted=await repository.load(worldId);
  ok(persisted.engagement?.backstageConversations[0]?.response==="STAND_FIRM",
    "conversation did not survive repository roundtrip");
});
await test("Creative repackage replies persist privately without performing any character edit",async()=>{
  const repository=new InMemoryApplicationWorldRepository();
  const aggregate=createAlphaWorldAggregate({seed:91121,playerId:"owner"});
  await repository.initialize(aggregate);
  const worldId=aggregate.state.world.id;
  const independent=(await loadAlphaPlayerSession(repository,worldId,"owner")).availableIndependentPromotions[0]!;
  await claimAlphaPromotion(repository,worldId,"owner",{promotionId:independent.promotionId,requestId:"claim-character-service"});
  await repository.transact(worldId,null,current=>{
    const contract=current.state.contracts.find(x=>x.promotionId===independent.promotionId&&x.status==="SIGNED")!;
    openBackstageConversation(current.engagement!,{
      conversationId:"backstage:test:gimmick",worldId,promotionId:independent.promotionId,
      wrestlerId:contract.personId,sourceContractId:contract.id,kind:"GIMMICK_CHANGE_PITCH",
      createdDate:{...current.state.world.currentDate},status:"OPEN",response:null,responseDate:null,
      promisedRole:null,observedMatchShows:4,observedFeaturedShows:0,
      observedCrowdResponse:50,currentGimmickArchetype:"AUTHENTIC",
      suggestedGimmickArchetype:"REBEL",
    });
  });
  const before=await loadAlphaBackstage(repository,worldId,"owner");
  ok(before.openCount===1 && before.conversations[0]?.suggestedGimmickArchetype==="REBEL",
    "server hid character proposal");
  let denied=false;
  try{await respondAlphaBackstage(repository,worldId,"intruder",{
    requestId:"intruder-character",conversationId:"backstage:test:gimmick",response:"CONSIDER_GIMMICK_CHANGE",
  });}catch{denied=true;}
  ok(denied,"a non-member answered the private character pitch");
  denied=false;
  try{await respondAlphaBackstage(repository,worldId,"owner",{
    requestId:"wrong-character-kind",conversationId:"backstage:test:gimmick",response:"HEAR_OUT",
  });}catch{denied=true;}
  ok(denied,"an unrelated reply was accepted for a creative request");
  const reply={requestId:"save-character-suggestion",conversationId:"backstage:test:gimmick",
    response:"CONSIDER_GIMMICK_CHANGE" as const};
  const after=await respondAlphaBackstage(repository,worldId,"owner",reply);
  ok(after.openCount===0&&after.conversations[0]?.response==="CONSIDER_GIMMICK_CHANGE",
    "service did not persist the player's creative discussion");
  const replay=await respondAlphaBackstage(repository,worldId,"owner",reply);
  ok(replay.openCount===0&&replay.conversations.length===1,"retry duplicated creative request");
  const saved=await repository.load(worldId);
  ok((saved.engagement?.wrestlerCreativeProfiles??[]).length===0,
    "reply to a gimmick pitch silently changed the wrestler's presentation");
});

await test("Backstage standing Programme offers persist actual wrestler decisions and history without booked outcomes",async()=>{
  const repository=new InMemoryApplicationWorldRepository();
  const aggregate=createAlphaWorldAggregate({seed:91122,playerId:"owner"});
  await repository.initialize(aggregate);
  const worldId=aggregate.state.world.id;
  const promotion=(await loadAlphaPlayerSession(repository,worldId,"owner")).availableIndependentPromotions[0]!;
  await claimAlphaPromotion(repository,worldId,"owner",{promotionId:promotion.promotionId,requestId:"claim-programme-backstage"});
  let programmeId="";
  let wrestlerId="";
  await repository.transact(worldId,null,current=>{
    const contracts=current.state.contracts.filter(c=>c.promotionId===promotion.promotionId&&c.status==="SIGNED");
    const one=contracts[0]!;
    const two=contracts.find(c=>c.personId!==one.personId && current.state.people.find(p=>p.id===c.personId)?.division===
      current.state.people.find(p=>p.id===one.personId)?.division)!;
    if(!one||!two)throw Error("missing same-division Programme wrestlers");
    one.creativeControl="FULL_APPROVAL";
    const wrestler=current.state.people.find(p=>p.id===one.personId)!;
    wrestler.morale=100;wrestler.fatigue=0;wrestler.priorities.loyalty=100;wrestler.priorities.role=0;
    wrestlerId=one.personId;
    const programme=createProgramme(current.state,{
      promotionId:promotion.promotionId,
      sideA:[{kind:"PERSON",entityId:one.personId}],
      sideB:[{kind:"PERSON",entityId:two.personId}],
    });
    programmeId=programme.id;
  });
  const before=await loadAlphaBackstage(repository,worldId,"owner");
  ok(before.programmeCreativeOptions.some(o=>o.programmeId===programmeId
    && o.wrestlerId===wrestlerId && o.previousDecision===null),
  "Backstage did not expose eligible full-approval Programme discussion");
  const request={
    requestId:"programme-conversation-91122",programmeId,personId:wrestlerId,
    matchType:"SINGLES" as const,permittedOutcome:"WIN_OR_PROTECTED_LOSS" as const,termWeeks:3,
  };
  let denied=false;
  try{await discussAlphaBackstageProgrammeCreative(repository,worldId,"intruder",request);}catch{denied=true;}
  ok(denied,"another owner negotiated a private Programme agreement");
  const after=await discussAlphaBackstageProgrammeCreative(repository,worldId,"owner",request);
  const conversation=after.conversations.find(c=>c.kind==="PROGRAMME_CREATIVE_AGREEMENT");
  ok(conversation?.status==="NOTED" && conversation.programmeCreative?.approved===true
    && conversation.programmeCreative.programmeId===programmeId,
    "accepted standing terms were not recorded in the actual Backstage conversation history");
  ok(conversation.dialogue.speech.includes("happy to work") && after.openCount===before.openCount,
    "new discussion displaced the existing Backstage inbox or fabricated a response request");
  const option=after.programmeCreativeOptions.find(o=>o.programmeId===programmeId && o.wrestlerId===wrestlerId);
  ok(option?.previousDecision==="APPROVED","Backstage option still offers a consumed Programme negotiation");
  const world=await repository.load(worldId);
  const version=world.runtime.revision;
  ok(world.planning.standingProgrammeCreativeAgreements?.length===1
    && world.engagement?.backstageConversations.filter(c=>c.kind==="PROGRAMME_CREATIVE_AGREEMENT").length===1,
    "negotiation did not persist exactly one authoritative consent plus message");
  ok(world.state.matches.filter(m=>m.status==="SCHEDULED").length===
    aggregate.state.matches.filter(m=>m.status==="SCHEDULED").length,
    "Backstage discussion silently booked wrestling matches");
  const replay=await discussAlphaBackstageProgrammeCreative(repository,worldId,"owner",request);
  const replayWorld=await repository.load(worldId);
  ok(replayWorld.runtime.revision===version && replay.conversations.length===after.conversations.length,
    "retry duplicated an agreed Programme discussion");
  denied=false;
  try{await discussAlphaBackstageProgrammeCreative(repository,worldId,"owner",{
    ...request,requestId:"try-a-new-agreement",termWeeks:6,
  });}catch{denied=true;}
  ok(denied && (await repository.load(worldId)).runtime.revision===version,
    "changing negotiated terms rerolled wrestler consent or mutated World");
});

await test("Backstage persists declined Programme negotiations and World Lock blocks late offers",async()=>{
  const repository=new InMemoryApplicationWorldRepository();
  const aggregate=createAlphaWorldAggregate({seed:91123,playerId:"owner"});
  await repository.initialize(aggregate);
  const worldId=aggregate.state.world.id;
  const promotion=(await loadAlphaPlayerSession(repository,worldId,"owner")).availableIndependentPromotions[0]!;
  await claimAlphaPromotion(repository,worldId,"owner",{promotionId:promotion.promotionId,requestId:"claim-programme-refusal"});
  let programmeId="",personId="";
  await repository.transact(worldId,null,current=>{
    const one=current.state.contracts.find(c=>c.promotionId===promotion.promotionId&&c.status==="SIGNED")!;
    const two=current.state.contracts.find(c=>c.promotionId===promotion.promotionId&&c.status==="SIGNED"
      && c.personId!==one.personId && current.state.people.find(p=>p.id===c.personId)?.division===
      current.state.people.find(p=>p.id===one.personId)?.division)!;
    if(!one||!two)throw Error("no same-division contract pairing");
    one.creativeControl="FULL_APPROVAL"; one.roleExpectation="MAIN_EVENT";
    const p=current.state.people.find(p=>p.id===one.personId)!;
    p.morale=0;p.fatigue=100;p.priorities.loyalty=0;p.priorities.role=100;
    personId=one.personId;
    programmeId=createProgramme(current.state,{
      promotionId:promotion.promotionId,sideA:[{kind:"PERSON",entityId:one.personId}],
      sideB:[{kind:"PERSON",entityId:two.personId}],
    }).id;
  });
  const request={requestId:"record-refused-programme",programmeId,personId,matchType:"SINGLES" as const,
    permittedOutcome:"WIN_ONLY" as const,termWeeks:2};
  const after=await discussAlphaBackstageProgrammeCreative(repository,worldId,"owner",request);
  ok(after.conversations.some(c=>c.kind==="PROGRAMME_CREATIVE_AGREEMENT"
    && c.programmeCreative?.approved===false && c.dialogue.speech.includes("can't agree")),
    "refused Programme proposal was not displayed as a factual wrestler reply");
  const status=after.programmeCreativeOptions.find(o=>o.programmeId===programmeId && o.wrestlerId===personId);
  ok(status?.previousDecision==="DECLINED","declined terms remained negotiable");
  await repository.transact(worldId,null,current=>{lockWorldForResolution(current.runtime,current.state);});
  let rejected=false;
  try{await discussAlphaBackstageProgrammeCreative(repository,worldId,"owner",{
    ...request,requestId:"new-locked-programme",termWeeks:3,
  });}catch{rejected=true;}
  ok(rejected,"World Lock allowed a new wrestler negotiation");
});

console.log("\nWeb Backstage service tests: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;

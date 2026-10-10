declare const process: { exitCode?: number };
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { openBackstageConversation } from "../packages/application/src/engagement.js";
import { createAlphaWorldAggregate, claimAlphaPromotion, loadAlphaPlayerSession } from "../packages/web-adapter/src/alpha-service.js";
import { loadAlphaBackstage, respondAlphaBackstage } from "../packages/web-adapter/src/backstage-service.js";

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
console.log("\nWeb Backstage service tests: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;

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
console.log("\nWeb Backstage service tests: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;

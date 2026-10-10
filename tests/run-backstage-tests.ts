declare const process: { exitCode?: number };
import {
  buildPlayerAttention,
  BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION,
  BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK,
  buildPlayerBackstageView,
  cloneApplicationWorld,
  createPersistedApplicationWorld,
  generateBackstageConversations,
  respondBackstageConversationCommand,
} from "../packages/application/src/index.js";
import { addPpwWeeks } from "../packages/sim-core/src/clock.js";
import { openBackstageConversation } from "../packages/application/src/engagement.js";
import { activeContractsForPromotion } from "../packages/sim-core/src/index.js";
import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { claimIndependentPromotionForPlayer } from "../packages/application/src/ownership.js";
import type { Match, WrestlingEvent } from "../packages/domain/src/types.js";

let passed = 0; let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + String(error)); }
}
function ok(value: unknown, msg: string): void { if (!value) throw Error(msg); }

function fixture() {
  const aggregate = createAlphaWorldAggregate({seed: 9213, playerId: "backstage-owner"});
  const state = aggregate.state;
  const promotion = state.promotions.find((p) => p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
  if (!promotion) throw Error("missing Indie promotion");
  claimIndependentPromotionForPlayer(state, aggregate.ownership, "backstage-owner", promotion.id);
  const contract = activeContractsForPromotion(state, promotion.id)[0];
  if (!contract) throw Error("missing active roster");
  const person = state.people.find((p) => p.id === contract.personId)!;
  const start = { ...state.world.currentDate };
  contract.roleExpectation = "MAIN_EVENT";
  contract.startDate = start;
  contract.endDate = addPpwWeeks(start, 30, state.ruleset.weeksPerYear);
  contract.dateEntitlement = 12;
  contract.datesUsed = 4;
  const venue = state.venues.find((v) => v.marketId === promotion.homeMarketId) ?? state.venues[0]!;
  const otherPeople = state.people.filter((p) => p.id !== person.id).slice(0, 5);
  state.world.currentDate = addPpwWeeks(start, 6, state.ruleset.weeksPerYear);
  for (let k = 1; k <= 4; k++) {
    const date = addPpwWeeks(start, k, state.ruleset.weeksPerYear);
    const event: WrestlingEvent = {
      id: "backstage-show-" + k, worldId: state.world.id, promotionId: promotion.id,
      marketId: promotion.homeMarketId, venueId: venue.id, date,
      type: "REGULAR", status: "COMPLETED", ticketStrategy: "STANDARD",
      expectedDemand: 100, attendance: 100, ticketYield: 20, gateRevenue: 2000,
      totalCost: 1000, netResult: 1000, eventImportance: 50, matchCount: 3,
      averageMatchRating: 3, bestMatchRating: 3.5, crowdResponse: 60,
    };
    state.events.push(event);
    state.scheduledAppearances.push({
      id: "backstage-appearance-" + k, worldId: state.world.id, eventId: event.id,
      promotionId: promotion.id, personId: person.id, contractId: contract.id,
      date, serviceCapacityAtBooking: 1, status: "COMPLETED",
    });
    for (let n = 1; n <= 3; n++) {
      const match: Match = {
        id: event.id + "-match-" + n, worldId: state.world.id, eventId: event.id,
        promotionId: promotion.id, order: n, type: "SINGLES", status: "COMPLETED",
        intent: "COMPETITIVE", plannedLengthMinutes: 10, actualLengthMinutes: 10,
        intendedWinnerSide: "A", actualWinnerSide: "A", finishChangedDueToInjury: false,
        executionQuality: 50, criticalRatingStars: 3, crowdResponse: 50,
      };
      state.matches.push(match);
      state.matchParticipants.push({
        id: match.id + "-participant", worldId: state.world.id, matchId: match.id,
        eventId: event.id, personId: n === 1 ? person.id : otherPeople[n]!.id,
        side: "A", won: true,
      });
    }
  }
  return { aggregate, contract, promotion, person };
}

test("A clear contractual booking mismatch creates one optional private Backstage concern", () => {
  const f = fixture();
  const {aggregate, contract, promotion, person}=f;
  const initialWorld = JSON.stringify(aggregate.state);
  ok(generateBackstageConversations(aggregate) === 1, "first concern not created");
  ok(generateBackstageConversations(aggregate) === 0, "duplicate conversation created on retry");
  ok(JSON.stringify(aggregate.state) === initialWorld, "conversation generation mutated simulation");
  const item=aggregate.engagement!.backstageConversations[0]!;
  ok(item.sourceContractId===contract.id && item.wrestlerId===person.id && item.observedMatchShows===4,
    "conversation did not preserve contract evidence");
  const attention=buildPlayerAttention(aggregate,"backstage-owner").find((x)=>x.attentionId==="backstage:"+item.conversationId);
  ok(attention?.deepLink==="/backstage" && attention.category==="IMPORTANT" && !attention.dismissible,
    "home alert missing or wrongly blocks world progress");
  const view=buildPlayerBackstageView(aggregate,"backstage-owner");
  ok(view.openCount===1 && view.conversations[0]?.wrestlerName===person.name,
    "Backstage read model lost request");
  const snapshot=createPersistedApplicationWorld(aggregate);
  const restored=cloneApplicationWorld(aggregate);
  ok(snapshot.engagement.backstageConversations.length===1
    && restored.engagement?.backstageConversations[0]?.conversationId===item.conversationId,
    "application snapshot/restore lost conversation");
  ok(aggregate.engagement!.backstageConversations[0]?.status==="OPEN" && promotion.id===item.promotionId,
    "conversation changed without player input");
});

test("Responses are idempotent, remain historic and do not change wrestler simulation", () => {
  const f=fixture(); const {aggregate}=f;
  generateBackstageConversations(aggregate);
  const item=aggregate.engagement!.backstageConversations[0]!;
  const before=JSON.stringify(aggregate.state);
  const command={
    requestId:"reply-once",worldId:aggregate.state.world.id,
    playerId:"backstage-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION" as const,
    payload:{conversationId:item.conversationId,response:"EXPLAIN_PLAN" as const},
  };
  const result=respondBackstageConversationCommand(aggregate,command);
  ok(result.status==="ANSWERED" && result.response==="EXPLAIN_PLAN","scripted response not stored");
  const revision=aggregate.runtime.revision;
  const replay=respondBackstageConversationCommand(aggregate,command);
  ok(replay.response===result.response && aggregate.runtime.revision===revision,"request idempotency failed");
  ok(JSON.stringify(aggregate.state)===before,"talking Backstage applied premature simulation consequences");
  ok(buildPlayerBackstageView(aggregate,"backstage-owner").openCount===0,"answered request remained open");
  ok(!buildPlayerAttention(aggregate,"backstage-owner").some(x=>x.attentionId.startsWith("backstage:")),
    "answered conversation remained on Home");
  let rejected=false;
  try {respondBackstageConversationCommand(aggregate,{...command,requestId:"different-id"});}
  catch {rejected=true;}
  ok(rejected,"same conversation answered twice by a new command");
  ok(generateBackstageConversations(aggregate)===0,"answered concern reopened automatically");
});

test("Nobody can answer another promotion's request or forge a response", () => {
  const f=fixture();const {aggregate}=f;
  generateBackstageConversations(aggregate);
  const item=aggregate.engagement!.backstageConversations[0]!;
  let denied=false;
  try {respondBackstageConversationCommand(aggregate,{
    requestId:"other-person",worldId:aggregate.state.world.id,playerId:"intruder",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:item.conversationId,response:"HEAR_OUT"},
  });}catch{denied=true;}
  ok(denied,"outsider answered a wrestler's concern");
  denied=false;
  try {respondBackstageConversationCommand(aggregate,{
    requestId:"invalid-response",worldId:aggregate.state.world.id,playerId:"backstage-owner",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:item.conversationId,response:"PROMISE_TITLE" as "HEAR_OUT"},
  });}catch{denied=true;}
  ok(denied,"unimplemented promise/response accepted");
  ok(item.status==="OPEN","unauthorized action changed backstage state");
});

test("A special-attraction/limited-date role alone never generates a booking complaint", () => {
  const f=fixture();
  f.contract.roleExpectation="SPECIAL_ATTRACTION";
  ok(generateBackstageConversations(f.aggregate)===0,"selective attraction penalised");
  f.contract.roleExpectation="MAIN_EVENT";
  f.aggregate.state.scheduledAppearances.length=0;
  ok(generateBackstageConversations(f.aggregate)===0,"unused finite dates generated grievance");
});


test("Backstage creates at most one new conversation per promotion per week, even after an immediate reply", () => {
  const f = fixture();
  const state = f.aggregate.state;
  const otherContract = activeContractsForPromotion(state, f.promotion.id)
    .find((contract) => contract.id !== f.contract.id);
  ok(otherContract, "fixture needs a second contracted wrestler");
  otherContract!.roleExpectation = "UPPER_CARD";
  otherContract!.startDate = { ...f.contract.startDate };
  otherContract!.endDate = { ...f.contract.endDate };
  otherContract!.dateEntitlement = 12;
  otherContract!.datesUsed = 4;
  for (let n = 1; n <= 4; n++) {
    const eventId = "backstage-show-" + n;
    const existing = state.scheduledAppearances.find((appearance) => appearance.eventId === eventId)!;
    state.scheduledAppearances.push({
      ...existing, id: "second-backstage-appearance-" + n,
      contractId: otherContract!.id, personId: otherContract!.personId,
    });
    state.matchParticipants.push({
      id: "second-backstage-participant-" + n, worldId: state.world.id,
      matchId: eventId + "-match-1", eventId, personId: otherContract!.personId,
      side: "B", won: false,
    });
  }
  ok(BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK === 1, "cap changed unexpectedly");
  ok(generateBackstageConversations(f.aggregate) === 1, "first weekly concern did not appear");
  const first = f.aggregate.engagement!.backstageConversations[0]!;
  const response = respondBackstageConversationCommand(f.aggregate, {
    requestId: "weekly-limit-reply",
    worldId: state.world.id,
    playerId: "backstage-owner",
    commandType: "RESPOND_BACKSTAGE_CONVERSATION",
    payload: { conversationId: first.conversationId, response: "HEAR_OUT" },
  });
  ok(response.status === "ANSWERED", "reply did not close first concern");
  ok(generateBackstageConversations(f.aggregate) === 0, "same-week retry created a second concern");
  state.world.currentDate = addPpwWeeks(state.world.currentDate, 1, state.ruleset.weeksPerYear);
  ok(generateBackstageConversations(f.aggregate) === 1, "second contract was lost after weekly limit");
  ok(generateBackstageConversations(f.aggregate) === 0, "repeat generation was not idempotent");
  ok(new Set(f.aggregate.engagement!.backstageConversations.map((x) => x.sourceContractId)).size === 2,
    "one wrestler's concern was repeated instead of selecting the next eligible contract");
});

test("A full unanswered Backstage inbox preserves further eligible concerns for another week", () => {
  const f = fixture();
  const engagement = f.aggregate.engagement!;
  ok(BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION === 3, "open conversation cap changed unexpectedly");
  for (let n = 0; n < BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION; n++) {
    const date = addPpwWeeks(f.aggregate.state.world.currentDate, -n - 1, f.aggregate.state.ruleset.weeksPerYear);
    openBackstageConversation(engagement, {
      conversationId: "old-backstage-concern-" + n,
      worldId: f.aggregate.state.world.id, promotionId: f.promotion.id,
      wrestlerId: "old-person-" + n, sourceContractId: "old-contract-" + n,
      kind: "ROLE_USAGE_CONCERN", createdDate: date,
      status: "OPEN", response: null, responseDate: null, promisedRole: "UPPER_CARD",
      observedMatchShows: 4, observedFeaturedShows: 0,
    });
  }
  ok(generateBackstageConversations(f.aggregate) === 0, "fourth unanswered concern was generated");
  ok(engagement.backstageConversations.length === BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION,
    "cap silently deleted existing conversations");
});

console.log("\nBackstage lifecycle tests: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;

declare const process: { exitCode?: number };
import {
  buildPlayerAttention,
  BACKSTAGE_MAX_UNANSWERED_PER_PROMOTION,
  BACKSTAGE_NEW_CONVERSATIONS_PER_PROMOTION_WEEK,
  buildPlayerBackstageView,
  cloneApplicationWorld,
  createPersistedApplicationWorld,
  generateBackstageConversations,
  evaluateBackstagePromises,
  applyBackstagePromiseConsequences,
  respondBackstageConversationCommand,
} from "../packages/application/src/index.js";
import { addPpwWeeks } from "../packages/sim-core/src/clock.js";
import { createWorldEngagementState, openBackstageConversation } from "../packages/application/src/engagement.js";
import { activeContractsForPromotion, upsertWrestlerRelationship } from "../packages/sim-core/src/index.js";
import { promotionTalentTrustFor } from "../packages/sim-core/src/talent-trust.js";
import { generateTagTeamPitches } from "../packages/application/src/backstage-pitches.js";
import { generateRivalryPitches } from "../packages/application/src/backstage-rivalries.js";
import { generateTeamMoments } from "../packages/application/src/backstage-moments.js";
import { generateGimmickChangePitches } from "../packages/application/src/backstage-gimmicks.js";
import { generateWorkingPartnershipConcerns } from "../packages/application/src/backstage-working-concerns.js";
import { WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE } from "../packages/application/src/working-relationship-evolution.js";
import { assessCreativeFollowThrough } from "../packages/application/src/backstage-follow-through.js";
import { createProgramme } from "../packages/sim-core/src/programmes.js";
import { chooseCreativePitchSpeaker, wrestlerCreativeInterestScores } from "../packages/application/src/wrestler-creative-interests.js";
import { buildBackstageDialogue } from "../packages/application/src/backstage-dialogue.js";
import { setWrestlerCreativeProfileCommand, defaultWrestlerCreativeFields } from "../packages/application/src/wrestler-creative.js";
import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { claimIndependentPromotionForPlayer, joinPlayerToWorld } from "../packages/application/src/ownership.js";
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
  f.aggregate.engagement = createWorldEngagementState(f.aggregate.state.world.id);
  const engagement = f.aggregate.engagement;
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


/** One synthetic completed show after a conversation, with the test wrestler
 * working a given part of the ordered card under an explicit contract date. */
function addFutureShow(
  f: ReturnType<typeof fixture>,
  id: string,
  weeksAhead: number,
  cardOrder: 1 | 2 | 3,
  usedContractId = f.contract.id,
): void {
  const state = f.aggregate.state;
  const date = addPpwWeeks(state.world.currentDate, weeksAhead, state.ruleset.weeksPerYear);
  const original = state.events.find((entry) => entry.id === "backstage-show-1")!;
  state.events.push({ ...original, id, date: { ...date }, status: "COMPLETED" });
  const originalAppearance = state.scheduledAppearances.find((entry) => entry.eventId === original.id)!;
  state.scheduledAppearances.push({
    ...originalAppearance, id: id + "-appearance", eventId: id,
    contractId: usedContractId, date: { ...date }, status: "COMPLETED",
  });
  const originalMatches = state.matches.filter((entry) => entry.eventId === original.id)
    .sort((a, b) => a.order - b.order);
  for (let n = 1; n <= 3; n++) {
    const oldMatch = originalMatches[n - 1]!;
    const newMatch = { ...oldMatch, id: id + "-match-" + n, eventId: id, order: n, status: "COMPLETED" as const };
    state.matches.push(newMatch);
    if (n === cardOrder) state.matchParticipants.push({
      id: id + "-participant",
      worldId: state.world.id, matchId: newMatch.id, eventId: id,
      personId: f.person.id, side: "A", won: true,
    });
  }
}

test("A deliberate promise is persistent, has a bounded deadline and is fulfilled by the promised match position", () => {
  const f = fixture();
  ok(generateBackstageConversations(f.aggregate) === 1, "no conversation for promise");
  const item = f.aggregate.engagement!.backstageConversations[0]!;
  ok(buildPlayerBackstageView(f.aggregate, "backstage-owner").conversations[0]?.canPromiseFeaturedBooking,
    "booker was not offered an eligible promise");
  const start = { ...f.aggregate.state.world.currentDate };
  const initialWorld = JSON.stringify(f.aggregate.state);
  const command = {
    requestId: "promise-match", worldId: f.aggregate.state.world.id,
    playerId: "backstage-owner", commandType: "RESPOND_BACKSTAGE_CONVERSATION" as const,
    payload: { conversationId: item.conversationId, response: "PROMISE_FEATURED_BOOKING" as const },
  };
  const created = respondBackstageConversationCommand(f.aggregate, command);
  ok(created.promise?.status === "PENDING" && created.promise.kind === "FEATURED_MATCH",
    "no explicit tracked promise");
  ok(created.promise?.dueDate.week === addPpwWeeks(start, 4, f.aggregate.state.ruleset.weeksPerYear).week,
    "promise did not specify the four-week deadline");
  ok(created.promise?.dueDate.day === 7, "promise excluded later show days in deadline week");
  const replay = respondBackstageConversationCommand(f.aggregate, command);
  ok(replay.promise?.status === "PENDING", "idempotent replay mutated promise");
  ok(JSON.stringify(f.aggregate.state) === initialWorld, "making a promise changed match, morale or trust state");
  const persisted = cloneApplicationWorld(f.aggregate);
  ok(persisted.engagement?.backstageConversations[0]?.promise?.status === "PENDING",
    "promise was lost on persistence restore");

  // A completed match on Friday of the deadline week must still count.
  addFutureShow(f, "promised-featured-show", 4, 3);
  f.aggregate.state.events.find((event) => event.id === "promised-featured-show")!.date.day = 5;
  f.aggregate.state.scheduledAppearances.find((entry) => entry.eventId === "promised-featured-show")!.date.day = 5;
  f.aggregate.state.world.currentDate = addPpwWeeks(start, 5, f.aggregate.state.ruleset.weeksPerYear);
  const beforeEvaluation = JSON.stringify(f.aggregate.state);
  ok(evaluateBackstagePromises(f.aggregate) === 1, "promised main event not recognised");
  const currentPromise = f.aggregate.engagement?.backstageConversations.find(
    (conversation) => conversation.conversationId === item.conversationId,
  )?.promise;
  ok(currentPromise?.status === "FULFILLED" && currentPromise.fulfilledEventId === "promised-featured-show",
    "actual qualifying show was not attached to fulfilled promise");
  ok(evaluateBackstagePromises(f.aggregate) === 0, "promise evaluation repeated");
  ok(JSON.stringify(f.aggregate.state) === beforeEvaluation, "promise completion changed wrestler simulation");
  const followUp = buildPlayerAttention(f.aggregate, "backstage-owner")
    .find((entry) => entry.attentionId === "backstage-promise:" + item.conversationId + ":FULFILLED");
  ok(followUp?.dismissible && followUp.deepLink === "/backstage", "fulfilled promise did not reach Home");
});

test("Main-event promises cannot be fulfilled by undercard, angle-only or another contract", () => {
  const f = fixture();
  generateBackstageConversations(f.aggregate);
  const item = f.aggregate.engagement!.backstageConversations[0]!;
  const now = { ...f.aggregate.state.world.currentDate };
  respondBackstageConversationCommand(f.aggregate, {
    requestId: "promise-underplayed", worldId: f.aggregate.state.world.id,
    playerId: "backstage-owner", commandType: "RESPOND_BACKSTAGE_CONVERSATION",
    payload: { conversationId: item.conversationId, response: "PROMISE_FEATURED_BOOKING" },
  });
  addFutureShow(f, "undercard-only", 1, 1);
  addFutureShow(f, "wrong-deal-main-event", 2, 3, "some-other-contract");
  f.aggregate.state.world.currentDate = addPpwWeeks(now, 5, f.aggregate.state.ruleset.weeksPerYear);
  const before = JSON.stringify(f.aggregate.state);
  ok(evaluateBackstagePromises(f.aggregate) === 1, "elapsed promise was not assessed");
  ok(item.promise?.status === "NOT_DELIVERED" && item.promise.fulfilledEventId === null,
    "an undercard or another deal wrongly satisfied a promised main event");
  ok(evaluateBackstagePromises(f.aggregate) === 0, "failed promise not idempotent");
  ok(JSON.stringify(f.aggregate.state) === before, "missed promise automatically punished sim state");
});

test("No completed promotion show is recorded as no opportunity, not a punitive breach", () => {
  const f = fixture();
  generateBackstageConversations(f.aggregate);
  const item = f.aggregate.engagement!.backstageConversations[0]!;
  const now = { ...f.aggregate.state.world.currentDate };
  respondBackstageConversationCommand(f.aggregate, {
    requestId: "no-show-promise", worldId: f.aggregate.state.world.id,
    playerId: "backstage-owner", commandType: "RESPOND_BACKSTAGE_CONVERSATION",
    payload: { conversationId: item.conversationId, response: "PROMISE_FEATURED_BOOKING" },
  });
  f.aggregate.state.world.currentDate = addPpwWeeks(now, 5, f.aggregate.state.ruleset.weeksPerYear);
  ok(evaluateBackstagePromises(f.aggregate) === 1, "unavailable-window promise remained pending");
  ok(item.promise?.status === "NO_OPPORTUNITY", "no completed show was misreported as a broken promise");
});

test("An expired or out-of-dates contract cannot be used to forge a booking promise", () => {
  const f = fixture();
  generateBackstageConversations(f.aggregate);
  const item = f.aggregate.engagement!.backstageConversations[0]!;
  f.contract.datesUsed = f.contract.dateEntitlement;
  ok(!buildPlayerBackstageView(f.aggregate, "backstage-owner").conversations[0]?.canPromiseFeaturedBooking,
    "out-of-dates contract still offers a promise");
  let rejected = false;
  try {
    respondBackstageConversationCommand(f.aggregate, {
      requestId: "invalid-promise", worldId: f.aggregate.state.world.id,
      playerId: "backstage-owner", commandType: "RESPOND_BACKSTAGE_CONVERSATION",
      payload: { conversationId: item.conversationId, response: "PROMISE_FEATURED_BOOKING" },
    });
  } catch { rejected = true; }
  ok(rejected && item.status === "OPEN" && item.promise === null,
    "unfulfillable booking promise was accepted");
});


function bookerPromise(f: ReturnType<typeof fixture>, requestId: string): string {
  generateBackstageConversations(f.aggregate);
  const id = f.aggregate.engagement!.backstageConversations[0]!.conversationId;
  respondBackstageConversationCommand(f.aggregate, {
    requestId, worldId: f.aggregate.state.world.id, playerId: "backstage-owner",
    commandType: "RESPOND_BACKSTAGE_CONVERSATION",
    payload: { conversationId: id, response: "PROMISE_FEATURED_BOOKING" },
  });
  return id;
}

test("An unexcused broken player promise changes trust without double-counting weekly morale", () => {
  const f = fixture();
  const id = bookerPromise(f, "accountability-miss");
  const state = f.aggregate.state;
  const beforeMorale = f.person.morale;
  const pair = promotionTalentTrustFor(state, f.promotion.id, f.person.id);
  const beforeTrust = pair.trust;
  const start = { ...state.world.currentDate };
  addFutureShow(f, "late-undercard", 1, 1);
  state.world.currentDate = addPpwWeeks(start, 5, state.ruleset.weeksPerYear);
  ok(evaluateBackstagePromises(f.aggregate) === 1, "missed promise did not reach deadline");
  ok(applyBackstagePromiseConsequences(f.aggregate) === 1, "missed promise was not assessed");
  const promise = f.aggregate.engagement!.backstageConversations.find((c) => c.conversationId === id)!.promise!;
  ok(promise.status === "NOT_DELIVERED" && promise.consequence?.reason === "COMMITMENT_BROKEN",
    "booker's undelivered promise was incorrectly excused");
  ok(pair.trust < beforeTrust && beforeTrust - pair.trust >= 2 && beforeTrust - pair.trust <= 4,
    "broken word did not have a small relationship-specific cost");
  ok(f.person.morale === beforeMorale, "broken word was double-counted in weekly morale");
  ok(promise.consequence?.trustDelta === pair.trust - beforeTrust && promise.consequence?.moraleDelta === 0,
    "actual penalty details were not preserved");
  const worldAfter = JSON.stringify(state);
  ok(applyBackstagePromiseConsequences(f.aggregate) === 0 && JSON.stringify(state) === worldAfter,
    "repeat consequence pass stacked the penalty");
  const saved = cloneApplicationWorld(f.aggregate);
  ok(saved.engagement?.backstageConversations.find((c) => c.conversationId === id)?.promise?.consequence?.reason
    === "COMMITMENT_BROKEN", "accountability decision was not persisted");
});

test("Delivering a deliberately promised match records it without granting simulation power", () => {
  const f = fixture();
  const id = bookerPromise(f, "accountability-keep");
  const state = f.aggregate.state;
  const start = { ...state.world.currentDate };
  const pair = promotionTalentTrustFor(state, f.promotion.id, f.person.id);
  const trust = pair.trust, morale = f.person.morale;
  addFutureShow(f, "kept-promise-event", 2, 3);
  state.world.currentDate = addPpwWeeks(start, 3, state.ruleset.weeksPerYear);
  ok(evaluateBackstagePromises(f.aggregate) === 1, "kept promise did not resolve");
  ok(applyBackstagePromiseConsequences(f.aggregate) === 1, "kept promise was not assessed");
  const promise = f.aggregate.engagement!.backstageConversations.find((c) => c.conversationId === id)!.promise!;
  ok(promise.consequence?.reason === "COMMITMENT_KEPT" && promise.consequence.trustDelta === 0
    && promise.consequence.moraleDelta === 0, "keeping your word granted hidden account-activity boosts");
  ok(pair.trust === trust && f.person.morale === morale, "kept promise unexpectedly changed sim strength");
});

test("A real injury in the promise window excuses a miss, with zero morale/trust penalties", () => {
  const f = fixture();
  const id = bookerPromise(f, "injury-promise");
  const state = f.aggregate.state;
  const start = { ...state.world.currentDate };
  const pair = promotionTalentTrustFor(state, f.promotion.id, f.person.id);
  const trust = pair.trust, morale = f.person.morale;
  addFutureShow(f, "injured-undercard", 1, 1);
  const injuryDate = addPpwWeeks(start, 2, state.ruleset.weeksPerYear);
  state.injuries.push({
    id: "documented-backstage-injury", worldId: state.world.id, personId: f.person.id,
    matchId: "historical-match", eventId: "historical-event", date: injuryDate,
    severity: "MODERATE", weeksOut: 2, weeksRemaining: 0, status: "RECOVERED",
  });
  state.world.currentDate = addPpwWeeks(start, 5, state.ruleset.weeksPerYear);
  ok(evaluateBackstagePromises(f.aggregate) === 1, "injured promise was not evaluated");
  ok(applyBackstagePromiseConsequences(f.aggregate) === 1, "injured promise was not assessed");
  const promise = f.aggregate.engagement!.backstageConversations.find((c) => c.conversationId === id)!.promise!;
  ok(promise.status === "EXCUSED" && promise.consequence?.reason === "WRESTLER_INJURED",
    "injury was incorrectly blamed on the booker");
  ok(pair.trust === trust && f.person.morale === morale, "injury incurred a hidden penalty");
  ok(buildPlayerAttention(f.aggregate, "backstage-owner").some((entry) =>
    entry.title.includes("excused") && entry.summary.includes("Injury")),
    "the Home alert failed to explain the exemption");
});

test("Terminated contract and AI stewardship are not treated as booker failures", () => {
  for (const kind of ["CONTRACT", "STEWARDSHIP"] as const) {
    const f = fixture();
    const id = bookerPromise(f, "external-excuse-" + kind);
    const state = f.aggregate.state;
    const pair = promotionTalentTrustFor(state, f.promotion.id, f.person.id);
    const trust = pair.trust, morale = f.person.morale;
    const start = { ...state.world.currentDate };
    addFutureShow(f, "outside-booking-" + kind, 1, 1);
    if (kind === "CONTRACT") f.contract.status = "TERMINATED";
    else {
      f.aggregate.engagement!.playerActivity.push({
        playerId: "backstage-owner", lastActivePpwDate: { ...start },
        lastActiveRevision: 0, lastActiveCycleKey: null, status: "STEWARDED",
        statusSinceCycleKey: null,
      });
    }
    state.world.currentDate = addPpwWeeks(start, 5, state.ruleset.weeksPerYear);
    evaluateBackstagePromises(f.aggregate);
    applyBackstagePromiseConsequences(f.aggregate);
    const promise = f.aggregate.engagement!.backstageConversations.find((c) => c.conversationId === id)!.promise!;
    const expected = kind === "CONTRACT" ? "CONTRACT_TERMINATED" : "OWNER_STEWARDED";
    ok(promise.status === "EXCUSED" && promise.consequence?.reason === expected,
      "an external interruption was reported as deliberate booking negligence");
    ok(pair.trust === trust && f.person.morale === morale, "external interruption changed trust or morale");
  }
});

test("An unanswered concern and a conversation without an explicit promise have no consequences", () => {
  const f = fixture();
  generateBackstageConversations(f.aggregate);
  const state = f.aggregate.state;
  const pair = promotionTalentTrustFor(state, f.promotion.id, f.person.id);
  const before = JSON.stringify(state);
  ok(applyBackstagePromiseConsequences(f.aggregate) === 0, "unanswered concern altered wrestler");
  const id = f.aggregate.engagement!.backstageConversations[0]!.conversationId;
  respondBackstageConversationCommand(f.aggregate, {
    requestId: "no-hidden-consequence", worldId: state.world.id,
    playerId: "backstage-owner", commandType: "RESPOND_BACKSTAGE_CONVERSATION",
    payload: { conversationId: id, response: "STAND_FIRM" },
  });
  ok(applyBackstagePromiseConsequences(f.aggregate) === 0 && JSON.stringify(state) === before,
    "a plain conversation generated a penalty or bonus");
  ok(pair.promotionId === f.promotion.id, "test trust context shifted unexpectedly");
});


/** Add two actual resolved good tag performances, not fictitious relationship rolls. */
function successfulTagPair(f: ReturnType<typeof fixture>, crowd = 78): string {
  const state = f.aggregate.state;
  const partnerContract = activeContractsForPromotion(state, f.promotion.id)
    .find((contract) => contract.personId !== f.person.id);
  if (!partnerContract) throw Error("need two contracted wrestlers for pitch");
  partnerContract.startDate = { ...f.contract.startDate };
  partnerContract.endDate = { ...f.contract.endDate };
  partnerContract.dateEntitlement = 12;
  partnerContract.datesUsed = 2;
  for (let i = 1; i <= 2; i++) {
    const eventId = "backstage-show-" + i;
    const match = state.matches.find((entry) => entry.eventId === eventId && entry.order === 1)!;
    match.type = "TAG";
    match.crowdResponse = crowd;
    const originalAppearance = state.scheduledAppearances.find((appearance) => (
      appearance.eventId === eventId && appearance.personId === f.person.id
    ))!;
    state.scheduledAppearances.push({
      ...originalAppearance, id: "tag-partner-appearance-" + i,
      personId: partnerContract.personId, contractId: partnerContract.id,
    });
    state.matchParticipants.push({
      id: "tag-pitch-partner-" + i, worldId: state.world.id,
      eventId, matchId: match.id, personId: partnerContract.personId, side: "A", won: true,
    });
  }
  return partnerContract.personId;
}

test("Successful real tag matches generate an optional positive pitch with a named partner", () => {
  const f = fixture();
  f.contract.roleExpectation = "REGULAR";
  const partnerId = successfulTagPair(f);
  const before = JSON.stringify(f.aggregate.state);
  ok(generateTagTeamPitches(f.aggregate) === 1, "tag team success did not produce a pitch");
  ok(generateTagTeamPitches(f.aggregate) === 0, "same pitch generated twice");
  ok(JSON.stringify(f.aggregate.state) === before, "pitch mutated in-ring results or contracts");
  const message = f.aggregate.engagement!.backstageConversations[0]!;
  ok(message.kind === "TAG_TEAM_PITCH"
    && [message.wrestlerId,message.partnerPersonId].sort().join("|") === [f.person.id,partnerId].sort().join("|")
    && message.sourceContractId === activeContractsForPromotion(f.aggregate.state,f.promotion.id)
      .find(contract=>contract.personId===message.wrestlerId)?.id
    && message.sharedTagMatches === 2 && message.averageCrowdResponse === 78,
    "positive pitch lacks evidence or correct partner");
  const view = buildPlayerBackstageView(f.aggregate, "backstage-owner");
  ok(view.openCount === 1 && view.conversations[0]?.partnerPersonId === message.partnerPersonId
    && !!view.conversations[0]?.partnerName && !view.conversations[0]?.canPromiseFeaturedBooking,
    "Backstage pitch incorrectly exposes role-promise options or partner");
  const alert = buildPlayerAttention(f.aggregate, "backstage-owner")
    .find((item) => item.attentionId === "backstage:" + message.conversationId);
  ok(alert?.deepLink === "/backstage" && alert.title.includes("tag-team idea")
    && alert.category === "IMPORTANT", "positive pitch did not appear on Home");
  const saved = cloneApplicationWorld(f.aggregate);
  ok(saved.engagement?.backstageConversations[0]?.partnerPersonId === partnerId,
    "positive pitch was not persistently saved");
  const originalState = JSON.stringify(f.aggregate.state);
  const teamsBefore = JSON.stringify(f.aggregate.state.teams);
  const response = {
    requestId: "consider-pairing", worldId: f.aggregate.state.world.id, playerId: "backstage-owner",
    commandType: "RESPOND_BACKSTAGE_CONVERSATION" as const,
    payload: { conversationId: message.conversationId, response: "CONSIDER_TAG_TEAM" as const },
  };
  const result = respondBackstageConversationCommand(f.aggregate, response);
  ok(result.status === "ANSWERED" && result.response === "CONSIDER_TAG_TEAM", "player choice was not recorded");
  ok(respondBackstageConversationCommand(f.aggregate, response).status === "ANSWERED", "idempotent pitch reply failed");
  ok(buildPlayerBackstageView(f.aggregate, "backstage-owner").openCount === 0, "answered pitch remained open");
  ok(JSON.stringify(f.aggregate.state) === originalState && JSON.stringify(f.aggregate.state.teams) === teamsBefore,
    "considering a pitch created a tag team or changed simulated strengths");
  ok(generateTagTeamPitches(f.aggregate) === 0, "answered pitch reopened without new evidence");
});

test("Pitch reply type is protected; bookers cannot disguise a creative pitch as a promise", () => {
  const f = fixture();
  f.contract.roleExpectation = "REGULAR";
  successfulTagPair(f);
  generateTagTeamPitches(f.aggregate);
  const id = f.aggregate.engagement!.backstageConversations[0]!.conversationId;
  for (const response of ["HEAR_OUT", "PROMISE_FEATURED_BOOKING"] as const) {
    let rejected = false;
    try {
      respondBackstageConversationCommand(f.aggregate, {
        requestId: "invalid-pitch-choice-" + response,
        worldId: f.aggregate.state.world.id, playerId: "backstage-owner",
        commandType: "RESPOND_BACKSTAGE_CONVERSATION",
        payload: { conversationId: id, response },
      });
    } catch { rejected = true; }
    ok(rejected, "a role-usage reply was accepted for a tag-team idea");
  }
  let outsiderRejected = false;
  try {
    respondBackstageConversationCommand(f.aggregate, {
      requestId: "intruder-pitch", worldId: f.aggregate.state.world.id,
      playerId: "intruder", commandType: "RESPOND_BACKSTAGE_CONVERSATION",
      payload: { conversationId: id, response: "PASS_TAG_TEAM" },
    });
  } catch { outsiderRejected = true; }
  ok(outsiderRejected && f.aggregate.engagement?.backstageConversations[0]?.status === "OPEN",
    "another player responded to a private creative pitch");
});

test("Weak, one-off or already established teams do not flood Backstage pitches", () => {
  const onlyOne = fixture();
  onlyOne.contract.roleExpectation = "REGULAR";
  const partner = successfulTagPair(onlyOne);
  const second = onlyOne.aggregate.state.matches.find((entry) => entry.id === "backstage-show-2-match-1")!;
  second.type = "SINGLES";
  ok(generateTagTeamPitches(onlyOne.aggregate) === 0, "one successful tag match was enough to pitch");

  const weak = fixture();
  weak.contract.roleExpectation = "REGULAR";
  successfulTagPair(weak, 42);
  ok(generateTagTeamPitches(weak.aggregate) === 0, "poorly received pairing was pitched as successful");

  second.type = "TAG";
  const state = onlyOne.aggregate.state;
  const teamId = "established-pitch-pair";
  state.teams ??= [];
  state.teamMemberships ??= [];
  state.teams.push({
    id: teamId, worldId: state.world.id, name: "Already a Team",
    status: "ACTIVE", formedDate: { ...state.world.currentDate }, disbandedDate: null,
  });
  for (const personId of [onlyOne.person.id, partner]) {
    state.teamMemberships.push({
      id: "pitch-team-member-" + personId, worldId: state.world.id,
      teamId, personId, joinedDate: { ...state.world.currentDate }, leftDate: null, active: true,
    });
  }
  ok(generateTagTeamPitches(onlyOne.aggregate) === 0, "established team generated redundant pitch");
});


test("A tag pitch requires actual completed contract-specific dates for both wrestlers", () => {
  const f = fixture();
  f.contract.roleExpectation = "REGULAR";
  successfulTagPair(f);
  f.aggregate.state.scheduledAppearances = f.aggregate.state.scheduledAppearances.filter(
    (appearance) => !appearance.id.startsWith("tag-partner-appearance-"),
  );
  ok(generateTagTeamPitches(f.aggregate) === 0,
    "in-ring participant record without a completed contractual appearance produced a pitch");
});

test("Complaints and creative pitches share the same strict per-promotion weekly budget", () => {
  const f = fixture();
  successfulTagPair(f);
  ok(generateBackstageConversations(f.aggregate) === 1, "expected existing booking concern");
  ok(generateTagTeamPitches(f.aggregate) === 0, "pitch bypassed the weekly cap");
  f.aggregate.state.world.currentDate = addPpwWeeks(
    f.aggregate.state.world.currentDate, 1, f.aggregate.state.ruleset.weeksPerYear,
  );
  ok(generateTagTeamPitches(f.aggregate) === 1, "positive pitch was not deferred to next PPW week");
  ok(f.aggregate.engagement?.backstageConversations.length === 2, "pitch overwrote original concern");
});


function strongSinglesWorkingPair(f: ReturnType<typeof fixture>, crowd = 82, trust = 78): string {
  const state = f.aggregate.state;
  const secondContract = activeContractsForPromotion(state, f.promotion.id)
    .find((contract) => contract.personId !== f.person.id);
  if (!secondContract) throw Error("no second contracted wrestler for singles chemistry");
  f.contract.roleExpectation = "REGULAR";
  secondContract.roleExpectation = "REGULAR";
  secondContract.startDate = { ...f.contract.startDate };
  secondContract.endDate = { ...f.contract.endDate };
  secondContract.dateEntitlement = 12;
  secondContract.datesUsed = 2;
  const partner = state.people.find((person) => person.id === secondContract.personId)!;
  partner.status = "ACTIVE";
  f.person.status = "ACTIVE";
  for (let n = 1; n <= 2; n++) {
    const eventId = "backstage-show-" + n;
    const match = state.matches.find((entry) => entry.eventId === eventId && entry.order === 1)!;
    match.type = "SINGLES";
    match.crowdResponse = crowd;
    const appearance = state.scheduledAppearances.find((entry) => entry.eventId === eventId)!;
    state.scheduledAppearances.push({
      ...appearance, id: "rivalry-appearance-" + n,
      personId: partner.id, contractId: secondContract.id,
    });
    state.matchParticipants.push({
      id: "rivalry-opponent-" + n, worldId: state.world.id,
      eventId, matchId: match.id, personId: partner.id, side: "B", won: false,
    });
  }
  state.wrestlerRelationships ??= [];
  const relationship = state.wrestlerRelationships.find((entry) =>
    [entry.personAId, entry.personBId].includes(f.person.id)
      && [entry.personAId, entry.personBId].includes(partner.id)
  );
  if (relationship) relationship.professionalTrust = trust;
  else state.wrestlerRelationships.push({
    id: "working-rivalry-relationship", worldId: state.world.id,
    personAId: f.person.id, personBId: partner.id,
    affinity: 50, professionalTrust: trust, rivalryHeat: 40,
    familiarity: 20, tags: [],
  });
  return partner.id;
}

test("Professionally trusted opponents suggest a scripted rivalry after two hot singles matches", () => {
  const f = fixture();
  const opponentId = strongSinglesWorkingPair(f);
  const before = JSON.stringify(f.aggregate.state);
  ok(generateRivalryPitches(f.aggregate) === 1, "eligible working pair did not pitch a rivalry");
  ok(generateRivalryPitches(f.aggregate) === 0, "duplicate rivalry pitch was created");
  ok(JSON.stringify(f.aggregate.state) === before, "rivalry pitch changed world simulation");
  const message = f.aggregate.engagement!.backstageConversations[0]!;
  ok(message.kind === "RIVALRY_PITCH"
    && [message.wrestlerId,message.rivalPersonId].sort().join("|") === [f.person.id,opponentId].sort().join("|")
    && message.sourceContractId === activeContractsForPromotion(f.aggregate.state,f.promotion.id)
      .find(contract=>contract.personId===message.wrestlerId)?.id
    && message.sharedSinglesMatches === 2 && message.averageCrowdResponse === 82
    && message.professionalTrustAtPitch === 78, "rivalry proposal lost frozen evidence");
  const view = buildPlayerBackstageView(f.aggregate, "backstage-owner");
  ok(view.conversations[0]?.rivalPersonId === message.rivalPersonId && !!view.conversations[0]?.rivalName
    && view.conversations[0]?.professionalTrustAtPitch === 78
    && !view.conversations[0]?.canPromiseFeaturedBooking, "rivalry view exposed incorrect choice/context");
  const alert = buildPlayerAttention(f.aggregate, "backstage-owner")
    .find((item) => item.attentionId === "backstage:" + message.conversationId);
  ok(alert?.category === "IMPORTANT" && alert.title.includes("on-screen rivalry")
    && alert.deepLink === "/backstage", "Home did not link to private rivalry suggestion");
  const snapshot = cloneApplicationWorld(f.aggregate);
  ok(snapshot.engagement?.backstageConversations[0]?.rivalPersonId === opponentId,
    "rivalry proposal did not persist");
  const command = {
    requestId: "creative-rivalry-accept", worldId: f.aggregate.state.world.id,
    playerId: "backstage-owner", commandType: "RESPOND_BACKSTAGE_CONVERSATION" as const,
    payload: { conversationId: message.conversationId, response: "CONSIDER_RIVALRY" as const },
  };
  const result = respondBackstageConversationCommand(f.aggregate, command);
  ok(result.status === "ANSWERED" && result.response === "CONSIDER_RIVALRY",
    "booker's decision was not recorded");
  ok(respondBackstageConversationCommand(f.aggregate, command).status === "ANSWERED", "reply replay failed");
  ok(buildPlayerBackstageView(f.aggregate,"backstage-owner").openCount === 0,
    "answered rivalry still awaiting response");
  ok(JSON.stringify(f.aggregate.state) === before, "reply scripted a feud, changed relationship or created sim power");
  ok(generateRivalryPitches(f.aggregate) === 0, "answered rivalry was reopened");
});

test("No fabricated rivalry from one match, weak crowd or low professional trust", () => {
  for (const reason of ["ONE_MATCH","CROWD","TRUST","APPEARANCE"] as const) {
    const f = fixture();
    strongSinglesWorkingPair(f,
      reason === "CROWD" ? 55 : 82,
      reason === "TRUST" ? 40 : 78,
    );
    if (reason === "ONE_MATCH") {
      f.aggregate.state.matches.find((m) => m.id === "backstage-show-2-match-1")!.status = "CANCELLED";
    }
    if (reason === "APPEARANCE") {
      f.aggregate.state.scheduledAppearances = f.aggregate.state.scheduledAppearances.filter(
        (entry) => !entry.id.startsWith("rivalry-appearance-"),
      );
    }
    ok(generateRivalryPitches(f.aggregate) === 0, "invalid evidence generated rivalry: " + reason);
  }
});

test("An already active scripted Programme suppresses a redundant rivalry suggestion", () => {
  const f = fixture();
  const rival = strongSinglesWorkingPair(f);
  f.aggregate.state.programmes ??= [];
  f.aggregate.state.programmes.push({
    id: "already-booked-rivalry",worldId:f.aggregate.state.world.id,promotionId:f.promotion.id,
    status:"ACTIVE",sideA:[{kind:"PERSON",entityId:f.person.id}],sideB:[{kind:"PERSON",entityId:rival}],
    championshipId:null,startedDate:{...f.aggregate.state.world.currentDate},endedDate:null,
    heat:50,repetition:0,activityCount:0,matchCount:0,segmentCount:0,sideAWins:0,sideBWins:0,
    draws:0,lastActivityDate:null,
  });
  ok(generateRivalryPitches(f.aggregate) === 0, "live rivalry was pitched a second time");
});

test("Only the controlling booker may consider or refuse a proposed rivalry", () => {
  const f = fixture();
  strongSinglesWorkingPair(f);
  generateRivalryPitches(f.aggregate);
  const id = f.aggregate.engagement!.backstageConversations[0]!.conversationId;
  for (const choice of [
    { playerId: "intruder", response: "CONSIDER_RIVALRY" },
    { playerId: "backstage-owner", response: "PROMISE_FEATURED_BOOKING" },
    { playerId: "backstage-owner", response: "CONSIDER_TAG_TEAM" },
  ] as const) {
    let denied = false;
    try {
      respondBackstageConversationCommand(f.aggregate, {
        requestId: "deny-rivalry-" + choice.playerId + choice.response,
        worldId: f.aggregate.state.world.id, playerId: choice.playerId,
        commandType: "RESPOND_BACKSTAGE_CONVERSATION",
        payload: { conversationId: id, response: choice.response },
      });
    } catch { denied = true; }
    ok(denied, "wrong player or type was accepted: " + choice.response);
  }
  const before = JSON.stringify(f.aggregate.state);
  const reply = respondBackstageConversationCommand(f.aggregate, {
    requestId: "rivalry-pass", worldId: f.aggregate.state.world.id,
    playerId: "backstage-owner", commandType: "RESPOND_BACKSTAGE_CONVERSATION",
    payload: { conversationId: id, response: "PASS_RIVALRY" },
  });
  ok(reply.response === "PASS_RIVALRY" && JSON.stringify(f.aggregate.state) === before,
    "passing a creative pitch modified gameplay state");
});

test("Rivalry pitches cannot bypass shared Backstage pacing and remain available later", () => {
  const f = fixture();
  strongSinglesWorkingPair(f);
  f.contract.roleExpectation = "MAIN_EVENT";
  ok(generateBackstageConversations(f.aggregate) === 1, "first grounded concern missing");
  ok(generateRivalryPitches(f.aggregate) === 0, "rivalry ignored one-per-week limit");
  f.aggregate.state.world.currentDate = addPpwWeeks(
    f.aggregate.state.world.currentDate, 1, f.aggregate.state.ruleset.weeksPerYear,
  );
  ok(generateRivalryPitches(f.aggregate) === 1, "eligible rivalry was not reconsidered next week");
  ok(f.aggregate.engagement?.backstageConversations.length === 2,
    "deferred rivalry overwrote earlier conversation");
});


function establishedSuccessfulTeam(f: ReturnType<typeof fixture>, crowd = 81, professionalTrust = 78): string {
  const partnerId = successfulTagPair(f, crowd);
  const state = f.aggregate.state;
  f.contract.roleExpectation = "REGULAR";
  const teamId = "established-positive-chemistry-team";
  state.teams ??= [];
  state.teamMemberships ??= [];
  state.teams.push({
    id: teamId,worldId:state.world.id,name:"The Working Pair",
    status:"ACTIVE",formedDate:{...state.world.currentDate},disbandedDate:null,
  });
  for (const id of [f.person.id,partnerId]) {
    state.teamMemberships.push({
      id:"working-partnership-member-"+id,worldId:state.world.id,
      teamId,personId:id,joinedDate:{...state.world.currentDate},leftDate:null,active:true,
    });
  }
  const ordered = [f.person.id, partnerId].sort();
  const relation = (state.wrestlerRelationships ?? []).find((entry) =>
    [entry.personAId,entry.personBId].sort().join("|")===ordered.join("|")
  );
  state.wrestlerRelationships ??= [];
  if (relation) relation.professionalTrust = professionalTrust;
  else state.wrestlerRelationships.push({
    id:"working-partnership-relation",worldId:state.world.id,
    personAId:ordered[0]!,personBId:ordered[1]!,
    affinity:70,professionalTrust,rivalryHeat:10,familiarity:60,tags:["TAG_PARTNERS"],
  });
  const record = state.workingChemistry.find((entry) => entry.context==="TAG"
    && [entry.personAId,entry.personBId].sort().join("|")===ordered.join("|"));
  if (record) { record.matchesTogether = 4; record.familiarity = 60; }
  else state.workingChemistry.push({
    id:"working-partnership-chemistry",worldId:state.world.id,
    personAId:ordered[0]!,personBId:ordered[1]!,
    context:"TAG",compatibility:76,familiarity:60,matchesTogether:4,
  });
  return partnerId;
}

test("Established successful pair generates positive locker-room note without demanding action", () => {
  const f = fixture();
  const partnerId = establishedSuccessfulTeam(f);
  const before = JSON.stringify(f.aggregate.state);
  ok(generateTeamMoments(f.aggregate) === 1,"positive partnership note was missing");
  ok(generateTeamMoments(f.aggregate) === 0,"same team generated duplicate note");
  ok(JSON.stringify(f.aggregate.state) === before,"team note mutated simulation state");
  const note=f.aggregate.engagement!.backstageConversations[0]!;
  ok(note.kind==="TEAM_MOMENT" && note.status==="NOTED"
    && note.partnerPersonId===partnerId && note.averageCrowdResponse===81
    && note.sharedTagMatches===2 && note.response===null,
    "note lacked matching evidence or wrongly needed a reply");
  const view=buildPlayerBackstageView(f.aggregate,"backstage-owner");
  ok(view.openCount===0 && view.conversations[0]?.status==="NOTED"
    && view.conversations[0]?.partnerName !== null,
    "positive note was counted as an unanswered demand");
  const alert=buildPlayerAttention(f.aggregate,"backstage-owner")
    .find((item)=>item.attentionId==="backstage-moment:"+note.conversationId);
  ok(alert?.category==="WATCHING" && alert.dismissible
    && alert.deepLink==="/backstage" && alert.summary.includes("no action required"),
    "Home did not treat good news as an optional dismissible note");
  const restored=cloneApplicationWorld(f.aggregate);
  ok(restored.engagement?.backstageConversations[0]?.status==="NOTED",
    "positive note lost on persistence round-trip");
  let rejected=false;
  try {
    respondBackstageConversationCommand(f.aggregate,{
      requestId:"no-reply-to-news",worldId:f.aggregate.state.world.id,
      playerId:"backstage-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION",
      payload:{conversationId:note.conversationId,response:"CONSIDER_TAG_TEAM"},
    });
  }catch{rejected=true;}
  ok(rejected && note.status==="NOTED","informational note accepted an unwanted action");
});

test("Positive notes require active team, verified matches, chemistry and real trust", () => {
  for (const reason of ["NO_TEAM","LOW_RESPONSE","TRUST","NO_APPEARANCES","WEAK_CHEMISTRY"] as const) {
    const f=fixture();
    establishedSuccessfulTeam(f,reason==="LOW_RESPONSE"?50:81,reason==="TRUST"?35:78);
    if(reason==="NO_TEAM")f.aggregate.state.teams!.find((x)=>x.id==="established-positive-chemistry-team")!.status="DISBANDED";
    if(reason==="NO_APPEARANCES")f.aggregate.state.scheduledAppearances=f.aggregate.state.scheduledAppearances.filter(
      (x)=>!x.id.startsWith("tag-partner-appearance-"));
    if(reason==="WEAK_CHEMISTRY")f.aggregate.state.workingChemistry.find(
      (x)=>x.id==="working-partnership-chemistry" || x.context==="TAG" &&
        [x.personAId,x.personBId].includes(f.person.id)
    )!.familiarity=20;
    ok(generateTeamMoments(f.aggregate)===0,"weak relationship generated a positive note: "+reason);
  }
});

test("Positive updates never bypass weekly cap or compete for an open reply slot", () => {
  const f=fixture();
  establishedSuccessfulTeam(f);
  f.contract.roleExpectation="MAIN_EVENT";
  ok(generateBackstageConversations(f.aggregate)===1,"need first booking concern");
  ok(generateTeamMoments(f.aggregate)===0,"positive note exceeded conversation throttle");
  f.aggregate.state.world.currentDate=addPpwWeeks(
    f.aggregate.state.world.currentDate,1,f.aggregate.state.ruleset.weeksPerYear,
  );
  ok(generateTeamMoments(f.aggregate)===1,"good news was not deferred until next week");
  ok(f.aggregate.engagement?.backstageConversations.filter((c)=>c.status==="OPEN").length===1,
    "informational note stole an open decision slot");
});


test("Underwhelming real match crowds lead to a persistent optional gimmick discussion", () => {
  const f=fixture();
  const before=JSON.stringify(f.aggregate.state);
  ok(generateGimmickChangePitches(f.aggregate)===1,"eligible wrestler did not ask about a fresh character");
  ok(generateGimmickChangePitches(f.aggregate)===0,"repeat World pass created another gimmick pitch");
  ok(JSON.stringify(f.aggregate.state)===before,"character proposal mutated World match outcomes");
  const note=f.aggregate.engagement!.backstageConversations[0]!;
  ok(note.kind==="GIMMICK_CHANGE_PITCH" && note.sourceContractId===f.contract.id
    && note.wrestlerId===f.person.id && note.observedMatchShows===4
    && note.observedCrowdResponse===50
    && note.currentGimmickArchetype===defaultWrestlerCreativeFields(f.person).gimmickArchetype
    && note.suggestedGimmickArchetype !== note.currentGimmickArchetype,
    "pitch lost actual evidence or grounded proposal");
  const view=buildPlayerBackstageView(f.aggregate,"backstage-owner");
  ok(view.openCount===1 && view.conversations[0]?.suggestedGimmickArchetype===note.suggestedGimmickArchetype
    && !view.conversations[0]?.canPromiseFeaturedBooking,
    "private Backstage UI did not expose the creative context");
  const alert=buildPlayerAttention(f.aggregate,"backstage-owner")
    .find(item=>item.attentionId==="backstage:"+note.conversationId);
  ok(alert?.title.includes("gimmick") && alert.deepLink==="/backstage"
    && alert.category==="IMPORTANT", "Home did not surface the private proposal");
  const snapshot=cloneApplicationWorld(f.aggregate);
  ok(snapshot.engagement?.backstageConversations[0]?.observedCrowdResponse===50,
    "character pitch disappeared across persistence");
  const request={requestId:"consider-character",worldId:f.aggregate.state.world.id,
    playerId:"backstage-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION" as const,
    payload:{conversationId:note.conversationId,response:"CONSIDER_GIMMICK_CHANGE" as const}};
  const originalCreative=JSON.stringify(f.aggregate.engagement!.wrestlerCreativeProfiles);
  const done=respondBackstageConversationCommand(f.aggregate,request);
  ok(done.response==="CONSIDER_GIMMICK_CHANGE" && done.status==="ANSWERED",
    "creative response was not recorded");
  ok(respondBackstageConversationCommand(f.aggregate,request).status==="ANSWERED",
    "idempotent creative replay failed");
  ok(JSON.stringify(f.aggregate.engagement!.wrestlerCreativeProfiles)===originalCreative
    && JSON.stringify(f.aggregate.state)===before,
    "agreeing to explore created an automatic gimmick change or simulation boost");
  ok(generateGimmickChangePitches(f.aggregate)===0,"answered pitch regenerated within same contract");
});

test("A gimmick change is player-authored separately from the conversation", () => {
  const f=fixture();
  generateGimmickChangePitches(f.aggregate);
  const note=f.aggregate.engagement!.backstageConversations[0]!;
  const initial=defaultWrestlerCreativeFields(f.person);
  let denied=false;
  for(const [i,response,playerId] of [
    [1,"HEAR_OUT","backstage-owner"],
    [2,"PROMISE_FEATURED_BOOKING","backstage-owner"],
    [3,"CONSIDER_GIMMICK_CHANGE","wrong-booker"],
  ] as const){
    try{respondBackstageConversationCommand(f.aggregate,{
      requestId:"deny-gimmick-"+i,worldId:f.aggregate.state.world.id,playerId,
      commandType:"RESPOND_BACKSTAGE_CONVERSATION",
      payload:{conversationId:note.conversationId,response},
    });}catch{denied=true;}
  }
  ok(denied && note.status==="OPEN","unauthorized or wrong-kind answer was accepted");
  respondBackstageConversationCommand(f.aggregate,{
    requestId:"keep-character",worldId:f.aggregate.state.world.id,
    playerId:"backstage-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:note.conversationId,response:"PASS_GIMMICK_CHANGE"},
  });
  ok(JSON.stringify(f.aggregate.engagement?.wrestlerCreativeProfiles??[])==="[]",
    "declining the proposal modified the character");
  const chosen= {
    ...initial,ringName:"The Last Outlaw",gimmickArchetype:"REBEL" as const,
    gimmickDescription:"A seasoned competitor who plays by nobody's rules.",
  };
  setWrestlerCreativeProfileCommand(f.aggregate.state,f.aggregate.engagement!,f.aggregate.ownership,
    f.aggregate.commands,f.aggregate.runtime,{
      requestId:"booker-writes-character",worldId:f.aggregate.state.world.id,playerId:"backstage-owner",
      commandType:"SET_WRESTLER_CREATIVE_PROFILE",
      payload:{promotionId:f.promotion.id,personId:f.person.id,fields:chosen},
    });
  ok(f.aggregate.engagement?.wrestlerCreativeProfiles?.[0]?.fields.ringName==="The Last Outlaw",
    "player's separate character authoring was blocked");
  ok(note.status==="ANSWERED" && note.response==="PASS_GIMMICK_CHANGE",
    "later manual character edit rewrote the original conversation");
});

test("Gimmick ideas require current contract usage, low crowd response and a settled presentation", () => {
  for(const failure of ["GOOD_CROWD","TOO_FEW","WRONG_CONTRACT","INJURED","FRESH_GIMMICK","NO_DATES"] as const) {
    const f=fixture();
    if(failure==="GOOD_CROWD") {
      for(const match of f.aggregate.state.matches.filter(m=>m.id.startsWith("backstage-show-")&&m.order===1)){
        match.crowdResponse=86;
      }
    }
    if(failure==="TOO_FEW") {
      f.aggregate.state.matchParticipants=f.aggregate.state.matchParticipants.filter(
        item=>item.eventId!=="backstage-show-4" || item.personId!==f.person.id);
    }
    if(failure==="WRONG_CONTRACT") {
      for(const entry of f.aggregate.state.scheduledAppearances.filter(
        x=>x.personId===f.person.id && x.id.startsWith("backstage-appearance-")))entry.contractId="outside-contract";
    }
    if(failure==="INJURED")f.person.status="INJURED";
    if(failure==="NO_DATES")f.contract.datesUsed=f.contract.dateEntitlement;
    if(failure==="FRESH_GIMMICK") {
      f.aggregate.engagement=createWorldEngagementState(f.aggregate.state.world.id);
      const baseline=defaultWrestlerCreativeFields(f.person);
      setWrestlerCreativeProfileCommand(f.aggregate.state,f.aggregate.engagement!,f.aggregate.ownership,
        f.aggregate.commands,f.aggregate.runtime,{
          requestId:"recent-rebrand",worldId:f.aggregate.state.world.id,playerId:"backstage-owner",
          commandType:"SET_WRESTLER_CREATIVE_PROFILE",
          payload:{promotionId:f.promotion.id,personId:f.person.id,fields:{...baseline,ringName:"Newly Rebranded"}},
        });
    }
    ok(generateGimmickChangePitches(f.aggregate)===0,
      "generated an ungrounded gimmick request: "+failure);
  }
});

test("Creative pitches respect the existing Backstage weekly limit and unanswered cap", () => {
  const f=fixture();
  ok(generateBackstageConversations(f.aggregate)===1,"expected the priority role-usage concern");
  ok(generateGimmickChangePitches(f.aggregate)===0,"character pitch bypassed priority weekly cap");
  f.aggregate.state.world.currentDate=addPpwWeeks(
    f.aggregate.state.world.currentDate,1,f.aggregate.state.ruleset.weeksPerYear);
  ok(generateGimmickChangePitches(f.aggregate)===1,"deferred character suggestion was not reconsidered");
  ok(f.aggregate.engagement?.backstageConversations.length===2,
    "later creative request overwrote the concern");
  const newNote=f.aggregate.engagement?.backstageConversations.find(x=>x.kind==="GIMMICK_CHANGE_PITCH");
  ok(newNote?.createdDate.week===f.aggregate.state.world.currentDate.week,
    "wrong week persisted on deferred pitch");
});


test("Backstage voice is stable, wrestler-specific and backed by real conversation evidence", () => {
  const f=fixture();
  f.person.backstageTemperament="AMBITIOUS";
  ok(generateBackstageConversations(f.aggregate)===1,"contract issue should exist");
  const before=JSON.stringify(f.aggregate.state);
  const view=buildPlayerBackstageView(f.aggregate,"backstage-owner");
  const line=view.conversations[0]!.dialogue;
  ok(line.voice==="AMBITIOUS" && line.speech.includes("4 matches")
    && line.speech.includes("main-event") && line.speech.includes("plan"),
    "ambitious tone omitted contract evidence");
  const persisted=cloneApplicationWorld(f.aggregate);
  const historical=buildPlayerBackstageView(persisted,"backstage-owner");
  ok(historical.conversations[0]!.dialogue.speech===line.speech,
    "dialogue changed after snapshot/restore");
  ok(JSON.stringify(f.aggregate.state)===before,
    "read-only dialogue changed the simulation state");
  f.person.backstageTemperament="METHODICAL";
  const different=buildPlayerBackstageView(f.aggregate,"backstage-owner").conversations[0]!.dialogue;
  ok(different.voice==="METHODICAL" && different.speech!==line.speech
    && different.speech.includes("4 matches"),"personality did not affect grounded wrestler voice");
  // This is only a presentational voice, not an immutable historical audio recording.
  // The facts (frozen on the conversation) never shift with tone.
  ok(view.conversations[0]!.observedMatchShows===4
    && view.conversations[0]!.promisedRole===historical.conversations[0]!.promisedRole,
    "personality rewrote the historical deal");
});

test("All Backstage dialogue kinds mention only their evidenced counterpart or role", () => {
  const f=fixture();
  const engage=f.aggregate.engagement=createWorldEngagementState(f.aggregate.state.world.id);
  const now={...f.aggregate.state.world.currentDate};
  const partner=f.aggregate.state.people.find(p=>p.id!==f.person.id)!;
  const rival=f.aggregate.state.people.find(p=>p.id!==f.person.id && p.id!==partner.id)!;
  const examples=[
    {
      id:"voice-tag",kind:"TAG_TEAM_PITCH" as const,partnerPersonId:partner.id,
      sharedTagMatches:3,averageCrowdResponse:75,promisedRole:null,
      observedMatchShows:0,observedFeaturedShows:0,
    },
    {
      id:"voice-rival",kind:"RIVALRY_PITCH" as const,rivalPersonId:rival.id,
      sharedSinglesMatches:2,averageCrowdResponse:82,professionalTrustAtPitch:82,
      promisedRole:null,observedMatchShows:0,observedFeaturedShows:0,
    },
    {
      id:"voice-moment",kind:"TEAM_MOMENT" as const,partnerPersonId:partner.id,
      sharedTagMatches:3,averageCrowdResponse:74,professionalTrustAtPitch:80,
      promisedRole:null,observedMatchShows:0,observedFeaturedShows:0,
    },
    {
      id:"voice-gimmick",kind:"GIMMICK_CHANGE_PITCH" as const,
      observedMatchShows:4,observedFeaturedShows:0,observedCrowdResponse:44,
      currentGimmickArchetype:"AUTHENTIC" as const,suggestedGimmickArchetype:"REBEL" as const,
      promisedRole:null,
    },
  ];
  for(const [index,item] of examples.entries()){
    openBackstageConversation(engage,{
      conversationId:item.id,worldId:f.aggregate.state.world.id,
      promotionId:f.promotion.id,wrestlerId:f.person.id,sourceContractId:f.contract.id,
      createdDate:now,status:item.kind==="TEAM_MOMENT"?"NOTED":"OPEN",response:null,responseDate:null,
      ...item,
    });
    const rendered=buildPlayerBackstageView(f.aggregate,"backstage-owner")
      .conversations.find(c=>c.conversationId===item.id)!;
    ok(rendered.dialogue.speech.length>60,
      "kind "+item.kind+" did not render a meaningful line");
    ok(!rendered.dialogue.speech.includes("undefined")
      && !rendered.dialogue.speech.includes("NaN"),"incomplete dialogue for "+item.kind);
    if(index===0||index===2)ok(rendered.dialogue.speech.includes(partner.name),
      "forgot real tag partner identity");
    if(index===1)ok(rendered.dialogue.speech.includes(rival.name),
      "forgot real rivalry opponent");
    if(index===3)ok(rendered.dialogue.speech.includes("rebel")
      && rendered.dialogue.speech.includes("authentic"),"gimmick dialogue invented a different choice");
    if(index===2)ok(!rendered.dialogue.speech.includes("I want to earn")
      && !rendered.dialogue.speech.includes("dates we're working count"),
      "passive good news became a contract/push demand");
  }
  const erased=engage.backstageConversations.find(c=>c.conversationId==="voice-tag")!;
  const names=new Map(f.aggregate.state.people.map(p=>[p.id,p.name]));
  const neutral=buildBackstageDialogue(erased,undefined,names);
  ok(neutral.voice==="NEUTRAL"&&neutral.speech.includes(partner.name),
    "old conversation without an available wrestler lost its grounded facts");
});


test("Who suggests a team is chosen by creative preference, not wrestler ID",()=>{
  const f=fixture();
  f.contract.roleExpectation="REGULAR";
  const partnerId=successfulTagPair(f);
  const partner=f.aggregate.state.people.find(p=>p.id===partnerId)!;
  f.person.backstageTemperament="INDEPENDENT";
  f.person.priorities.loyalty=0;
  f.person.priorities.schedule=0;
  partner.backstageTemperament="COLLABORATIVE";
  partner.priorities.loyalty=100;
  partner.priorities.schedule=100;
  ok(chooseCreativePitchSpeaker(f.person,partner,"TEAM_PARTNERSHIPS").id===partner.id,
    "test failed to establish differing creative interest");
  const relation=f.aggregate.state.wrestlerRelationships?.find(r=>
    [r.personAId,r.personBId].includes(f.person.id)
    && [r.personAId,r.personBId].includes(partner.id));
  if(relation)relation.professionalTrust=82;
  else (f.aggregate.state.wrestlerRelationships??=[]).push({
    id:"real-tag-professional-trust",worldId:f.aggregate.state.world.id,
    personAId:f.person.id,personBId:partner.id,affinity:55,professionalTrust:82,
    rivalryHeat:0,familiarity:30,tags:[],
  });
  let working=f.aggregate.state.workingChemistry.find(x=>x.context==="TAG"
    && [x.personAId,x.personBId].includes(f.person.id)
    && [x.personAId,x.personBId].includes(partner.id));
  if(working){working.familiarity=67;working.matchesTogether=3;}
  else f.aggregate.state.workingChemistry.push({
    id:"real-tag-working-chemistry",worldId:f.aggregate.state.world.id,
    personAId:f.person.id,personBId:partner.id,context:"TAG",
    compatibility:66,familiarity:67,matchesTogether:3,
  });
  const before=JSON.stringify(f.aggregate.state);
  ok(generateTagTeamPitches(f.aggregate)===1,"proven tag results should produce an idea");
  const pitch=f.aggregate.engagement!.backstageConversations[0]!;
  ok(pitch.wrestlerId===partner.id && pitch.partnerPersonId===f.person.id
    && pitch.sourceContractId===activeContractsForPromotion(f.aggregate.state,f.promotion.id)
      .find(c=>c.personId===partner.id)?.id,
    "creative speaker did not match the wrestler's actual contract");
  ok(pitch.creativeInterestAtPitch==="TEAM_PARTNERSHIPS"
    && pitch.professionalTrustAtPitch===82 && pitch.tagFamiliarityAtPitch===67,
    "genuine trust/familiarity were not frozen on the private pitch");
  const view=buildPlayerBackstageView(f.aggregate,"backstage-owner");
  ok(view.conversations[0]?.tagFamiliarityAtPitch===67
    && view.conversations[0]?.creativeInterestAtPitch==="TEAM_PARTNERSHIPS",
    "read-model omitted real relationship context");
  const cloned=cloneApplicationWorld(f.aggregate);
  ok(cloned.engagement?.backstageConversations[0]?.wrestlerId===partner.id,
    "persistent World changed who actually proposed the idea");
  ok(JSON.stringify(f.aggregate.state)===before,
    "individual interest silently changed relationship or match state");
});

test("Incomplete tag sides cannot masquerade as two-person teams",()=>{
  const f=fixture();
  f.contract.roleExpectation="REGULAR";
  successfulTagPair(f);
  // A third booked participant on the same side is incompatible with an
  // unambiguous two-person tag pairing, even if their contract is ineligible.
  const sideA=f.aggregate.state.matchParticipants.find(x=>x.matchId==="backstage-show-1-match-1")!;
  const outsider=f.aggregate.state.people.find(p=>p.id!==f.person.id
    && !f.aggregate.state.scheduledAppearances.some(a=>a.personId===p.id
      && a.eventId==="backstage-show-1"))!;
  f.aggregate.state.matchParticipants.push({...sideA,
    id:"third-rosterless-tag-member",personId:outsider.id});
  ok(generateTagTeamPitches(f.aggregate)===0,
    "tag suggestion used two eligible people from an actual three-person side");
});

test("A trusted on-screen rival is proposed by the wrestler most interested in that story",()=>{
  const f=fixture();
  const partnerId=strongSinglesWorkingPair(f);
  const partner=f.aggregate.state.people.find(p=>p.id===partnerId)!;
  f.person.backstageTemperament="STEADY";
  f.person.priorities.role=0;
  f.person.priorities.prestige=0;
  partner.backstageTemperament="AMBITIOUS";
  partner.priorities.role=100;
  partner.priorities.prestige=100;
  ok(chooseCreativePitchSpeaker(f.person,partner,"STORY_RIVALRIES").id===partner.id,
    "test did not create a wrestler-specific creative preference");
  const before=JSON.stringify(f.aggregate.state);
  ok(generateRivalryPitches(f.aggregate)===1,"strong in-ring evidence was ignored");
  const pitch=f.aggregate.engagement!.backstageConversations[0]!;
  ok(pitch.wrestlerId===partner.id && pitch.rivalPersonId===f.person.id
    && pitch.creativeInterestAtPitch==="STORY_RIVALRIES"
    && pitch.professionalTrustAtPitch===78,
    "personality did not choose speaker or actual trusted opponent");
  ok(JSON.stringify(f.aggregate.state)===before,
    "proposal modified professional trust or forced an on-screen rivalry");
});


test("Private creative responses survive into the next conversation without pretending to be bookings",()=>{
  const f=fixture();
  const engagement=createWorldEngagementState(f.aggregate.state.world.id);
  const aggregate=f.aggregate;
  aggregate.engagement=engagement;
  const first=generateBackstageConversations(aggregate);
  ok(first===1,"fixture should create a real role-usage concern");
  const role=engagement.backstageConversations[0]!;
  ok(role.continuity?.priorAnsweredCount===0
    && role.continuity.lastCreativeDecision===null,
    "first conversation invented previous private history");
  respondBackstageConversationCommand(aggregate,{
    requestId:"history-first-answer",worldId:aggregate.state.world.id,
    playerId:"backstage-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:role.conversationId,response:"EXPLAIN_PLAN"},
  });
  aggregate.state.world.currentDate=addPpwWeeks(aggregate.state.world.currentDate,1,aggregate.state.ruleset.weeksPerYear);
  ok(generateGimmickChangePitches(aggregate)===1,"weak match evidence should justify a gimmick pitch");
  const gimmick=engagement.backstageConversations.at(-1)!;
  ok(gimmick.continuity?.priorAnsweredCount===1
    && gimmick.continuity?.lastCreativeDecision===null,
    "historical role concern was counted as an accepted creative pitch");
  const simState=aggregate.state;
  const beforeContracts=JSON.stringify(simState.contracts);
  const beforeRelationships=JSON.stringify(simState.wrestlerRelationships);
  const beforeMatches=JSON.stringify(simState.matches);
  const conversation={
    requestId:"history-character-response",worldId:aggregate.state.world.id,
    playerId:"backstage-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION" as const,
    payload:{conversationId:gimmick.conversationId,response:"PASS_GIMMICK_CHANGE" as const},
  };
  respondBackstageConversationCommand(aggregate,conversation);
  respondBackstageConversationCommand(aggregate,conversation);
  aggregate.state.world.currentDate=addPpwWeeks(aggregate.state.world.currentDate,1,aggregate.state.ruleset.weeksPerYear);
  const next={
    conversationId:"history-subsequent-conversation",worldId:aggregate.state.world.id,
    promotionId:f.promotion.id,wrestlerId:f.person.id,sourceContractId:f.contract.id,
    kind:"ROLE_USAGE_CONCERN" as const,
    createdDate:{...aggregate.state.world.currentDate},
    status:"OPEN" as const,response:null,responseDate:null,
    promisedRole:"MAIN_EVENT" as const,observedMatchShows:4,observedFeaturedShows:0,
  };
  const opened=openBackstageConversation(engagement,next);
  ok(opened.continuity?.priorAnsweredCount===2
    && opened.continuity.lastCreativeDecision==="PASS_GIMMICK_CHANGE"
    && opened.continuity.lastCreativeDecisionDate?.week===gimmick.responseDate?.week,
    "new request forgot booker response or misattributed it");
  const dialogue=buildPlayerBackstageView(aggregate,"backstage-owner")
    .conversations.find(x=>x.conversationId===opened.conversationId)!;
  ok(dialogue.dialogue.speech.includes("passed on a character change")
    && dialogue.continuity?.priorAnsweredCount===2,
    "private wrestler did not recognise prior response");
  ok(JSON.stringify(simState.contracts)===beforeContracts
    && JSON.stringify(simState.wrestlerRelationships)===beforeRelationships
    && JSON.stringify(simState.matches)===beforeMatches,
    "past creative responses changed simulation or relationships");
  ok((engagement.wrestlerCreativeProfiles??[]).length===0,
    "a rejected proposal secretly changed the wrestler's gimmick");
  const saved=cloneApplicationWorld(aggregate);
  const savedRequest=saved.engagement?.backstageConversations.find(x=>x.conversationId===opened.conversationId);
  ok(savedRequest?.continuity?.lastCreativeDecision==="PASS_GIMMICK_CHANGE",
    "World persistence dropped frozen creative continuity");
  // Future replies must never reach backwards into previously stored context.
  respondBackstageConversationCommand(aggregate,{
    requestId:"history-next-answer",worldId:aggregate.state.world.id,
    playerId:"backstage-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:opened.conversationId,response:"STAND_FIRM"},
  });
  ok(engagement.backstageConversations[1]?.continuity?.lastCreativeDecision===null
    && role.continuity?.priorAnsweredCount===0,
    "future response rewrote an old conversation snapshot");
});

test("Verified positive teamwork gives continuity, a considered pitch alone never does",()=>{
  const f=fixture();
  f.contract.roleExpectation="REGULAR";
  const partnerId=successfulTagPair(f);
  const second=f.aggregate.state.people.find(p=>p.id===partnerId)!;
  const engagement=createWorldEngagementState(f.aggregate.state.world.id);
  f.aggregate.engagement=engagement;
  const date={...f.aggregate.state.world.currentDate};
  const note=openBackstageConversation(engagement,{
    conversationId:"team-history-verified",worldId:f.aggregate.state.world.id,
    promotionId:f.promotion.id,wrestlerId:second.id,partnerPersonId:f.person.id,
    sourceContractId:activeContractsForPromotion(f.aggregate.state,f.promotion.id).find(x=>x.personId===second.id)!.id,
    kind:"TEAM_MOMENT",createdDate:date,status:"NOTED",response:null,responseDate:null,
    promisedRole:null,observedMatchShows:0,observedFeaturedShows:0,sharedTagMatches:3,
    averageCrowdResponse:75,professionalTrustAtPitch:80,
  });
  ok(note.continuity?.pastPositiveTeamMomentsWithPartner===0,"first note invented earlier successful partnership");
  f.aggregate.state.world.currentDate=addPpwWeeks(date,1,f.aggregate.state.ruleset.weeksPerYear);
  const idea=openBackstageConversation(engagement,{
    conversationId:"team-history-next",worldId:f.aggregate.state.world.id,
    promotionId:f.promotion.id,wrestlerId:f.person.id,partnerPersonId:second.id,
    sourceContractId:f.contract.id,kind:"TAG_TEAM_PITCH",
    createdDate:{...f.aggregate.state.world.currentDate},
    status:"OPEN",response:null,responseDate:null,
    promisedRole:null,observedMatchShows:0,observedFeaturedShows:0,
    sharedTagMatches:2,averageCrowdResponse:78,
  });
  ok(idea.continuity?.pastPositiveTeamMomentsWithPartner===1,
    "past positive teamwork not recognised when speaker was the former partner");
  const dialogue=buildPlayerBackstageView(f.aggregate,"backstage-owner")
    .conversations.find(c=>c.conversationId===idea.conversationId);
  ok(dialogue?.dialogue.speech.includes("good nights together"),
    "verified teamwork had no continuity in the new suggestion");
  const thirdDate=addPpwWeeks(f.aggregate.state.world.currentDate,1,f.aggregate.state.ruleset.weeksPerYear);
  const unrelated=openBackstageConversation(engagement,{
    ...idea,
    conversationId:"team-history-other-pair",createdDate:thirdDate,
    partnerPersonId:f.aggregate.state.people.find(p=>p.id!==f.person.id&&p.id!==second.id)!.id,
    continuity:undefined,
  });
  ok(unrelated.continuity?.pastPositiveTeamMomentsWithPartner===0,
    "pair memory leaked to a wrestler who was never in the established duo");
});


test("A considered rivalry only counts when the player starts a new real opposing Programme",()=>{
  const f=fixture(),a=f.aggregate;
  const contracts=activeContractsForPromotion(a.state,f.promotion.id).filter(x=>x.personId!==f.person.id);
  const partner=contracts[0]!;
  a.engagement=createWorldEngagementState(a.state.world.id);
  const existing=createProgramme(a.state,{
    promotionId:f.promotion.id,
    sideA:[{kind:"PERSON",entityId:f.person.id}],
    sideB:[{kind:"PERSON",entityId:partner.personId}],
  });
  const item=openBackstageConversation(a.engagement,{
    conversationId:"follow:rivalry",worldId:a.state.world.id,promotionId:f.promotion.id,
    wrestlerId:f.person.id,sourceContractId:f.contract.id,
    kind:"RIVALRY_PITCH",createdDate:{...a.state.world.currentDate},
    status:"OPEN",response:null,responseDate:null,promisedRole:null,
    observedMatchShows:0,observedFeaturedShows:0,rivalPersonId:partner.personId,
    sharedSinglesMatches:2,averageCrowdResponse:80,professionalTrustAtPitch:77,
  });
  respondBackstageConversationCommand(a,{
    requestId:"follow:rivalry-reply",worldId:a.state.world.id,playerId:"backstage-owner",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:item.conversationId,response:"CONSIDER_RIVALRY"},
  });
  ok(item.creativeBaseline?.existingProgrammeIds.includes(existing.id),"reply missed same-day existing Programme");
  ok(assessCreativeFollowThrough(a)===0&&item.creativeFollowThrough===undefined,
    "a Programme created before the reply was wrongly credited");
  // The old Programme ends; another authored new Programme is now eligible,
  // even when both actions occur on the same PPW day.
  existing.status="ENDED";
  existing.endedDate={...a.state.world.currentDate};
  const started=createProgramme(a.state,{
    promotionId:f.promotion.id,
    sideA:[{kind:"PERSON",entityId:f.person.id}],
    sideB:[{kind:"PERSON",entityId:partner.personId}],
  });
  const before=JSON.stringify(a.state);
  ok(assessCreativeFollowThrough(a)===1
    &&item.creativeFollowThrough?.kind==="PROGRAMME_STARTED"
    &&item.creativeFollowThrough.evidenceId===started.id,
    "new player-authored Programme did not satisfy the actual idea");
  ok(assessCreativeFollowThrough(a)===0
    &&JSON.stringify(a.state)===before,
    "a retry changed simulation or awarded follow-through twice");
  const saved=cloneApplicationWorld(a);
  ok(saved.engagement?.backstageConversations.find(x=>x.conversationId===item.conversationId)
    ?.creativeFollowThrough?.evidenceId===started.id,
    "World snapshot dropped completed creative history");
});

test("Character repackaging requires an actual presentation change, not merely a move-name edit",()=>{
  const f=fixture(),a=f.aggregate;
  a.engagement=createWorldEngagementState(a.state.world.id);
  const initial=defaultWrestlerCreativeFields(f.person);
  const note=openBackstageConversation(a.engagement,{
    conversationId:"follow:gimmick",worldId:a.state.world.id,promotionId:f.promotion.id,
    wrestlerId:f.person.id,sourceContractId:f.contract.id,
    kind:"GIMMICK_CHANGE_PITCH",createdDate:{...a.state.world.currentDate},
    status:"OPEN",response:null,responseDate:null,promisedRole:null,
    observedMatchShows:4,observedFeaturedShows:0,observedCrowdResponse:49,
    currentGimmickArchetype:"AUTHENTIC",suggestedGimmickArchetype:"REBEL",
  });
  respondBackstageConversationCommand(a,{
    requestId:"follow:gimmick-consider",worldId:a.state.world.id,playerId:"backstage-owner",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:note.conversationId,response:"CONSIDER_GIMMICK_CHANGE"},
  });
  ok(assessCreativeFollowThrough(a)===0,"clicking Consider was credited as a real repackage");
  setWrestlerCreativeProfileCommand(a.state,a.engagement,a.ownership,a.commands,a.runtime,{
    requestId:"follow:finisher-only",worldId:a.state.world.id,playerId:"backstage-owner",
    commandType:"SET_WRESTLER_CREATIVE_PROFILE",
    payload:{promotionId:f.promotion.id,personId:f.person.id,
      fields:{...initial,finishingMove:{name:"New move",category:"GRAPPLE"}}},
  });
  ok(assessCreativeFollowThrough(a)===0,"a finisher edit was misreported as a gimmick change");
  setWrestlerCreativeProfileCommand(a.state,a.engagement,a.ownership,a.commands,a.runtime,{
    requestId:"follow:real-repackage",worldId:a.state.world.id,playerId:"backstage-owner",
    commandType:"SET_WRESTLER_CREATIVE_PROFILE",
    payload:{promotionId:f.promotion.id,personId:f.person.id,
      fields:{...initial,ringName:"The People's Outlaw",gimmickArchetype:"REBEL"}},
  });
  const state=JSON.stringify(a.state);
  ok(assessCreativeFollowThrough(a)===1
    &&note.creativeFollowThrough?.kind==="GIMMICK_UPDATED",
    "a real creative change was not linked to the earlier conversation");
  const view=buildPlayerBackstageView(a,"backstage-owner");
  ok(view.conversations[0]?.creativeFollowThrough?.kind==="GIMMICK_UPDATED",
    "private Backstage UI lost verified creative outcome");
  ok(JSON.stringify(a.state)===state&&assessCreativeFollowThrough(a)===0,
    "creative follow-through reroll changed World or counted twice");
});

test("Tag pitches require a genuinely completed 2-person tag pairing in the same promotion",()=>{
  const f=fixture(),a=f.aggregate;
  const controls=activeContractsForPromotion(a.state,f.promotion.id);
  ok(controls.length>=4,"fixture lacks four signed active wrestlers");
  const teammate=controls.find(c=>c.personId!==f.person.id)!;
  const other=controls.filter(c=>c.personId!==f.person.id&&c.personId!==teammate.personId);
  a.engagement=createWorldEngagementState(a.state.world.id);
  const pitch=openBackstageConversation(a.engagement,{
    conversationId:"follow:tag",worldId:a.state.world.id,promotionId:f.promotion.id,
    wrestlerId:f.person.id,sourceContractId:f.contract.id,
    kind:"TAG_TEAM_PITCH",createdDate:{...a.state.world.currentDate},status:"OPEN",
    response:null,responseDate:null,promisedRole:null,
    observedMatchShows:0,observedFeaturedShows:0,partnerPersonId:teammate.personId,
    sharedTagMatches:2,averageCrowdResponse:74,
  });
  respondBackstageConversationCommand(a,{
    requestId:"follow:tag-consider",worldId:a.state.world.id,playerId:"backstage-owner",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:pitch.conversationId,response:"CONSIDER_TAG_TEAM"},
  });
  const future=addPpwWeeks(a.state.world.currentDate,1,a.state.ruleset.weeksPerYear);
  const eventId="follow-real-tag-event",matchId="follow-real-tag-match";
  a.state.events.push({
    ...a.state.events.find(e=>e.id==="backstage-show-4")!,
    id:eventId,date:future,status:"COMPLETED",promotionId:f.promotion.id,
  });
  a.state.matches.push({
    ...a.state.matches.find(m=>m.id==="backstage-show-4-match-1")!,
    id:matchId,eventId,promotionId:f.promotion.id,
    type:"TAG",status:"COMPLETED",crowdResponse:76,
  });
  const ids=[f.person.id,teammate.personId,other[0]!.personId,other[1]!.personId];
  ids.forEach((personId,i)=>{
    a.state.matchParticipants.push({
      id:"follow-tag-participant-"+i,worldId:a.state.world.id,matchId,eventId,
      personId,side:i<2?"A":"B",won:i<2,
    });
    const contract=controls.find(c=>c.personId===personId)!;
    a.state.scheduledAppearances.push({
      id:"follow-tag-appearance-"+i,worldId:a.state.world.id,eventId,
      promotionId:f.promotion.id,personId,contractId:contract.id,date:future,
      serviceCapacityAtBooking:1,status:"COMPLETED",
    });
  });
  // A future completed record is not credited before that week is resolved.
  ok(assessCreativeFollowThrough(a)===0,
    "follow-through claimed a match from a future PPW week");
  a.state.world.currentDate={...future};
  // A real completed tag match in another promotion does not qualify.
  a.state.matches.at(-1)!.promotionId="outside-promotion";
  ok(assessCreativeFollowThrough(a)===0,"another promotion earned our follow-through");
  a.state.matches.at(-1)!.promotionId=f.promotion.id;
  // Three-person teams are not a two-person pairing and do not satisfy it.
  a.state.matchParticipants.push({
    id:"follow-tag-third",worldId:a.state.world.id,matchId,eventId,
    personId:"third-guest",side:"A",won:true,
  });
  ok(assessCreativeFollowThrough(a)===0,"a trio was treated as a tag pair");
  a.state.matchParticipants.pop();
  const before=JSON.stringify(a.state);
  ok(assessCreativeFollowThrough(a)===1
    &&pitch.creativeFollowThrough?.kind==="TAG_MATCH_BOOKED"
    &&pitch.creativeFollowThrough.evidenceId===matchId,
    "actual recorded partnership did not count");
  ok(assessCreativeFollowThrough(a)===0&&JSON.stringify(a.state)===before,
    "tag follow-through stacked an additional simulation bonus");
  const view=buildPlayerBackstageView(a,"backstage-owner");
  ok(view.conversations[0]?.creativeFollowThrough?.kind==="TAG_MATCH_BOOKED",
    "recorded tag match did not show in private history");
});

test("Declined creative ideas never receive follow-through, even after unrelated bookings",()=>{
  const f=fixture(),a=f.aggregate;
  a.engagement=createWorldEngagementState(a.state.world.id);
  const note=openBackstageConversation(a.engagement,{
    conversationId:"follow:declined",worldId:a.state.world.id,promotionId:f.promotion.id,
    wrestlerId:f.person.id,sourceContractId:f.contract.id,
    kind:"GIMMICK_CHANGE_PITCH",createdDate:{...a.state.world.currentDate},
    status:"OPEN",response:null,responseDate:null,promisedRole:null,
    observedMatchShows:4,observedFeaturedShows:0,observedCrowdResponse:50,
    currentGimmickArchetype:"AUTHENTIC",suggestedGimmickArchetype:"REBEL",
  });
  respondBackstageConversationCommand(a,{
    requestId:"follow:decline",worldId:a.state.world.id,playerId:"backstage-owner",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:note.conversationId,response:"PASS_GIMMICK_CHANGE"},
  });
  setWrestlerCreativeProfileCommand(a.state,a.engagement,a.ownership,a.commands,a.runtime,{
    requestId:"follow:later-independent-change",worldId:a.state.world.id,playerId:"backstage-owner",
    commandType:"SET_WRESTLER_CREATIVE_PROFILE",
    payload:{promotionId:f.promotion.id,personId:f.person.id,
      fields:{...defaultWrestlerCreativeFields(f.person),ringName:"Independent Change"}}});
  ok(assessCreativeFollowThrough(a)===0&&note.creativeFollowThrough===undefined,
    "a previous rejection was retroactively turned into an agreement");
});


test("World-locked working strain creates one private, optional review with safe booking choices", () => {
  const f = fixture();
  const { aggregate, promotion, person, contract } = f;
  const state = aggregate.state;
  const other = activeContractsForPromotion(state, promotion.id)
    .find(c => c.personId !== person.id);
  ok(other, "fixture needs another wrestler on the same active roster");
  other!.startDate = { ...contract.startDate };
  other!.endDate = { ...contract.endDate };
  other!.dateEntitlement = 12;
  other!.datesUsed = 2;
  const sourceDate = addPpwWeeks(state.world.currentDate, -1, state.ruleset.weeksPerYear);
  const eventId = "backstage-strained-team-show";
  const matchId = "backstage-strained-team-match";
  const event = {
    ...state.events[0]!, id: eventId,
    date: sourceDate, promotionId: promotion.id, status: "COMPLETED" as const,
    matchCount: 1, averageMatchRating: 1.2, crowdResponse: 28,
  };
  const match: Match = {
    ...state.matches[0]!, id: matchId, eventId, promotionId: promotion.id,
    type: "TAG", status: "COMPLETED",
    executionQuality: 28, crowdResponse: 26,
  };
  state.events.push(event);
  state.matches.push(match);
  const ids = [person.id, other!.personId, ...state.people
    .filter(p => p.id !== person.id && p.id !== other!.personId)
    .slice(0, 2).map(p => p.id)];
  ok(ids.length === 4, "fixture cannot form a valid tag match");
  state.matchParticipants.push(...ids.map((personId, i) => ({
    id: "backstage-strain-participant-" + i,
    worldId: state.world.id, eventId, matchId, personId,
    side: i < 2 ? "A" as const : "B" as const, won: false,
  })));
  const [a, b] = [ids[0]!, ids[1]!].sort();
  upsertWrestlerRelationship(state, {personAId: a!, personBId: b!,
    professionalTrust: 64, familiarity: 32});
  state.ledger.push({
    id: "ledger:working-strain-test",
    worldId: state.world.id, date: sourceDate, order: state.ledger.length + 1,
    type: WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE,
    significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
    entityIds: [a!, b!],
    payload: { sourceMatchId: matchId, verifiedShows: 3, trustDelta: -0.6,
      familiarityDelta: 0, reason: "REPEATED_POOR_TAG_EXECUTION" },
  });
  const beforeState = JSON.stringify(state);
  ok(generateWorkingPartnershipConcerns(aggregate) === 1,
    "verified home-promotion strain should open one concern");
  ok(generateWorkingPartnershipConcerns(aggregate) === 0,
    "retry duplicated an already recorded private working concern");
  ok(JSON.stringify(state) === beforeState,
    "raising a concern changed match results, morale or professional trust");
  const view = buildPlayerBackstageView(aggregate, "backstage-owner");
  const issue = view.conversations.find(c => c.kind === "WORKING_PARTNERSHIP_CONCERN");
  ok(issue?.partnerPersonId && issue.workingSourceLedgerId === "ledger:working-strain-test"
    && issue.observedMatchShows === 3 && issue.workingTrustDelta === -0.6
    && issue.dialogue.speech.includes("execution"),
    "working concern did not freeze the proven failure and named partner");
  const alert = buildPlayerAttention(aggregate, "backstage-owner")
    .find(item => item.attentionId === "backstage:" + issue?.conversationId);
  ok(alert?.title.includes("difficult tag partnership") && alert.deepLink === "/backstage"
    && alert.category === "IMPORTANT", "owner was not told about the private working concern");
  const snapshot = cloneApplicationWorld(aggregate);
  ok(snapshot.engagement?.backstageConversations.some(c =>
    c.conversationId === issue?.conversationId && c.workingSourceLedgerId === "ledger:working-strain-test"),
    "persistence roundtrip lost frozen working-strain evidence");

  const command = {
    commandType: "RESPOND_BACKSTAGE_CONVERSATION" as const,
    worldId: state.world.id, playerId: "backstage-owner",
    requestId: "backstage-reviewed-strain",
    payload: { conversationId: issue!.conversationId, response: "DISCUSS_WORKING_PLAN" as const },
  };
  let rejected = false;
  try { respondBackstageConversationCommand(aggregate, {
    ...command, requestId: "wrong-working-response",
    payload: { ...command.payload, response: "CONSIDER_GIMMICK_CHANGE" as "DISCUSS_WORKING_PLAN" },
  }); } catch { rejected = true; }
  ok(rejected, "gimmick response was accepted for a working concern");
  rejected = false;
  try { respondBackstageConversationCommand(aggregate, {
    ...command, requestId: "stranger-working-response", playerId: "unregistered-owner",
  }); } catch { rejected = true; }
  ok(rejected, "other controller could answer a private working concern");
  const saved = respondBackstageConversationCommand(aggregate, command);
  ok(saved.response === "DISCUSS_WORKING_PLAN" && saved.status === "ANSWERED",
    "booker's management choice was not recorded");
  ok(respondBackstageConversationCommand(aggregate, command).response === "DISCUSS_WORKING_PLAN",
    "command retry did not preserve the same answer");
  ok(JSON.stringify(state) === beforeState,
    "answering working concern changed simulation or scripted outcomes");
  ok(buildPlayerBackstageView(aggregate, "backstage-owner").openCount === 0,
    "answered working concern remained open");
  ok(generateWorkingPartnershipConcerns(aggregate) === 0,
    "answered working concern reopened without fresh World evidence");
});

test("Outside promotion work, out-of-date strain and zero roster dates do not create private grievances", () => {
  const { aggregate, promotion, person, contract } = fixture();
  const state = aggregate.state;
  const other = activeContractsForPromotion(state, promotion.id)
    .find(c => c.personId !== person.id)!;
  other.startDate = { ...contract.startDate };
  other.endDate = { ...contract.endDate };
  other.dateEntitlement = 10;
  other.datesUsed = 0;
  const sourceDate = addPpwWeeks(state.world.currentDate, -1, state.ruleset.weeksPerYear);
  const foreignPromotion = state.promotions.find(p => p.id !== promotion.id)!;
  upsertWrestlerRelationship(state, {personAId: person.id, personBId: other.personId,
    professionalTrust: 58, familiarity: 22});
  state.ledger.push({
    id: "ledger:outside-strain",
    worldId: state.world.id, date: sourceDate, order: state.ledger.length + 1,
    type: WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE,
    significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
    entityIds: [person.id, other.personId].sort(),
    payload: { sourceMatchId: "missing-foreign-match", verifiedShows: 3, trustDelta: -0.6 },
  });
  ok(generateWorkingPartnershipConcerns(aggregate) === 0,
    "another promotion's ledger record created our private backstage concern");
  const event = { ...state.events[0]!, id: "foreign-event", promotionId: foreignPromotion.id,
    date: sourceDate, status: "COMPLETED" as const };
  state.events.push(event);
  const match = { ...state.matches[0]!, id: "missing-foreign-match", eventId: event.id,
    promotionId: foreignPromotion.id, type: "TAG" as const, status: "COMPLETED" as const,
    executionQuality: 25 };
  state.matches.push(match);
  const others = state.people.filter(p => p.id !== person.id && p.id !== other.personId).slice(0, 2);
  state.matchParticipants.push(...[person.id, other.personId, others[0]!.id, others[1]!.id].map((personId, i) => ({
    id: "foreign-strain-p-" + i, worldId: state.world.id, matchId: match.id,
    eventId: event.id, personId, side: i < 2 ? "A" as const : "B" as const, won: false,
  })));
  ok(generateWorkingPartnershipConcerns(aggregate) === 0,
    "foreign promotion's genuine completed match generated an owner-only demand here");
  match.promotionId = promotion.id;
  event.promotionId = promotion.id;
  other.datesUsed = other.dateEntitlement;
  ok(generateWorkingPartnershipConcerns(aggregate) === 0,
    "exhausted finite dates triggered an unfulfillable wrestler request");
  other.datesUsed = 0;
  state.world.currentDate = addPpwWeeks(state.world.currentDate, 2, state.ruleset.weeksPerYear);
  ok(generateWorkingPartnershipConcerns(aggregate) === 0,
    "out-of-date World strain created a delayed concern when no longer relevant");
});


function historicalStrainSetup() {
  const f=fixture(),s=f.aggregate.state;
  f.aggregate.engagement=createWorldEngagementState(s.world.id);
  const cs=activeContractsForPromotion(s,f.promotion.id).slice(0,4);
  ok(cs.length===4,"needs four active wrestlers");
  const old={...s.world.currentDate};
  cs.forEach(c=>{c.endDate=addPpwWeeks(old,120,s.ruleset.weeksPerYear);c.datesUsed=0;c.dateEntitlement=24;});
  const prior=openBackstageConversation(f.aggregate.engagement,{
    conversationId:"old:working:conversation",worldId:s.world.id,promotionId:f.promotion.id,
    wrestlerId:cs[1]!.personId,partnerPersonId:cs[0]!.personId,
    sourceContractId:cs[1]!.id,kind:"WORKING_PARTNERSHIP_CONCERN",
    createdDate:old,status:"OPEN",response:null,responseDate:null,
    promisedRole:null,observedMatchShows:3,observedFeaturedShows:0,
    professionalTrustAtPitch:55,workingTrustDelta:-0.6,workingSourceLedgerId:"old-strain",
  });
  respondBackstageConversationCommand(f.aggregate,{
    requestId:"answer:old-working",worldId:s.world.id,playerId:"backstage-owner",
    commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:prior.conversationId,response:"KEEP_WORKING_PAIR"},
  });
  prior.workingFollowThrough={
    kind:"PARTNERS_REBOOKED",evidenceMatchId:"old:verified:match",
    counterpartPersonId:cs[0]!.personId,executionQuality:74,
    happenedDate:addPpwWeeks(old,3,s.ruleset.weeksPerYear),
    recordedDate:addPpwWeeks(old,4,s.ruleset.weeksPerYear),
  };
  s.world.currentDate=addPpwWeeks(old,56,s.ruleset.weeksPerYear);
  const when=addPpwWeeks(s.world.currentDate,-1,s.ruleset.weeksPerYear);
  when.day=6;
  const eventId="repeat:tag:event",matchId="repeat:tag:match";
  s.events.push({...s.events[0]!,id:eventId,promotionId:f.promotion.id,date:when,
    status:"COMPLETED",matchCount:1});
  s.matches.push({...s.matches[0]!,id:matchId,eventId,promotionId:f.promotion.id,
    status:"COMPLETED",type:"TAG",executionQuality:23});
  s.matchParticipants.push(...cs.map((c,i)=>({
    id:matchId+":participant:"+i,worldId:s.world.id,eventId,matchId,
    personId:c.personId,side:i<2?"A" as const:"B" as const,won:false,
  })));
  for(let i=0;i<2;i++){
    const ids=[cs[2*i]!.personId,cs[2*i+1]!.personId].sort();
    upsertWrestlerRelationship(s,{personAId:ids[0]!,personBId:ids[1]!,
      professionalTrust:i?39:59,familiarity:30});
    s.ledger.push({id:"new:strain:"+i,worldId:s.world.id,date:when,
      order:s.ledger.length+1,type:WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE,
      significanceAtTime:"ROUTINE",historicalSignificance:"ROUTINE",entityIds:ids,
      payload:{sourceMatchId:matchId,verifiedShows:3,trustDelta:-0.6},
    });
  }
  return {f,cs,prior};
}

test("Renewed confirmed working problems take priority and retain the prior speaker and answer",()=>{
  const {f,cs,prior}=historicalStrainSetup();
  const before=JSON.stringify(f.aggregate.state);
  ok(generateWorkingPartnershipConcerns(f.aggregate)===1,
    "one weekly private concern expected");
  const next=f.aggregate.engagement!.backstageConversations.find(c=>
    c.kind==="WORKING_PARTNERSHIP_CONCERN"&&c.conversationId!==prior.conversationId)!;
  ok(next.wrestlerId===cs[1]!.personId&&next.partnerPersonId===cs[0]!.personId,
    "new pair displaced known repeated trouble or the original speaker changed");
  ok(next.continuity?.lastWorkingDecision?.response==="KEEP_WORKING_PAIR"
    &&next.continuity.lastWorkingDecision.observedLaterKind==="PARTNERS_REBOOKED",
    "verified booker history did not survive into next private discussion");
  ok(buildPlayerBackstageView(f.aggregate,"backstage-owner").conversations
    .find(c=>c.conversationId===next.conversationId)?.dialogue.speech
    .includes("keep the pairing"),"history did not affect the request's dialogue");
  ok(generateWorkingPartnershipConcerns(f.aggregate)===0
    &&JSON.stringify(f.aggregate.state)===before,
    "re-reading World resolution changed relationships or duplicated a request");
  ok(cloneApplicationWorld(f.aggregate).engagement?.backstageConversations.some(c=>
    c.conversationId===next.conversationId
      &&c.continuity?.lastWorkingDecision?.observedLaterKind==="PARTNERS_REBOOKED"),
    "saved World lost frozen pair-specific history");
});
test("Unanswered old working concern stays singular; new pair gets temperament-derived speaker",()=>{
  const {f,cs,prior}=historicalStrainSetup();
  prior.status="OPEN";prior.response=null;prior.responseDate=null;prior.workingFollowThrough=undefined;
  const before=JSON.stringify(f.aggregate.state);
  ok(generateWorkingPartnershipConcerns(f.aggregate)===1,
    "independent new pair should still be able to speak");
  const next=f.aggregate.engagement!.backstageConversations.find(c=>
    c.kind==="WORKING_PARTNERSHIP_CONCERN"&&c.conversationId!==prior.conversationId)!;
  const a=cs[2]!.personId,b=cs[3]!.personId;
  ok([a,b].includes(next.wrestlerId)&&[a,b].includes(next.partnerPersonId!),
    "unanswered old pair generated a second grievance");
  const people=[a,b].map(id=>f.aggregate.state.people.find(p=>p.id===id)!);
  ok(next.wrestlerId===chooseCreativePitchSpeaker(people[0]!,people[1]!,"TEAM_PARTNERSHIPS").id,
    "first-time pair speaker ignored stable creative interests");
  ok(next.continuity?.lastWorkingDecision===null,
    "another pair's private history leaked into the new conversation");
  ok(JSON.stringify(f.aggregate.state)===before,
    "conversation priority modified the wrestling simulation");
});


test("Two human bookers see only their own Backstage history in the same shared World",()=>{
  const {aggregate,promotion}=fixture();
  const {state,ownership}=aggregate;
  ownership.humanSeatLimit=2;
  joinPlayerToWorld(ownership,"other-human-owner",state.world.currentDate);
  const other=state.promotions.find(p=>p.id!==promotion.id
    &&p.playerTakeoverEligibility==="STANDARD"&&p.lifecycle==="ACTIVE")!;
  claimIndependentPromotionForPlayer(state,ownership,"other-human-owner",other.id);
  ok(generateBackstageConversations(aggregate)===1,
    "original promotion needs a private Backstage interaction");
  const stored=aggregate.engagement!.backstageConversations[0]!;
  const sibling=buildPlayerBackstageView(aggregate,"other-human-owner");
  ok(sibling.promotionId===other.id &&sibling.openCount===0
    &&sibling.conversations.length===0,
    "another real World controller could read the first promotion's private work");
  ok(!buildPlayerAttention(aggregate,"other-human-owner").some(a=>
    a.attentionId==="backstage:"+stored.conversationId),
    "private concern leaked into another controller's home attention");
  const before=JSON.stringify(aggregate.engagement);
  let blocked=false;
  try{respondBackstageConversationCommand(aggregate,{
    requestId:"other-human-must-not-answer",worldId:state.world.id,
    playerId:"other-human-owner",commandType:"RESPOND_BACKSTAGE_CONVERSATION",
    payload:{conversationId:stored.conversationId,response:"HEAR_OUT"},
  });}catch{blocked=true;}
  ok(blocked&&JSON.stringify(aggregate.engagement)===before,
    "other human controller answered or mutated an unauthorized concern");
});

console.log("\nBackstage lifecycle tests: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;

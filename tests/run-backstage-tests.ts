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
import { activeContractsForPromotion } from "../packages/sim-core/src/index.js";
import { promotionTalentTrustFor } from "../packages/sim-core/src/talent-trust.js";
import { generateTagTeamPitches } from "../packages/application/src/backstage-pitches.js";
import { generateRivalryPitches } from "../packages/application/src/backstage-rivalries.js";
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
  ok(message.kind === "TAG_TEAM_PITCH" && message.partnerPersonId === partnerId
    && message.sharedTagMatches === 2 && message.averageCrowdResponse === 78,
    "positive pitch lacks evidence or correct partner");
  const view = buildPlayerBackstageView(f.aggregate, "backstage-owner");
  ok(view.openCount === 1 && view.conversations[0]?.partnerPersonId === partnerId
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
  ok(message.kind === "RIVALRY_PITCH" && message.rivalPersonId === opponentId
    && message.sharedSinglesMatches === 2 && message.averageCrowdResponse === 82
    && message.professionalTrustAtPitch === 78, "rivalry proposal lost frozen evidence");
  const view = buildPlayerBackstageView(f.aggregate, "backstage-owner");
  ok(view.conversations[0]?.rivalPersonId === opponentId && !!view.conversations[0]?.rivalName
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

console.log("\nBackstage lifecycle tests: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;

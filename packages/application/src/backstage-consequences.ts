/**
 * Conservative, authoritative follow-through consequences for promises deliberately
 * made by a human booker. Separated from factual evaluation so views/read retries
 * do not apply effects. World resolution calls this once after completed results
 * have been frozen.
 */
import { addPpwWeeks, comparePpwDates } from "../../sim-core/src/clock.js";
import { promotionTalentTrustFor } from "../../sim-core/src/talent-trust.js";
import { activePromotionControlForPromotion } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";
import type {
  BackstageBookingPromise,
  BackstageConversation,
  BackstagePromiseReason,
} from "./engagement.js";

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function injuryOverlapsPromise(
  aggregate: ApplicationWorldAggregate,
  conversation: BackstageConversation,
  promise: BackstageBookingPromise,
): boolean {
  const state = aggregate.state;
  return state.injuries.some((injury) => {
    if (injury.personId !== conversation.wrestlerId) return false;
    const end = addPpwWeeks(injury.date, injury.weeksOut, state.ruleset.weeksPerYear);
    return comparePpwDates(injury.date, promise.dueDate, state.ruleset.weeksPerYear) <= 0
      && comparePpwDates(end, promise.madeDate, state.ruleset.weeksPerYear) >= 0;
  });
}

function assessmentReason(
  aggregate: ApplicationWorldAggregate,
  conversation: BackstageConversation,
  promise: BackstageBookingPromise,
): BackstagePromiseReason {
  if (promise.status === "FULFILLED") return "COMMITMENT_KEPT";
  if (promise.status === "NO_OPPORTUNITY") return "NO_COMPLETED_SHOW";

  // A missed appearance is not a booker's breach where wrestling became
  // physically impossible or the signed commitment disappeared.
  const person = aggregate.state.people.find((entry) => entry.id === conversation.wrestlerId);
  if (!person || person.status === "RETIRED") return "WRESTLER_UNAVAILABLE";
  if (injuryOverlapsPromise(aggregate, conversation, promise)) return "WRESTLER_INJURED";

  const contract = aggregate.state.contracts.find((entry) => entry.id === conversation.sourceContractId);
  if (!contract || contract.status === "TERMINATED") return "CONTRACT_TERMINATED";

  const controller = activePromotionControlForPromotion(aggregate.ownership, conversation.promotionId);
  if (!controller) return "PROMOTION_UNCONTROLLED";
  const activity = aggregate.engagement?.playerActivity.find((entry) => entry.playerId === controller.playerId);
  if (activity?.status === "STEWARDED") return "OWNER_STEWARDED";

  return "COMMITMENT_BROKEN";
}

/**
 * Exactly one historical decision per resolved promise.
 *
 * No rewards for opening the game or promising a push. Real booking already
 * affects morale elsewhere. Only an unexcused broken word creates a small
 * additional negative signal. Scope trust to the promotion/person relationship;
 * never affect other promotions, contracts or on-screen scripting.
 */
export function applyBackstagePromiseConsequences(
  aggregate: ApplicationWorldAggregate,
): number {
  const state = aggregate.state;
  let assessed = 0;
  for (const conversation of aggregate.engagement?.backstageConversations ?? []) {
    const promise = conversation.promise;
    if (!promise || promise.status === "PENDING" || promise.consequence) continue;
    if (conversation.response !== "PROMISE_FEATURED_BOOKING") continue;

    const reason = assessmentReason(aggregate, conversation, promise);
    let trustDelta = 0;
    let moraleDelta = 0;

    if (reason === "COMMITMENT_BROKEN") {
      const person = state.people.find((entry) => entry.id === conversation.wrestlerId)!;
      const pair = promotionTalentTrustFor(state, conversation.promotionId, conversation.wrestlerId);
      const trustBefore = pair.trust;
      const moraleBefore = person.morale;
      // The roster's existing role priority affects the seriousness of a
      // player's promise, without creating a new personality stat.
      const sensitivity = Math.round(1.5 + clamp(person.priorities.role, 0, 100) / 50);
      const trustLoss = clamp(sensitivity, 2, 4);
      pair.trust = rounded(clamp(pair.trust - trustLoss, 0, 100));
      person.morale = rounded(clamp(person.morale - 1, 5, 95));
      trustDelta = rounded(pair.trust - trustBefore);
      moraleDelta = rounded(person.morale - moraleBefore);
    } else if (promise.status === "NOT_DELIVERED") {
      promise.status = "EXCUSED";
    }

    promise.consequence = {
      assessedDate: { ...state.world.currentDate },
      reason,
      trustDelta,
      moraleDelta,
    };
    assessed += 1;
  }
  return assessed;
}

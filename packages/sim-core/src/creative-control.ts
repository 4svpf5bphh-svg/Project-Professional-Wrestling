import type { Contract, CreativeControlLevel, Person, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates } from "./clock.js";
import { contractsForPerson } from "./indexes.js";

/**
 * Creative control is a contracted right, not a hidden AI ability to rewrite
 * a promoter's scripted finishes or character presentation.
 *
 * NONE: ordinary wrestling expectations and wrestler-owned gimmick resistance.
 * CONSULTATION: concerns can be raised; no contractual veto.
 * PROTECTED_FINISHES: approve clean/submission losses before World Lock.
 * FULL_APPROVAL: approve match assignment, loss/finish and repackaging.
 *
 * A separate approval/waiver workflow must exist before paid offers with
 * blocking control levels are exposed in the player contract editor.
 */
export const CREATIVE_CONTROL_LEVELS = [
  "NONE", "CONSULTATION", "PROTECTED_FINISHES", "FULL_APPROVAL",
] as const satisfies readonly CreativeControlLevel[];

export function resolvedCreativeControl(level: CreativeControlLevel | null | undefined): CreativeControlLevel {
  return level ?? "NONE";
}

export function validCreativeControl(level: unknown): level is CreativeControlLevel {
  return CREATIVE_CONTROL_LEVELS.includes(level as CreativeControlLevel);
}

/** Fictional priorities: a desire for role/schedule autonomy, not a real personality claim. */
export function creativeControlOfferBonus(person: Person, level: CreativeControlLevel | null | undefined): number {
  const strength = resolvedCreativeControl(level);
  if (strength === "NONE") return 0;
  const priority = person.priorities;
  const total = priority.money + priority.role + priority.prestige
    + priority.schedule + priority.loyalty + priority.exposure;
  const autonomyWeight = total > 0 ? (priority.role + priority.schedule) / total : 1 / 3;
  const multiplier = Math.max(0.85, Math.min(1.2, 0.9 + autonomyWeight * 0.45));
  // Deliberately significant: a credible alternative to a higher cash offer,
  // while never an automatic acceptance guarantee.
  const baseline = strength === "CONSULTATION" ? 5
    : strength === "PROTECTED_FINISHES" ? 12 : 20;
  return Math.round(baseline * multiplier * 10) / 10;
}

/**
 * Monetary credibility limits what a non-cash creative concession can buy.
 * It can improve an otherwise credible deal but cannot rescue an exploitative
 * zero-pay offer. Both player and AI bids use this exact function; no special
 * rival acceptance rules or hidden competitive bonus.
 *
 * moneyScore is the existing bounded 0–100 score in evaluateContractOffer.
 */
export function credibleCreativeControlOfferBonus(
  person: Person,
  level: CreativeControlLevel | null | undefined,
  moneyScore: number,
  family: Contract["family"],
  termWeeks: number,
): number {
  if (!Number.isFinite(moneyScore) || !Number.isSafeInteger(termWeeks) || termWeeks < 1) {
    throw new Error("creative bargaining needs valid money score and contract term");
  }
  const base = creativeControlOfferBonus(person, level);
  // The first 20 monetary points carry almost no credibility. A market-
  // reasonable package (moneyScore >= 50) receives the full rights valuation.
  const cashCredibility = Math.max(0.2, Math.min(1, (moneyScore - 20) / 30));
  // A week's creative promise is not as valuable as a continuing agreement.
  const termCredibility = family === "ONE_OFF" ? 0.35 : Math.min(1, 0.65 + termWeeks * 0.035);
  return Math.round(base * cashCredibility * termCredibility * 10) / 10;
}

/**
 * A cautious, transparent policy for AI-controlled promoters. Top-billed
 * talent may bargain for real protections just as on human offers; the AI
 * receives the same cost in future booking resistance, not a free rating.
 * This never rewrites pay, adds new dates or changes the wrestler's answer.
 */
export function suggestedAiCreativeControl(
  person: Person,
  promotion: Pick<import("../../domain/src/types.js").Promotion,
    "tier" | "financialDistress" | "aiProfile">,
  terms: Pick<Contract, "family" | "roleExpectation">,
): CreativeControlLevel {
  if (terms.family === "ONE_OFF" || promotion.financialDistress === "CRISIS") return "NONE";
  const star = (person.recognition + person.popularity + person.skills.presentation) / 3;
  const role = terms.roleExpectation === "MAIN_EVENT" || terms.roleExpectation === "SPECIAL_ATTRACTION";
  const premiumPromotion = promotion.tier === "GLOBAL" || promotion.tier === "NATIONAL";
  const autonomy = person.priorities.role + person.priorities.schedule;
  if (premiumPromotion && role && terms.family === "EXCLUSIVE"
    && star >= 82 && person.priorities.role >= person.priorities.money * 1.45
    && promotion.aiProfile.financialCaution < 55
    && promotion.financialDistress === "HEALTHY") {
    return "FULL_APPROVAL";
  }
  if (premiumPromotion && role && star >= 68 && autonomy >= person.priorities.money
    && promotion.financialDistress !== "DISTRESSED") {
    return "PROTECTED_FINISHES";
  }
  if (star >= 55 && autonomy >= person.priorities.money * 0.8
    && promotion.financialDistress !== "DISTRESSED") return "CONSULTATION";
  return "NONE";
}

export interface CreativeBookingProposal {
  /** Is this wrestler among the losing side of the match? */
  loses: boolean;
  /** Finish categories where a loss is clean or a submission. */
  cleanOrSubmission: boolean;
  /** Proposal changes the wrestler-owned gimmick, beyond normal presentation. */
  repackaging: boolean;
}

export type CreativeBookingReviewReason = "CONSULTATION_REQUESTED" | "PROTECTED_LOSS" | "MATCH_APPROVAL" | "GIMMICK_APPROVAL";

export interface CreativeBookingReview {
  reasons: CreativeBookingReviewReason[];
  requiresConsent: boolean;
}

/** Pure audit of the rights a proposed *player-authored* booking would engage. */
export function creativeBookingReview(
  level: CreativeControlLevel | null | undefined,
  proposal: CreativeBookingProposal,
): CreativeBookingReview {
  const rights = resolvedCreativeControl(level);
  if (rights === "NONE") return { reasons: [], requiresConsent: false };
  if (rights === "CONSULTATION") {
    // Ordinary routine bookings must not spam the player's Desk. Ask for an
    // opinion only when an important loss or identity change is proposed.
    const significant = proposal.repackaging || (proposal.loses && proposal.cleanOrSubmission);
    return { reasons: significant ? ["CONSULTATION_REQUESTED"] : [], requiresConsent: false };
  }
  if (rights === "PROTECTED_FINISHES") {
    const protectedLoss = proposal.loses && proposal.cleanOrSubmission;
    return { reasons: protectedLoss ? ["PROTECTED_LOSS"] : [], requiresConsent: protectedLoss };
  }
  return {
    reasons: proposal.repackaging ? ["MATCH_APPROVAL", "GIMMICK_APPROVAL"] : ["MATCH_APPROVAL"],
    requiresConsent: true,
  };
}

/**
 * Unified fictional booking-approval score for human requests and automated
 * booking. No real-world personality claims; changes are based on World state.
 * The proposed reason is important: an objection to a protected loss is harder
 * to clear than an ordinary match assignment.
 */
export function creativeBookingDecisionScore(
  person: Person,
  contract: Contract,
  reason: CreativeBookingReviewReason,
): number {
  const importance = contract.roleExpectation === "MAIN_EVENT" || contract.roleExpectation === "SPECIAL_ATTRACTION" ? 13
    : contract.roleExpectation === "UPPER_CARD" ? 8 : 3;
  const protectedLoss = reason === "PROTECTED_LOSS";
  const raw = 67 + (person.morale - 50) * 0.38
    + (person.priorities.loyalty - person.priorities.role) * 0.08
    - person.fatigue * 0.09
    - (protectedLoss ? importance + 13 : importance * 0.45);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Shared acceptance threshold; no random retries or faster-online advantage. */
export function creativeBookingAgreed(score: number): boolean {
  return score >= 55;
}

const CREATIVE_RIGHTS_WEIGHT = { NONE: 0, CONSULTATION: 1, PROTECTED_FINISHES: 2, FULL_APPROVAL: 3 } as const;

/**
 * Use the strongest overlapping signed right for this person and promotion.
 * Neither staff nor a player can evade protection by selecting another
 * appearance agreement with weaker creative language.
 */
export function applicableCreativeContract(
  state: WorldState,
  promotionId: string,
  personId: string,
  date: PpwDate,
): Contract | null {
  return contractsForPerson(state, personId)
    .filter((contract) => contract.promotionId === promotionId && contract.status === "SIGNED"
      && comparePpwDates(date, contract.startDate, state.ruleset.weeksPerYear) >= 0
      && comparePpwDates(date, contract.endDate, state.ruleset.weeksPerYear) <= 0)
    .sort((a, b) => CREATIVE_RIGHTS_WEIGHT[resolvedCreativeControl(b.creativeControl)]
      - CREATIVE_RIGHTS_WEIGHT[resolvedCreativeControl(a.creativeControl)]
      || a.id.localeCompare(b.id))[0] ?? null;
}

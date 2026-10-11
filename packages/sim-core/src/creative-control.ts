import type { CreativeControlLevel, Person } from "../../domain/src/types.js";

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
    return { reasons: ["CONSULTATION_REQUESTED"], requiresConsent: false };
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

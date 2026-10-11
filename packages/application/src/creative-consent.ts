import type { Contract, Id, MatchSide, Person, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates } from "../../sim-core/src/clock.js";
import {
  creativeBookingReview,
  resolvedCreativeControl,
  type CreativeBookingReviewReason,
} from "../../sim-core/src/creative-control.js";
import { defaultPlannedFinishForIntent } from "../../sim-core/src/match-finishes.js";
import type { DetailedMatchDraft, DetailedShowDraft, WorldPlanningState } from "./planning.js";

/**
 * Consent is an explicit wrestler decision about a PARTICULAR promoter-authored
 * booking. It is never permission to rewrite the script at World Lock.
 * Stored in the planning aggregate so it participates in the same World transaction.
 */
export interface CreativeConsentRecord {
  worldId: Id;
  promotionId: Id;
  draftId: string;
  draftMatchId: string;
  personId: Id;
  contractId: Id;
  bookingSignature: string;
  requestedPlanVersion: number;
  decidedDate: PpwDate;
  decision: "APPROVED" | "DECLINED";
  score: number;
}

export interface CreativeBookingConcern {
  promotionId: Id;
  draftId: string;
  draftMatchId: string;
  personId: Id;
  contractId: Id;
  reason: CreativeBookingReviewReason;
  requiresConsent: boolean;
  consent: "APPROVED" | "DECLINED" | "NOT_REQUESTED";
  bookingSignature: string;
}

function contractCovers(state: WorldState, contract: Contract, date: PpwDate): boolean {
  return contract.status === "SIGNED"
    && comparePpwDates(date, contract.startDate, state.ruleset.weeksPerYear) >= 0
    && comparePpwDates(date, contract.endDate, state.ruleset.weeksPerYear) <= 0;
}

const CONTROL_WEIGHT = { NONE: 0, CONSULTATION: 1, PROTECTED_FINISHES: 2, FULL_APPROVAL: 3 } as const;

/** A stronger live clause cannot be evaded by selecting a weaker overlapping contract. */
function applicableContract(state: WorldState, promotionId: Id, personId: Id, date: PpwDate): Contract | null {
  return state.contracts
    .filter((contract) => contract.promotionId === promotionId && contract.personId === personId
      && contractCovers(state, contract, date))
    .sort((a, b) => CONTROL_WEIGHT[resolvedCreativeControl(b.creativeControl)]
      - CONTROL_WEIGHT[resolvedCreativeControl(a.creativeControl)] || a.id.localeCompare(b.id))[0] ?? null;
}

function matchSignature(draft: DetailedShowDraft, match: DetailedMatchDraft, personId: Id, contractId: Id): string {
  // Explicit fields (including style / interference and the full opposing side)
  // ensure a previously granted waiver cannot silently follow a rewritten card.
  return JSON.stringify({
    promotionId: draft.promotionId, draftId: draft.draftId, targetDate: draft.targetDate,
    personId, contractId, draftMatchId: match.draftMatchId,
    type: match.type, sideAIds: match.sideAIds, sideBIds: match.sideBIds,
    intendedWinnerSide: match.intendedWinnerSide, intent: match.intent,
    plannedFinish: match.plannedFinish ?? (match.intent ? defaultPlannedFinishForIntent(match.intent) : null),
    plannedLengthMinutes: match.plannedLengthMinutes,
    style: match.style ?? null, interfererPersonId: match.interfererPersonId ?? null,
    interferenceSide: match.interferenceSide ?? null,
    interferenceOutcome: match.interferenceOutcome ?? null,
  });
}

function matchConcerns(
  state: WorldState,
  planning: WorldPlanningState,
  draft: DetailedShowDraft,
  match: DetailedMatchDraft,
): CreativeBookingConcern[] {
  if (match.intendedWinnerSide === null || match.intent === null) return [];
  const finish = match.plannedFinish ?? defaultPlannedFinishForIntent(match.intent);
  const cleanOrSubmission = finish === "CLEAN_PIN" || finish === "SUBMISSION";
  const sides: { personId: Id; side: MatchSide }[] = [
    ...match.sideAIds.map((personId) => ({ personId, side: "A" as const })),
    ...match.sideBIds.map((personId) => ({ personId, side: "B" as const })),
  ];
  const result: CreativeBookingConcern[] = [];
  for (const { personId, side } of sides) {
    const contract = applicableContract(state, draft.promotionId, personId, draft.targetDate);
    if (!contract) continue;
    const review = creativeBookingReview(contract.creativeControl, {
      loses: side !== match.intendedWinnerSide, cleanOrSubmission, repackaging: false,
    });
    const bookingSignature = matchSignature(draft, match, personId, contract.id);
    const approval = (planning.creativeConsents ?? []).find((entry) => (
      entry.worldId === state.world.id && entry.promotionId === draft.promotionId
      && entry.draftId === draft.draftId && entry.draftMatchId === match.draftMatchId
      && entry.personId === personId && entry.contractId === contract.id
      && entry.bookingSignature === bookingSignature
    ));
    for (const reason of review.reasons) {
      result.push({
        promotionId: draft.promotionId, draftId: draft.draftId,
        draftMatchId: match.draftMatchId, personId, contractId: contract.id,
        reason, requiresConsent: review.requiresConsent,
        consent: approval?.decision ?? "NOT_REQUESTED", bookingSignature,
      });
    }
  }
  return result;
}

/** Read-only: show and card editors may display concerns without creating consent. */
export function creativeConcernsForDraft(
  state: WorldState,
  planning: WorldPlanningState,
  draft: DetailedShowDraft,
): CreativeBookingConcern[] {
  if (planning.worldId !== state.world.id) throw new Error("creative consent crosses World boundary");
  if (!state.promotions.some((promotion) => promotion.id === draft.promotionId)) {
    throw new Error("creative consent references unknown promotion");
  }
  return draft.matches.flatMap((match) => matchConcerns(state, planning, draft, match));
}

/** An unresolved blocking issue affects this card only; consultation never blocks. */
export function creativeBlockersForDraft(
  state: WorldState,
  planning: WorldPlanningState,
  draft: DetailedShowDraft,
): CreativeBookingConcern[] {
  return creativeConcernsForDraft(state, planning, draft)
    .filter((concern) => concern.requiresConsent && concern.consent !== "APPROVED");
}

function decisionScore(person: Person, contract: Contract, concern: CreativeBookingConcern): number {
  // Fictional game-state resistance. No guesses about real-world personalities.
  // No RNG and no benefit to repeatedly requesting the identical waiver.
  const importance = contract.roleExpectation === "MAIN_EVENT" || contract.roleExpectation === "SPECIAL_ATTRACTION" ? 13
    : contract.roleExpectation === "UPPER_CARD" ? 8 : 3;
  const protectedLoss = concern.reason === "PROTECTED_LOSS";
  const raw = 67 + (person.morale - 50) * 0.38
    + (person.priorities.loyalty - person.priorities.role) * 0.08
    - person.fatigue * 0.09
    - (protectedLoss ? importance + 13 : importance * 0.45);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Request one wrestler's agreement to an already saved, fully authored match.
 * Retries return the same result. Draft edits invalidate the signature; stale
 * workspace-version requests are rejected rather than approving a new script.
 * Caller MUST enforce World Lock, membership and promotion ownership.
 */
export function requestCreativeBookingConsent(
  state: WorldState,
  planning: WorldPlanningState,
  input: {
    promotionId: Id;
    draftId: string;
    draftMatchId: string;
    personId: Id;
    expectedPlanVersion: number;
  },
): CreativeConsentRecord {
  if (planning.worldId !== state.world.id) throw new Error("creative consent crosses World boundary");
  const workspace = planning.workspaces.find((entry) => entry.promotionId === input.promotionId);
  if (!workspace || !Number.isSafeInteger(input.expectedPlanVersion)
    || workspace.version !== input.expectedPlanVersion) throw new Error("stale creative consent plan version");
  const draft = workspace.detailedShowDrafts.find((entry) => entry.draftId === input.draftId);
  if (!draft || draft.promotionId !== input.promotionId) throw new Error("creative consent draft not found");
  if (comparePpwDates(draft.targetDate, state.world.currentDate, state.ruleset.weeksPerYear) < 0) {
    throw new Error("cannot grant creative consent to a past show");
  }
  const match = draft.matches.find((entry) => entry.draftMatchId === input.draftMatchId);
  if (!match || match.intendedWinnerSide === null || match.intent === null || match.plannedLengthMinutes === null) {
    throw new Error("creative consent requires a completed authored match");
  }
  const concern = matchConcerns(state, planning, draft, match).find((entry) => (
    entry.personId === input.personId && entry.requiresConsent
  ));
  if (!concern) throw new Error("wrestler has no blocking approval right for this booking");
  const existing = (planning.creativeConsents ?? []).find((entry) => (
    entry.promotionId === input.promotionId && entry.draftId === input.draftId
    && entry.draftMatchId === input.draftMatchId && entry.personId === input.personId
    && entry.contractId === concern.contractId && entry.bookingSignature === concern.bookingSignature
  ));
  if (existing) return structuredClone(existing);

  const person = state.people.find((entry) => entry.id === input.personId);
  const contract = state.contracts.find((entry) => entry.id === concern.contractId);
  if (!person || !contract) throw new Error("creative consent wrestler or contract unavailable");
  const score = decisionScore(person, contract, concern);
  const consent: CreativeConsentRecord = {
    worldId: state.world.id, promotionId: input.promotionId,
    draftId: input.draftId, draftMatchId: input.draftMatchId, personId: input.personId,
    contractId: contract.id, bookingSignature: concern.bookingSignature,
    requestedPlanVersion: workspace.version, decidedDate: { ...state.world.currentDate },
    decision: score >= 55 ? "APPROVED" : "DECLINED", score,
  };
  planning.creativeConsents ??= [];
  // Only the latest decision for a given booking/person survives in stored state.
  planning.creativeConsents = planning.creativeConsents.filter((entry) => !(
    entry.promotionId === input.promotionId && entry.draftId === input.draftId
    && entry.draftMatchId === input.draftMatchId && entry.personId === input.personId
  ));
  planning.creativeConsents.push(consent);
  return structuredClone(consent);
}

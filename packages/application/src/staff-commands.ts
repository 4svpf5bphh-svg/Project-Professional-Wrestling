import type { ContractOffer, Id, WorldState } from "../../domain/src/types.js";
import type { StaffEmployment } from "../../domain/src/staff.js";
import { resolvedCreativeControl } from "../../sim-core/src/creative-control.js";
import { addPpwWeeks, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { contractIsActive } from "../../sim-core/src/contracts.js";
import { submitHumanContractOffer, type HumanContractOfferPlan } from "../../sim-core/src/human-contracts.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import { activeTalentManager } from "../../sim-core/src/staff.js";
import { sameTermsRenewalTemplate } from "./contract-renewal.js";
import { executeIdempotentCommand, type ApplicationCommandEnvelope, type WorldCommandState } from "./commands.js";
import { activeWorldMembership, playerControlsPromotion, type WorldOwnershipState } from "./ownership.js";
import type { WorldRuntimeState } from "./runtime.js";

export interface HireStaffPayload {
  promotionId: Id;
  staffId: Id;
}
export interface ReleaseStaffPayload {
  promotionId: Id;
  employmentId: Id;
}
export interface AuthoriseStaffRenewalPayload {
  promotionId: Id;
  staffEmploymentId: Id;
  sourceContractId: Id;
  plan: HumanContractOfferPlan;
}

function assertPlayerEmployer(
  state: WorldState, ownership: WorldOwnershipState,
  envelope: ApplicationCommandEnvelope<unknown>, promotionId: Id,
): void {
  if (state.world.id !== envelope.worldId || ownership.worldId !== envelope.worldId) {
    throw new Error("staff command crosses World");
  }
  if (!activeWorldMembership(ownership, envelope.playerId)
    || !playerControlsPromotion(ownership, envelope.playerId, promotionId)) {
    throw new Error("only the controlling player may manage promotion staff");
  }
  const promotion = state.promotions.find(row => row.id === promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN"
    || promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") {
    throw new Error("promotion is not eligible to employ staff");
  }
}

/** Straightforward hire at the public asking wage, without negotiation in MVP. */
export function hireStaffCommand(
  state: WorldState, ownership: WorldOwnershipState,
  commands: WorldCommandState, runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<HireStaffPayload>,
): StaffEmployment {
  if (envelope.commandType !== "HIRE_STAFF") throw new Error("expected HIRE_STAFF");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    assertPlayerEmployer(state, ownership, envelope, envelope.payload.promotionId);
    const staff = (state.staffMembers ?? []).find(row => row.id === envelope.payload.staffId);
    if (!staff || staff.specialty !== "TALENT_MANAGER") throw new Error("unknown available Talent Manager");
    if ((state.staffEmployments ?? []).some(row => row.status === "ACTIVE" && row.staffId === staff.id)) {
      throw new Error("this manager already works for another promotion");
    }
    if (activeTalentManager(state, envelope.payload.promotionId)) {
      throw new Error("your promotion already employs a Talent Manager");
    }
    const employer = state.promotions.find(row => row.id === envelope.payload.promotionId)!;
    if (employer.cash < staff.requestedWeeklySalary * 4) {
      throw new Error("promotion needs four weeks of staff salary available before hiring");
    }
    // Historic employment rows are retained, so this World-local monotonic ID
    // cannot be reused after release. Atomic repository transactions serialize it.
    const employment: StaffEmployment = {
      id: `staff-employment-${String((state.staffEmployments ?? []).length + 1).padStart(7, "0")}`,
      worldId: state.world.id,
      staffId: staff.id,
      promotionId: employer.id,
      role: "TALENT_MANAGER",
      status: "ACTIVE",
      startDate: { ...state.world.currentDate },
      endedDate: null,
      weeklySalary: staff.requestedWeeklySalary,
    };
    (state.staffEmployments ??= []).push(employment);
    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: "TALENT_MANAGER_HIRED",
      significance: "ROUTINE",
      entityIds: [employer.id, staff.id, employment.id],
      payload: { weeklySalary: employment.weeklySalary },
    });
    return employment;
  });
}

export function releaseStaffCommand(
  state: WorldState, ownership: WorldOwnershipState,
  commands: WorldCommandState, runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<ReleaseStaffPayload>,
): StaffEmployment {
  if (envelope.commandType !== "RELEASE_STAFF") throw new Error("expected RELEASE_STAFF");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    assertPlayerEmployer(state, ownership, envelope, envelope.payload.promotionId);
    const employment = (state.staffEmployments ?? []).find(row =>
      row.id === envelope.payload.employmentId && row.promotionId === envelope.payload.promotionId);
    if (!employment || employment.status !== "ACTIVE") throw new Error("no active staff employment to release");
    employment.status = "ENDED";
    employment.endedDate = { ...state.world.currentDate };
    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: "TALENT_MANAGER_RELEASED",
      significance: "ROUTINE",
      entityIds: [employment.promotionId, employment.staffId, employment.id],
      payload: {},
    });
    return employment;
  });
}

/**
 * Player authorises one exact same-terms renewal; staff merely delivers it.
 * Normal independent wrestler acceptance/competition is unchanged.
 */
export function authoriseStaffRenewalCommand(
  state: WorldState, ownership: WorldOwnershipState,
  commands: WorldCommandState, runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<AuthoriseStaffRenewalPayload>,
): ContractOffer {
  if (envelope.commandType !== "AUTHORISE_TALENT_MANAGER_RENEWAL") {
    throw new Error("expected AUTHORISE_TALENT_MANAGER_RENEWAL");
  }
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    assertPlayerEmployer(state, ownership, envelope, envelope.payload.promotionId);
    const manager = activeTalentManager(state, envelope.payload.promotionId);
    if (!manager || manager.employment.id !== envelope.payload.staffEmploymentId) {
      throw new Error("this manager is no longer employed by your promotion");
    }
    const contract = state.contracts.find(row =>
      row.id === envelope.payload.sourceContractId && row.promotionId === envelope.payload.promotionId);
    if (!contract || !contractIsActive(state, contract)) {
      throw new Error("renewal needs an active contract with this promotion");
    }
    const template = sameTermsRenewalTemplate(state, contract);
    const plan = envelope.payload.plan;
    const currentWeek = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
    const endWeek = ppwDateToWeekIndex(contract.endDate, state.ruleset.weeksPerYear);
    const datesExhausted = contract.family === "LIMITED_NON_EXCLUSIVE"
      && contract.datesUsed >= contract.dateEntitlement;
    if (!datesExhausted && endWeek - currentWeek > state.ruleset.renewalWindowWeeks) {
      throw new Error("contract is not within its renewal window");
    }
    const expectedStart = datesExhausted
      ? { ...addPpwWeeks(state.world.currentDate, 1, state.ruleset.weeksPerYear), day: 1 }
      : addPpwWeeks(contract.endDate, 1, state.ruleset.weeksPerYear);
    const expectedEnd = template
      ? addPpwWeeks(expectedStart, template.termWeeks - 1, state.ruleset.weeksPerYear)
      : null;
    const sameDate = (left: typeof expectedStart, right: typeof expectedStart): boolean => (
      left.year === right.year && left.week === right.week && left.day === right.day
    );
    if (!template
      || plan.sourceContractId !== contract.id || plan.personId !== contract.personId
      || plan.promotionId !== contract.promotionId
      || plan.family !== template.family || plan.roleExpectation !== template.roleExpectation
      || resolvedCreativeControl(plan.creativeControl) !== template.creativeControl
      || plan.dateEntitlement !== template.dateEntitlement
      || plan.weeklyGuarantee !== template.weeklyGuarantee
      || plan.appearanceFee !== template.appearanceFee || plan.signingBonus !== 0
      || !sameDate(plan.startDate, expectedStart)
      || !expectedEnd || !sameDate(plan.endDate, expectedEnd)) {
      throw new Error("staff renewal must match active recurring contract terms exactly");
    }
    // The application command also independently verifies the canonical dates;
    // the general wrestler resolver still applies consent and capacity normally.
    return submitHumanContractOffer(state, plan);
  });
}

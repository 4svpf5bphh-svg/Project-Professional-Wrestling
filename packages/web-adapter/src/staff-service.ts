import { transactWithReceiptIds, type ApplicationWorldRepository } from "../../application/src/world-aggregate.js";
import {
  activePromotionControlForPlayer,
  authoriseStaffRenewalCommand,
  submitContractDatesAddendumCommand,
  STAFF_DATES_MAX_PER_OFFER,
  STAFF_DATES_PAYMENT_CAP,
  buildPlayerStaffView,
  hireStaffCommand,
  releaseStaffCommand,
  type AuthoriseStaffRenewalPayload,
  type PlayerStaffView,
} from "../../application/src/index.js";
import { activeTalentManager } from "../../sim-core/src/staff.js";
import { sameTermsRenewalTemplate } from "../../application/src/contract-renewal.js";
import { buildFreshPlan, type AlphaTalentOfferRequest } from "./talent-service.js";
import type { HumanDatesAddendumPlan } from "../../sim-core/src/human-contracts.js";

export interface StaffActionRequest {
  requestId: string;
  staffId?: string;
  employmentId?: string;
  sourceContractId?: string;
  additionalDates?: number;
  additionalPayment?: number;
}
export interface StaffActionResult {
  view: PlayerStaffView;
  offerId?: string;
}
function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 256) {
    throw new Error(`${label} must be a non-empty ID`);
  }
  return value.trim();
}
export async function loadAlphaStaff(
  repository: ApplicationWorldRepository, worldId: string, playerId: string,
): Promise<PlayerStaffView> {
  return buildPlayerStaffView(
    await (repository.loadTalentView?.(worldId) ?? repository.load(worldId)), playerId,
  );
}

export async function hireAlphaTalentManager(
  repository: ApplicationWorldRepository, worldId: string, playerId: string, request: StaffActionRequest,
): Promise<StaffActionResult> {
  const requestId = required(request.requestId, "requestId");
  const staffId = required(request.staffId, "staffId");
  const { result } = await transactWithReceiptIds(repository, worldId, null, [requestId], aggregate => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("control a promotion to hire staff");
    hireStaffCommand(aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime, {
      worldId, playerId, requestId, commandType: "HIRE_STAFF",
      payload: { promotionId: control.promotionId, staffId },
    });
    return { view: buildPlayerStaffView(aggregate, playerId) };
  });
  return result;
}

export async function releaseAlphaTalentManager(
  repository: ApplicationWorldRepository, worldId: string, playerId: string, request: StaffActionRequest,
): Promise<StaffActionResult> {
  const requestId = required(request.requestId, "requestId");
  const employmentId = required(request.employmentId, "employmentId");
  const { result } = await transactWithReceiptIds(repository, worldId, null, [requestId], aggregate => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("control a promotion to release staff");
    releaseStaffCommand(aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime, {
      worldId, playerId, requestId, commandType: "RELEASE_STAFF",
      payload: { promotionId: control.promotionId, employmentId },
    });
    return { view: buildPlayerStaffView(aggregate, playerId) };
  });
  return result;
}

/** No client-provided contract money. Read same terms and player permission
 * from this repository transaction, then use the standard human contract
 * resolver. A receipt carries the authorising player and manager identity. */
export async function authoriseAlphaTalentManagerRenewal(
  repository: ApplicationWorldRepository, worldId: string, playerId: string, request: StaffActionRequest,
): Promise<StaffActionResult> {
  const requestId = required(request.requestId, "requestId");
  const sourceContractId = required(request.sourceContractId, "sourceContractId");
  const { result } = await transactWithReceiptIds(repository, worldId, null, [requestId], aggregate => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("control a promotion to renew talent");
    const prior = aggregate.commands.receipts.find(row => row.requestId === requestId);
    let payload: AuthoriseStaffRenewalPayload;
    if (prior) {
      if (prior.playerId !== playerId || prior.commandType !== "AUTHORISE_TALENT_MANAGER_RENEWAL") {
        throw new Error("requestId was previously used for a different operation");
      }
      payload = JSON.parse(prior.canonicalPayload) as AuthoriseStaffRenewalPayload;
      if (payload.sourceContractId !== sourceContractId || payload.promotionId !== control.promotionId) {
        throw new Error("requestId was previously used for another contract or promotion");
      }
    } else {
      const manager = activeTalentManager(aggregate.state, control.promotionId);
      if (!manager) throw new Error("hire a Talent Manager before delegating a renewal");
      const source = aggregate.state.contracts.find(row =>
        row.id === sourceContractId && row.promotionId === control.promotionId);
      if (!source) throw new Error("the contract is not on your roster");
      // Staff eligibility must agree with the player-facing renewal queue,
      // including already-signed future agreements and pending offers.
      const eligible = buildPlayerStaffView(aggregate, playerId).renewals.some(row =>
        row.contractId === source.id && row.personId === source.personId);
      if (!eligible) throw new Error("this contract is not eligible for a Talent Manager renewal");
      const template = sameTermsRenewalTemplate(aggregate.state, source);
      if (!template) throw new Error("this contract requires manual renewal terms");
      const fresh: AlphaTalentOfferRequest = {
        requestId, personId: source.personId, sourceContractId: source.id, ...template,
      };
      payload = {
        promotionId: control.promotionId,
        staffEmploymentId: manager.employment.id,
        sourceContractId,
        plan: buildFreshPlan(aggregate, control.promotionId, fresh),
      };
    }
    const offer = authoriseStaffRenewalCommand(
      aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime,
      { worldId, playerId, requestId, commandType: "AUTHORISE_TALENT_MANAGER_RENEWAL", payload },
    );
    return { offerId: offer.id, view: buildPlayerStaffView(aggregate, playerId) };
  });
  return result;
}

/**
 * One player-approved, bounded offer delivered by a Talent Manager. Use the
 * standard additional-dates command and wrestler consent resolver: no staff
 * signing power, automatic reoffers or parallel contract system.
 */
export async function authoriseAlphaTalentManagerDatesAddendum(
  repository: ApplicationWorldRepository, worldId: string, playerId: string, request: StaffActionRequest,
): Promise<StaffActionResult> {
  const requestId = required(request.requestId, "requestId");
  const sourceContractId = required(request.sourceContractId, "sourceContractId");
  if (typeof request.additionalDates !== "number" || !Number.isSafeInteger(request.additionalDates)
    || request.additionalDates < 1 || request.additionalDates > STAFF_DATES_MAX_PER_OFFER) {
    throw new Error(`delegated additional dates must be between 1 and ${STAFF_DATES_MAX_PER_OFFER}`);
  }
  if (typeof request.additionalPayment !== "number" || !Number.isSafeInteger(request.additionalPayment)
    || request.additionalPayment < 0 || request.additionalPayment > STAFF_DATES_PAYMENT_CAP) {
    throw new Error(`delegated one-time payment must be between 0 and ${STAFF_DATES_PAYMENT_CAP}`);
  }
  const additionalDates = request.additionalDates;
  const additionalPayment = request.additionalPayment;
  const { result } = await repository.transact(worldId, null, aggregate => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("control a promotion to delegate additional dates");
    const prior = aggregate.commands.receipts.find(row => row.requestId === requestId);
    let payload: HumanDatesAddendumPlan;
    if (prior) {
      if (prior.playerId !== playerId || prior.commandType !== "SUBMIT_CONTRACT_DATES_ADDENDUM") {
        throw new Error("requestId was previously used for a different operation");
      }
      payload = JSON.parse(prior.canonicalPayload) as HumanDatesAddendumPlan;
      if (payload.promotionId !== control.promotionId || payload.contractId !== sourceContractId
        || payload.additionalDates !== additionalDates || payload.additionalPayment !== additionalPayment) {
        throw new Error("requestId was previously used for different additional-date terms");
      }
    } else {
      if (!activeTalentManager(aggregate.state, control.promotionId)) {
        throw new Error("hire a Talent Manager before delegating additional dates");
      }
      const candidate = buildPlayerStaffView(aggregate, playerId).dateAddendums.find(row =>
        row.contractId === sourceContractId);
      if (!candidate || additionalDates > candidate.maxAdditionalDates) {
        throw new Error("this contract is not eligible for the requested delegated additional dates");
      }
      if (additionalPayment > candidate.maxOneTimePayment) {
        throw new Error("delegated payment exceeds available cash or the staff offer cap");
      }
      payload = { promotionId: control.promotionId, personId: candidate.personId,
        contractId: sourceContractId, additionalDates, additionalPayment };
    }
    const offer = submitContractDatesAddendumCommand(
      aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime,
      { worldId, playerId, requestId, commandType: "SUBMIT_CONTRACT_DATES_ADDENDUM", payload },
    );
    return { offerId: offer.id, view: buildPlayerStaffView(aggregate, playerId) };
  });
  return result;
}

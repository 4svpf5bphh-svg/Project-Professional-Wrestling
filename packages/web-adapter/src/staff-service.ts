import type { ApplicationWorldRepository } from "../../application/src/world-aggregate.js";
import {
  activePromotionControlForPlayer,
  authoriseStaffRenewalCommand,
  buildPlayerStaffView,
  hireStaffCommand,
  releaseStaffCommand,
  type AuthoriseStaffRenewalPayload,
  type PlayerStaffView,
} from "../../application/src/index.js";
import { activeTalentManager } from "../../sim-core/src/staff.js";
import { sameTermsRenewalTemplate } from "../../application/src/contract-renewal.js";
import { buildFreshPlan, type AlphaTalentOfferRequest } from "./talent-service.js";

export interface StaffActionRequest {
  requestId: string;
  staffId?: string;
  employmentId?: string;
  sourceContractId?: string;
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
  return buildPlayerStaffView(await repository.load(worldId), playerId);
}

export async function hireAlphaTalentManager(
  repository: ApplicationWorldRepository, worldId: string, playerId: string, request: StaffActionRequest,
): Promise<StaffActionResult> {
  const requestId = required(request.requestId, "requestId");
  const staffId = required(request.staffId, "staffId");
  const { result } = await repository.transact(worldId, null, aggregate => {
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
  const { result } = await repository.transact(worldId, null, aggregate => {
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
  const { result } = await repository.transact(worldId, null, aggregate => {
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

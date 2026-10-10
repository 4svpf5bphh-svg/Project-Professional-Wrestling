/**
 * Backstage continuity is a frozen record of what a *particular promotion*
 * actually heard or answered before the present conversation.
 *
 * "Consider" records a booker's interest, never the wrestler's consent or a
 * booked match, stable, pairing or creative change. A positive team note
 * requires the separately verified established-team generator; it cannot
 * be inferred from an unanswered pitch.
 *
 * These snapshots live on the existing persisted Backstage conversation:
 * no second cache, free rating boost, AI invention or World Lock side effect.
 */
import type { Id, PpwDate } from "../../domain/src/types.js";
import type {
  WorldEngagementState, BackstageConversation, BackstageResponse,
} from "./engagement.js";

export type CreativeDecision =
  | "CONSIDER_TAG_TEAM" | "PASS_TAG_TEAM"
  | "CONSIDER_RIVALRY" | "PASS_RIVALRY"
  | "CONSIDER_GIMMICK_CHANGE" | "PASS_GIMMICK_CHANGE";

export interface BackstageContinuitySnapshot {
  priorAnsweredCount: number;
  lastCreativeDecision: CreativeDecision | null;
  lastCreativeDecisionDate: PpwDate | null;
  /** Past verified positive team notes involving both these wrestlers. */
  pastPositiveTeamMomentsWithPartner: number;
}

function before(a: PpwDate,b: PpwDate): boolean {
  return a.year !== b.year ? a.year < b.year
    : a.week !== b.week ? a.week < b.week : a.day < b.day;
}
function isCreativeDecision(value: BackstageResponse | null): value is CreativeDecision {
  return value === "CONSIDER_TAG_TEAM" || value === "PASS_TAG_TEAM"
    || value === "CONSIDER_RIVALRY" || value === "PASS_RIVALRY"
    || value === "CONSIDER_GIMMICK_CHANGE" || value === "PASS_GIMMICK_CHANGE";
}
function pairIncludes(
  other: BackstageConversation,
  personId: Id,
  partnerId: Id,
): boolean {
  if (other.kind !== "TEAM_MOMENT") return false;
  const ids = [other.wrestlerId,other.partnerPersonId];
  return ids.includes(personId) && ids.includes(partnerId);
}

/**
 * Snapshot previous conversations at creation, never reading future decisions
 * into a past wrestler's dialogue. Other promotion histories are excluded.
 * A later edit to the original answer cannot retroactively alter this record.
 */
export function backstageContinuityAtCreation(
  engagement: WorldEngagementState,
  incoming: BackstageConversation,
): BackstageContinuitySnapshot {
  const prior = engagement.backstageConversations.filter(other =>
    other.worldId === incoming.worldId
      && other.promotionId === incoming.promotionId
      && before(other.createdDate,incoming.createdDate)
  );
  const responses = prior.filter(other=>
    other.wrestlerId === incoming.wrestlerId
      && other.status === "ANSWERED"
      && other.responseDate !== null
      && !before(incoming.createdDate,other.responseDate)
  );
  const creative = responses.filter(other=>isCreativeDecision(other.response))
    .sort((a,b)=>{
      const x=a.responseDate!,y=b.responseDate!;
      return (y.year-x.year)||(y.week-x.week)||(y.day-x.day)
        || b.conversationId.localeCompare(a.conversationId);
    });
  const last=creative[0];
  const pairId=incoming.kind==="TAG_TEAM_PITCH" || incoming.kind==="TEAM_MOMENT"
    ? incoming.partnerPersonId : null;
  const previousMoments=pairId
    ? prior.filter(other=>pairIncludes(other,incoming.wrestlerId,pairId)).length : 0;
  return {
    priorAnsweredCount: responses.length,
    lastCreativeDecision: last && isCreativeDecision(last.response) ? last.response : null,
    lastCreativeDecisionDate:last?.responseDate ? {...last.responseDate} : null,
    pastPositiveTeamMomentsWithPartner:previousMoments,
  };
}

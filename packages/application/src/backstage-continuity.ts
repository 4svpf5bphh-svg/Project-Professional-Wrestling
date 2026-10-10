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
  /** Frozen, promotion-scoped history for this exact two-person pairing. */
  lastWorkingDecision?: {
    response: "DISCUSS_WORKING_PLAN" | "KEEP_WORKING_PAIR" | "CONSIDER_PARTNER_CHANGE";
    responseDate: PpwDate;
    observedLaterKind: "PARTNERS_REBOOKED" | "ALTERNATE_PARTNER_APPEARED" | null;
  } | null;
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
    || incoming.kind==="WORKING_PARTNERSHIP_CONCERN"
    ? incoming.partnerPersonId : null;
  const previousMoments=pairId
    ? prior.filter(other=>pairIncludes(other,incoming.wrestlerId,pairId)).length : 0;
  const priorWorking=pairId ? prior.filter(other=>
    other.kind==="WORKING_PARTNERSHIP_CONCERN" && other.status==="ANSWERED"
    && !!other.responseDate
    && !before(incoming.createdDate,other.responseDate)
    && [other.wrestlerId,other.partnerPersonId].includes(incoming.wrestlerId)
    && [other.wrestlerId,other.partnerPersonId].includes(pairId)
    && ["DISCUSS_WORKING_PLAN","KEEP_WORKING_PAIR","CONSIDER_PARTNER_CHANGE"].includes(other.response??"")
  ).sort((a,b)=>{
    const x=a.responseDate!,y=b.responseDate!;
    return (y.year-x.year)||(y.week-x.week)||(y.day-x.day)
      ||b.conversationId.localeCompare(a.conversationId);
  })[0] : undefined;
  const previousFollowThrough=priorWorking?.workingFollowThrough;
  const frozenObservedKind=previousFollowThrough
    && !before(incoming.createdDate,previousFollowThrough.happenedDate)
    && !before(incoming.createdDate,previousFollowThrough.recordedDate)
    ? previousFollowThrough.kind : null;
  return {
    priorAnsweredCount: responses.length,
    lastCreativeDecision: last && isCreativeDecision(last.response) ? last.response : null,
    lastCreativeDecisionDate:last?.responseDate ? {...last.responseDate} : null,
    pastPositiveTeamMomentsWithPartner:previousMoments,
    lastWorkingDecision: priorWorking ? {
      response: priorWorking.response as "DISCUSS_WORKING_PLAN" | "KEEP_WORKING_PAIR" | "CONSIDER_PARTNER_CHANGE",
      responseDate: {...priorWorking.responseDate!},
      observedLaterKind: frozenObservedKind,
    } : null,
  };
}

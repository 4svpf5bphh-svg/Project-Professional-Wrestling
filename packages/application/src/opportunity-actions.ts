import type { ContractOffer, Id } from "../../domain/src/types.js";
import {
  comparePpwDates,
  submitHumanContractOffer,
  type HumanContractOfferPlan,
} from "../../sim-core/src/index.js";
import {
  activityForPlayer,
  dismissAttention,
  opportunityVisibleToPlayer,
  type OpportunityRecord,
} from "./engagement.js";
import {
  executeIdempotentCommand,
  type ApplicationCommandEnvelope,
} from "./commands.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PursueTalentOpportunityPayload {
  opportunityId: string;
  offer: Omit<HumanContractOfferPlan, "promotionId" | "personId">;
}

export interface PursueTalentOpportunityResult {
  opportunityId: string;
  promotionId: Id;
  personId: Id;
  offer: ContractOffer;
}

function normalizedOpportunityId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("opportunityId must not be empty");
  if (normalized.length > 220) throw new Error("opportunityId is too long");
  return normalized;
}

function opportunityIsOpen(
  aggregate: ApplicationWorldAggregate,
  opportunity: OpportunityRecord,
): boolean {
  const currentDate = aggregate.state.world.currentDate;
  const weeksPerYear = aggregate.state.ruleset.weeksPerYear;
  return comparePpwDates(currentDate, opportunity.opensDate, weeksPerYear) >= 0
    && comparePpwDates(currentDate, opportunity.closesDate, weeksPerYear) <= 0;
}

function talentOpportunityPersonId(
  aggregate: ApplicationWorldAggregate,
  opportunity: OpportunityRecord,
  promotionId: Id,
): Id {
  const prefix = `talent-window:${promotionId}:`;
  if (!opportunity.opportunityId.startsWith(prefix)) {
    throw new Error("Talent Opportunity target does not match the controlled promotion");
  }
  const suffix = opportunity.opportunityId.slice(prefix.length);
  const person = [...aggregate.state.people]
    .sort((left, right) => right.id.length - left.id.length || left.id.localeCompare(right.id))
    .find((candidate) => suffix.startsWith(`${candidate.id}:`));
  if (!person) throw new Error("Talent Opportunity target wrestler no longer exists");
  return person.id;
}

function wrestlerStillUnattached(
  aggregate: ApplicationWorldAggregate,
  personId: Id,
): boolean {
  const currentDate = aggregate.state.world.currentDate;
  const weeksPerYear = aggregate.state.ruleset.weeksPerYear;
  return !aggregate.state.contracts.some((contract) => (
    contract.personId === personId
    && contract.status === "SIGNED"
    && comparePpwDates(contract.endDate, currentDate, weeksPerYear) >= 0
  ));
}

/**
 * Pursues a server-generated Talent Opportunity through PPW's normal human
 * contract-offer path. The Opportunity is a discovery/attention surface only:
 * it grants no acceptance bonus, reservation, priority or hidden signing power.
 */
export function pursueTalentOpportunityCommand(
  aggregate: ApplicationWorldAggregate,
  envelope: ApplicationCommandEnvelope<PursueTalentOpportunityPayload>,
): PursueTalentOpportunityResult {
  if (envelope.commandType !== "PURSUE_TALENT_OPPORTUNITY") {
    throw new Error(`expected PURSUE_TALENT_OPPORTUNITY command, received ${envelope.commandType}`);
  }
  if (envelope.worldId !== aggregate.state.world.id) {
    throw new Error("Talent Opportunity command crosses World boundary");
  }

  return executeIdempotentCommand(
    aggregate.commands,
    aggregate.runtime,
    envelope,
    aggregate.state.world.currentDate,
    () => {
      if (!activeWorldMembership(aggregate.ownership, envelope.playerId)) {
        throw new Error(`${envelope.playerId} is not an active member of ${aggregate.state.world.id}`);
      }
      const control = activePromotionControlForPlayer(aggregate.ownership, envelope.playerId);
      if (!control) throw new Error(`${envelope.playerId} does not control an active promotion`);
      if (!aggregate.engagement) throw new Error("World has no Opportunity state");

      const opportunityId = normalizedOpportunityId(envelope.payload.opportunityId);
      const opportunity = aggregate.engagement.opportunities.find(
        (candidate) => candidate.opportunityId === opportunityId,
      );
      if (!opportunity) throw new Error(`unknown Opportunity ${opportunityId}`);
      if (opportunity.category !== "TALENT") throw new Error("Opportunity is not a Talent Window");
      if (!opportunityVisibleToPlayer(opportunity, envelope.playerId, control.promotionId)) {
        throw new Error("Talent Opportunity is not visible to this player/promotion");
      }
      const activity = activityForPlayer(aggregate.engagement, envelope.playerId);
      if (activity?.status === "STEWARDED") {
        throw new Error("STEWARDED owners cannot pursue new Talent Opportunities");
      }
      if (!opportunityIsOpen(aggregate, opportunity)) {
        throw new Error("Talent Opportunity is no longer open");
      }

      const personId = talentOpportunityPersonId(aggregate, opportunity, control.promotionId);
      const person = aggregate.state.people.find((candidate) => candidate.id === personId);
      if (!person || person.status !== "ACTIVE") {
        throw new Error("Talent Opportunity wrestler is no longer active");
      }
      if (!wrestlerStillUnattached(aggregate, personId)) {
        throw new Error("Talent Opportunity wrestler is no longer unattached");
      }

      const offer = submitHumanContractOffer(aggregate.state, {
        ...envelope.payload.offer,
        promotionId: control.promotionId,
        personId,
      });
      dismissAttention(
        aggregate.engagement,
        envelope.playerId,
        `opportunity:${opportunity.opportunityId}`,
        aggregate.runtime.revision,
      );

      return {
        opportunityId: opportunity.opportunityId,
        promotionId: control.promotionId,
        personId,
        offer,
      };
    },
  );
}

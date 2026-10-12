/**
 * Deterministic fictional Backstage voice. The simulation decides whether real,
 * verified evidence warrants a conversation; this layer merely phrases it.
 * An inferred/curated temperament is a game descriptor, never a real-life claim.
 *
 * Contractual details, completed bouts, shared teams and presented gimmicks
 * originate in the frozen conversation. No wins, betrayals, turns, contract
 * terms or scripted actions are inferred. No effects or random draws.
 */
import type { Person, Id } from "../../domain/src/types.js";
import { deterministicSeedFromText } from "../../sim-core/src/rng.js";
import type { BackstageConversation } from "./engagement.js";
import {
  wrestlerPersonalityFor,
  type BackstageTemperament,
  type PersonalityMotivation,
} from "./wrestler-personality.js";

export interface BackstageDialogue {
  speech: string;
  /** Describes fictional dialogue treatment, not a factual trait. */
  voice: BackstageTemperament | "NEUTRAL";
}

/** Safe helper: all context is a display value from known, frozen match data. */
function printableName(name: string | undefined): string {
  return name?.trim().slice(0, 80) || "that wrestler";
}
function title(value: string | undefined): string {
  return value?.replaceAll("_", " ").toLowerCase() || "a new character";
}
function continuityLine(entry: BackstageConversation): string {
  const context=entry.continuity;
  if (!context) return "";
  const decision=context.lastCreativeDecision;
  const verb=decision?.startsWith("CONSIDER_") ? "were open to exploring" : "passed on";
  const idea=decision === "CONSIDER_TAG_TEAM" || decision === "PASS_TAG_TEAM" ? "a tag-team idea"
    : decision === "CONSIDER_RIVALRY" || decision === "PASS_RIVALRY" ? "a rivalry idea"
    : decision === "CONSIDER_GIMMICK_CHANGE" || decision === "PASS_GIMMICK_CHANGE"
      ? "a character change" : null;
  const last=idea ? ` Last time we talked creative, you ${verb} ${idea}.` : "";
  const partnership=entry.kind==="TAG_TEAM_PITCH" && context.pastPositiveTeamMomentsWithPartner>0
    ? " We've had good nights together as a team before." : "";
  // A previous "consider" was not an actual agreement or booked action.
  const working=context.lastWorkingDecision;
  const workingLine=working && (entry.kind==="WORKING_PARTNERSHIP_CONCERN"
    ||entry.kind==="TAG_TEAM_PITCH"||entry.kind==="TEAM_MOMENT")
    ? " Last time we discussed working together, you "
      +(working.response==="DISCUSS_WORKING_PLAN"?"wanted to review the partnership"
        :working.response==="KEEP_WORKING_PAIR"?"said we should keep the pairing"
        :"were open to trying different tag partners")
      +"."
      +(working.observedLaterKind==="PARTNERS_REBOOKED"
        ?" We later worked another completed tag match together."
        :working.observedLaterKind==="ALTERNATE_PARTNER_APPEARED"
          ?" A later completed tag match featured a different partner."
          :"")
    :"";
  return last+partnership+workingLine;
}

function scene(
  entry: BackstageConversation,
  names: Map<Id,string>,
): string {
  switch (entry.kind) {
    case "PROGRAMME_CREATIVE_AGREEMENT": {
      const terms = entry.programmeCreative;
      if (!terms) return "We have no agreed Programme terms on record.";
      const scope = terms.permittedOutcome === "WIN_ONLY" ? "winning match assignments"
        : "wins or explicitly protected losses";
      const end = `Year ${terms.expiryDate.year}, Week ${terms.expiryDate.week}`;
      return terms.approved
        ? `I've looked at your proposed ${terms.programmeLabel} direction. I'm happy to work the ${terms.matchType.toLowerCase()} matches with ${scope} until ${end}. A clean loss, outside opponent or different finish still needs another conversation.`
        : `I've looked at the ${terms.programmeLabel} proposal. I can't agree to ${scope} across the next stretch. We can still discuss an individual match, but I'm not signing off the whole Programme direction.`;
    }
    case "ROLE_USAGE_CONCERN":
      return `My deal was for a ${entry.promisedRole === "MAIN_EVENT" ? "main-event" : "featured upper-card"} spot, and I've worked ${entry.observedMatchShows} matches without getting that position. What's the plan for me?`;
    case "TAG_TEAM_PITCH":
      return `I've worked ${entry.sharedTagMatches ?? 0} tag matches with ${printableName(names.get(entry.partnerPersonId ?? ""))}, and the crowd's been responding. Could we try building us as a proper team?`;
    case "RIVALRY_PITCH":
      return `${printableName(names.get(entry.rivalPersonId ?? ""))} and I have had ${entry.sharedSinglesMatches ?? 0} singles matches the crowd got into. I reckon there's a programme there, if you want to book it.`;
    case "TEAM_MOMENT":
      return `The tag matches with ${printableName(names.get(entry.partnerPersonId ?? ""))} are clicking. We've got ${entry.sharedTagMatches ?? 0} good recent outings together. Feels like we're finding our rhythm.`;
    case "WORKING_PARTNERSHIP_CONCERN": {
      const partner = printableName(names.get(entry.partnerPersonId ?? ""));
      return entry.continuity?.lastWorkingDecision
        ? `We've got another run of ${entry.observedMatchShows} rough tag outings with ${partner} since our earlier conversation. The execution still isn't where it needs to be. Can we revisit our options?`
        : `The last ${entry.observedMatchShows} rough tag outings with ${partner} have me thinking about how we work together. The execution hasn't been there, and I want to discuss our options before we book the next one. What's your view?`;
    }
    case "GIMMICK_CHANGE_PITCH":
      return `It's been ${entry.observedMatchShows} matches and the crowds aren't connecting as much as we'd hoped. I wonder if a ${title(entry.suggestedGimmickArchetype)} direction could work better than the current ${title(entry.currentGimmickArchetype)} character. What do you think?`;
  }
}
const openings: Record<BackstageTemperament, readonly [string,string]> = {
  COLLABORATIVE: [
    "Got a minute? I'd like to work something through with you.",
    "I've been thinking about what we can do together here.",
  ],
  AMBITIOUS: [
    "I'm here to make an impact, not just fill a spot on the card.",
    "I want to move this thing forward and earn a bigger moment.",
  ],
  INDEPENDENT: [
    "I'll tell you what I'm thinking, straight up.",
    "I've got an idea of my own. Hear me out.",
  ],
  METHODICAL: [
    "I've looked at how the last few shows went.",
    "Let's talk through what the work in the ring is telling us.",
  ],
  SHOWMAN: [
    "You know when something gets the building buzzing?",
    "This business is about making the people care, right?",
  ],
  STEADY: [
    "No drama, but can we talk about how things are going?",
    "I know the long game matters. I've got a thought.",
  ],
};
/** Positive team news never sounds like someone demanding a push or payoff. */
const goodNewsOpenings: Record<BackstageTemperament, string> = {
  COLLABORATIVE: "It's good to see us working together like this.",
  AMBITIOUS: "The building is finally getting behind our team.",
  INDEPENDENT: "Credit where it's due — the partnership is working.",
  METHODICAL: "The tag work has been getting more consistent.",
  SHOWMAN: "You can hear the people getting into what we're doing.",
  STEADY: "Things are settling into a good rhythm.",
};

const endings: Record<PersonalityMotivation, string> = {
  TOP_BILLING: "I want to earn a meaningful place on the card.",
  MONEY: "Let's make the dates we're working count.",
  PRESTIGE: "I'd like to make it something worth remembering.",
  ROUTINE: "A clear plan from week to week would help.",
  LOYALTY: "I want this promotion to get something good out of it.",
  EXPOSURE: "It's a chance to connect with more of the crowd.",
};

export function buildBackstageDialogue(
  entry: BackstageConversation,
  person: Person | undefined,
  names: Map<Id,string>,
): BackstageDialogue {
  const evidence = scene(entry,names)+continuityLine(entry);
  if (!person) return {speech:evidence,voice:"NEUTRAL"};
  const personality = wrestlerPersonalityFor(person);
  const tone = personality.temperament;
  const variant = deterministicSeedFromText("ppw:backstage-voice:v1:" + entry.conversationId) % 2;
  const prefix = entry.kind === "TEAM_MOMENT" ? goodNewsOpenings[tone] : openings[tone][variant];
  const motivation = personality.motivations[0] ?? "PRESTIGE";
  // Positive news isn't a request for anything and should not end with
  // an implied demand for a reward or push.
  const suffix = entry.kind === "TEAM_MOMENT"
    || entry.kind === "PROGRAMME_CREATIVE_AGREEMENT" ? "" : " " + endings[motivation];
  return {speech:`${prefix} ${evidence}${suffix}`,voice:tone};
}

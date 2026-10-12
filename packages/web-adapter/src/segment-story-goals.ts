import type { DetailedShowSegmentType } from "../../application/src/planning.js";

/**
 * Presentation-only booking taxonomy. Every choice maps to an existing,
 * server-authoritative segment. Goals never introduce new outcome rules.
 */
export type SegmentStoryGoal = "CHARACTER" | "RIVALRY" | "STAKES" | "FACTION" | "AFTERMATH" | "VIDEO" | "ARRIVAL";

export interface SegmentGoalDefinition {
  id: SegmentStoryGoal;
  label: string;
  description: string;
  types: readonly DetailedShowSegmentType[];
}

export const SEGMENT_STORY_GOALS: readonly SegmentGoalDefinition[] = [
  {
    id: "CHARACTER", label: "Character", description: "Let the crowd get to know your wrestlers.",
    types: ["PROMO", "INTERVIEW", "CELEBRATION"],
  },
  {
    id: "RIVALRY", label: "Rivalry", description: "Put the heat on an opponent or escalate a feud.",
    types: ["CONFRONTATION", "INTERRUPTION", "ATTACK", "RESCUE"],
  },
  {
    id: "STAKES", label: "Challenge", description: "Set up a fight, commitment or match agreement.",
    types: ["CHALLENGE", "CONTRACT_SIGNING"],
  },
  {
    id: "FACTION", label: "Relationships", description: "Change alliances, stable stories and allegiances.",
    types: ["STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION", "TURN"],
  },
  {
    id: "ARRIVAL", label: "Debut / Return", description: "Make an actual in-person introduction using a booked wrestler.",
    types: ["LIVE_APPEARANCE"],
  },
  {
    id: "VIDEO", label: "Video", description: "Build anticipation with pre-recorded footage; the wrestler is not at the show.",
    types: ["VIDEO_PACKAGE"],
  },
  {
    id: "AFTERMATH", label: "After the bell", description: "Continue the story immediately after a match.",
    types: ["POST_MATCH_ASSAULT"],
  },
];

export function storyGoalForSegment(type: DetailedShowSegmentType): SegmentStoryGoal {
  const found = SEGMENT_STORY_GOALS.find((goal) => goal.types.includes(type));
  if (!found) throw new Error("Segment has no story goal: " + type);
  return found.id;
}

export function typesForStoryGoal(goal: SegmentStoryGoal): readonly DetailedShowSegmentType[] {
  return SEGMENT_STORY_GOALS.find((entry) => entry.id === goal)?.types ?? [];
}

export function firstSegmentForGoal(goal: SegmentStoryGoal): DetailedShowSegmentType {
  const first = typesForStoryGoal(goal)[0];
  if (!first) throw new Error("Story goal has no segment choices: " + goal);
  return first;
}

/** Direction only, not a promised outcome or a score guide. */
export function segmentDirectionHint(type: DetailedShowSegmentType): string {
  switch (type) {
    case "PROMO": return "Give a wrestler the microphone. Their presentation and the crowd's investment determine how well it lands.";
    case "INTERVIEW": return "Put a wrestler on the spot. Use the conversation to reveal personality or advance an existing story.";
    case "CELEBRATION": return "Let the audience react to a victory or milestone. The character and timing change the reception.";
    case "CONFRONTATION": return "Bring two wrestlers face to face. Choose who instigates the encounter and who is targeted.";
    case "INTERRUPTION": return "Choose who interrupts, whose time they steal and who wins the scripted exchange.";
    case "ATTACK": return "Script the aggressor and victim, then choose the assault format and what it is meant to achieve.";
    case "RESCUE": return "Book an aggressor, victim and rescuer. The rescue's reception depends on established character roles.";
    case "CHALLENGE": return "Have one wrestler challenge another, then script whether the challenge is accepted, refused or left unanswered.";
    case "CONTRACT_SIGNING": return "Write the televised signing's response. This is a storyline segment, not a real employment contract.";
    case "STABLE_INVITATION": return "Stage a real stable's invitation and choose how the proposed recruit responds on screen.";
    case "STABLE_EXIT": return "Script an expulsion or walkout from an existing stable. Roster membership remains separately controlled.";
    case "STABLE_RECONCILIATION": return "Use an existing stable history to script reunion or rejection.";
    case "TURN": return "Choose whose alignment changes, who is betrayed if relevant, and how the reveal happens.";
    case "LIVE_APPEARANCE": return "Bring one contracted wrestler to the show for a scripted debut, return, surprise reveal or introduction. Live appearances use real booking dates.";
    case "VIDEO_PACKAGE": return "Choose whose footage airs, what it teases and how much is revealed. Pre-recorded video is not a live wrestler appearance.";
    case "POST_MATCH_ASSAULT": return "Book the attack immediately after its source match, without changing that match's result.";
  }
}

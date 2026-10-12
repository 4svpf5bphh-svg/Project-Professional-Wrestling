declare const process: { exitCode?: number };

import type { DetailedShowSegmentType } from "../packages/application/src/planning.js";
import {
  SEGMENT_STORY_GOALS,
  firstSegmentForGoal,
  segmentDirectionHint,
  storyGoalForSegment,
  typesForStoryGoal,
} from "../packages/web-adapter/src/segment-story-goals.js";

let passed = 0;
let failed = 0;
function assert(condition: unknown, explanation: string): void {
  if (!condition) throw new Error(explanation);
}
function test(name: string, run: () => void): void {
  try { run(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name, error); }
}
const allTypes: readonly DetailedShowSegmentType[] = [
  "PROMO", "INTERVIEW", "CONFRONTATION", "INTERRUPTION", "CHALLENGE",
  "CONTRACT_SIGNING", "STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION",
  "ATTACK", "RESCUE", "POST_MATCH_ASSAULT", "CELEBRATION", "TURN", "VIDEO_PACKAGE", "LIVE_APPEARANCE",
];

test("each supported segment appears exactly once across storytelling goals", () => {
  const listed = SEGMENT_STORY_GOALS.flatMap((goal) => goal.types);
  assert(listed.length === allTypes.length, "the story catalogue is missing or duplicates segment types");
  assert(new Set(listed).size === listed.length, "segment type is duplicated between story goals");
  assert(allTypes.every((type) => listed.includes(type)), "some authored segment types are not offered");
});

test("story goal selections round-trip to their existing typed segment", () => {
  for (const type of allTypes) {
    const goal = storyGoalForSegment(type);
    assert(typesForStoryGoal(goal).includes(type), type + " lost its group selection");
    assert(firstSegmentForGoal(goal) === typesForStoryGoal(goal)[0], goal + " default not offered");
  }
});

test("every choice gives a clear booking hint without revealing hidden scoring numbers", () => {
  for (const type of allTypes) {
    const hint = segmentDirectionHint(type);
    assert(hint.length > 40, type + " has no useful scripting direction");
    assert(!/[+-]\d+(?:\.\d+)?/.test(hint), type + " leaks scoring weight");
  }
});

test("all goals are nonempty, uniquely named and explain their purpose", () => {
  assert(new Set(SEGMENT_STORY_GOALS.map((goal) => goal.id)).size === SEGMENT_STORY_GOALS.length, "duplicate goal");
  for (const goal of SEGMENT_STORY_GOALS) {
    assert(goal.types.length > 0, goal.id + " has no formats");
    assert(goal.label.length > 0 && goal.description.length > 15, goal.id + " is not understandable");
  }
});

console.log("\nSegment story goal tests: " + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;

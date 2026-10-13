declare const process: { exitCode?: number };

import { moveRunningOrderSlot, canMoveRunningOrderSlot } from "../packages/web-adapter/src/card-running-order.js";
import { lockCardBackgroundScroll } from "../apps/web/app/card/card-background-scroll-lock.js";
import type { AlphaCardSlotView, AlphaCardSegmentView } from "../packages/web-adapter/src/card-service.js";

function equals(actual: unknown, expected: unknown, description: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(description + ": expected " + JSON.stringify(expected) + " got " + JSON.stringify(actual));
  }
}

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log("PASS " + name);
  } catch (error) {
    failed += 1;
    console.error("FAIL " + name, error);
  }
}

const match = (id: string): AlphaCardSlotView => ({ kind: "MATCH", refId: id });
const segment = (id: string): AlphaCardSlotView => ({ kind: "SEGMENT", refId: id });
const postMatch = [{ draftSegmentId: "assault", type: "POST_MATCH_ASSAULT", sourceDraftMatchId: "opening" }] as Pick<AlphaCardSegmentView, "draftSegmentId" | "type" | "sourceDraftMatchId">[];

test("standard match and segment slots move up/down without mutating the draft", () => {
  const order = [match("a"), segment("promo"), match("b")];
  const snapshot = JSON.stringify(order);
  equals(moveRunningOrderSlot(order, [], 0, 1), [segment("promo"), match("a"), match("b")], "move first match down");
  equals(moveRunningOrderSlot(order, [], 2, -1), [match("a"), match("b"), segment("promo")], "move final match up");
  equals(JSON.stringify(order), snapshot, "original was mutated");
});

test("first and final slot show disabled boundary arrows", () => {
  const order = [match("a"), segment("promo")];
  equals(canMoveRunningOrderSlot(order, [], 0, -1), false, "first cannot go up");
  equals(canMoveRunningOrderSlot(order, [], 1, 1), false, "last cannot go down");
  equals(moveRunningOrderSlot(order, [], 0, -1), null, "boundary is no-op");
});

test("post-match assault stays next to its source match when match moves", () => {
  const order = [match("opening"), segment("assault"), match("second"), segment("promo")];
  equals(moveRunningOrderSlot(order, postMatch, 0, 1),
    [match("second"), match("opening"), segment("assault"), segment("promo")],
    "match plus immediate assault must travel together");
});

test("reordering the attached assault moves its entire paired booking", () => {
  const order = [match("opening"), segment("assault"), match("second")];
  equals(moveRunningOrderSlot(order, postMatch, 1, 1),
    [match("second"), match("opening"), segment("assault")],
    "assault must not split from match");
  equals(canMoveRunningOrderSlot(order, postMatch, 1, -1), false,
    "assault cannot step in front of the paired match");
});

test("another slot can move past an intact post-match booking", () => {
  const order = [match("opening"), segment("assault"), match("second")];
  equals(moveRunningOrderSlot(order, postMatch, 2, -1),
    [match("second"), match("opening"), segment("assault")],
    "independent slot should pass the grouped booking");
});

test("nested booking editor and wrestler picker always restore iPhone page scrolling", () => {
  const body = { style: { overflow: "auto" } };
  const releaseEditor = lockCardBackgroundScroll(body);
  equals(body.style.overflow, "hidden", "booking editor must lock background");
  const releasePicker = lockCardBackgroundScroll(body);
  releasePicker();
  equals(body.style.overflow, "hidden", "closing picker must not unlock the editor");
  const releaseReplacement = lockCardBackgroundScroll(body);
  releaseEditor();
  equals(body.style.overflow, "hidden", "React editor effect replacement must not restore stale hidden");
  releaseReplacement();
  equals(body.style.overflow, "auto", "closing last editor restores original scrolling");
  releaseReplacement();
  equals(body.style.overflow, "auto", "repeated effect cleanup must be harmless");
  const releaseNewEditor = lockCardBackgroundScroll(body);
  releaseNewEditor();
  equals(body.style.overflow, "auto", "opening a new slot must also recover scrolling");
});

console.log("\nCard running-order tests: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;

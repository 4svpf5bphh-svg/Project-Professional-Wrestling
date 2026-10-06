declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  WRESTLER_ALIGNMENTS,
  createWorld,
  defaultWrestlerAlignment,
  deterministicWorldHash,
  setWrestlerAlignment,
  wrestlerAlignment,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

test("wrestler alignment baseline is deterministic without mutating World state", () => {
  const state = createWorld(73001, DEFAULT_RULESET);
  const beforeHash = deterministicWorldHash(state);
  const counts = new Map(WRESTLER_ALIGNMENTS.map((alignment) => [alignment, 0]));

  for (const person of state.people) {
    const first = wrestlerAlignment(person, state.world.seed);
    const second = wrestlerAlignment(person, state.world.seed);
    ok(first === second, `alignment changed for ${person.id}`);
    ok(first === defaultWrestlerAlignment(state.world.seed, person.id), `baseline mismatch for ${person.id}`);
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }

  ok(deterministicWorldHash(state) === beforeHash, "reading baseline alignments mutated deterministic World state");
  for (const alignment of WRESTLER_ALIGNMENTS) {
    ok((counts.get(alignment) ?? 0) > 0, `fixture produced no ${alignment} wrestlers`);
  }
});

test("explicit alignment override is stable state for future turn mechanics", () => {
  const state = createWorld(73002, DEFAULT_RULESET);
  const person = state.people[0]!;
  const baseline = wrestlerAlignment(person, state.world.seed);
  const override = baseline === "HEEL" ? "FACE" : "HEEL";
  const beforeHash = deterministicWorldHash(state);

  setWrestlerAlignment(person, override);

  ok(wrestlerAlignment(person, state.world.seed) === override, "explicit alignment override was not respected");
  ok(deterministicWorldHash(state) !== beforeHash, "explicit alignment override did not participate in World state hash");
});

console.log(`\nAlignment tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

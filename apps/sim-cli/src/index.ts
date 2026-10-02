declare const process: { argv: string[]; exitCode?: number };

import { DEFAULT_RULESET } from "../../../packages/config/src/default-ruleset.js";
import { createWorld, formatPpwDate, resolveWorldWeeks, summarizeWorld, validateWorldInvariants } from "../../../packages/sim-core/src/index.js";

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const seed = Number(valueAfter("--seed") ?? "20261002");
const weeks = Number(valueAfter("--weeks") ?? "0");

if (!Number.isInteger(seed) || seed < 0) throw new Error("--seed must be a non-negative integer");
if (!Number.isInteger(weeks) || weeks < 0) throw new Error("--weeks must be a non-negative integer");

const state = createWorld(seed, DEFAULT_RULESET);
const genesisHash = summarizeWorld(state).deterministicHash;
resolveWorldWeeks(state, weeks);
const invariantErrors = validateWorldInvariants(state);
const summary = summarizeWorld(state);

console.log("PPW SIM-0.0.5");
console.log(`Genesis seed: ${seed}`);
console.log(`Genesis hash: ${genesisHash}`);
console.log(`Resolved: ${weeks} PPW weeks`);
console.log(`Current date: ${formatPpwDate(state.world.currentDate)}`);
console.log(JSON.stringify(summary, null, 2));

if (invariantErrors.length > 0) {
  console.error("Invariant failures:");
  for (const error of invariantErrors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Invariants: PASS");
}

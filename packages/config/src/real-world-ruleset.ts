import type { Ruleset } from "../../domain/src/types.js";
import { DEFAULT_RULESET } from "./default-ruleset.js";

/**
 * Staged ruleset for the future real-world Alpha reset.
 *
 * This is intentionally not wired into the deployed Alpha yet. It expands the
 * World to hold the reviewed mixed roster and leaves five fictional
 * Independent promotions available for player takeover/rebrand.
 */
export const REAL_WORLD_ALPHA_RULESET: Ruleset = {
  ...DEFAULT_RULESET,
  version: "sim0.0.14-real-world-preview",
  promotions: 13,
  wrestlers: 644,
};

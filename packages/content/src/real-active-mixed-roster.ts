import { generatedFictionalRosterSource } from "../../sim-core/src/genesis.js";
import type { WorldRosterSource } from "../../sim-core/src/roster-source.js";
import {
  calibrateRealActiveMensPerson,
} from "./real-active-mens-calibration.js";
import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
} from "./real-active-mens-roster.js";
import {
  REAL_ACTIVE_WOMENS_ROSTER_NAMES,
} from "./real-active-womens-roster.js";
import {
  calibrateRealActiveWomensPerson,
} from "./real-active-womens-calibration.js";

export const REAL_ACTIVE_MIXED_ROSTER_SIZE =
  REAL_ACTIVE_MENS_ROSTER_NAMES.length + REAL_ACTIVE_WOMENS_ROSTER_NAMES.length;

const ALL_REAL_NAMES = [
  ...REAL_ACTIVE_MENS_ROSTER_NAMES,
  ...REAL_ACTIVE_WOMENS_ROSTER_NAMES,
] as const;

const normalizedNames = ALL_REAL_NAMES.map((name) => name.toLocaleLowerCase("en"));
if (new Set(normalizedNames).size !== ALL_REAL_NAMES.length) {
  throw new Error("combined real-active roster contains duplicate display names");
}

/**
 * Expanded mixed-division identity source.
 *
 * It remains opt-in: the deployed Alpha still uses the 400-person calibrated
 * men's source until the real promotion/contract/team ecosystem is ready for
 * a deliberate World reset.
 */
export const calibratedRealActiveMixedRosterSource: WorldRosterSource = (context) => {
  if (context.ruleset.wrestlers > ALL_REAL_NAMES.length) {
    throw new Error(
      `combined real-active roster contains ${ALL_REAL_NAMES.length} names; `
      + `World requested ${context.ruleset.wrestlers}`,
    );
  }

  const generated = generatedFictionalRosterSource(context);
  return generated.map((person, index) => {
    if (index < REAL_ACTIVE_MENS_ROSTER_NAMES.length) {
      return calibrateRealActiveMensPerson({
        ...person,
        name: REAL_ACTIVE_MENS_ROSTER_NAMES[index]!,
        division: "MEN",
      });
    }

    const womenIndex = index - REAL_ACTIVE_MENS_ROSTER_NAMES.length;
    return calibrateRealActiveWomensPerson({
      ...person,
      name: REAL_ACTIVE_WOMENS_ROSTER_NAMES[womenIndex]!,
      division: "WOMEN",
    });
  });
};

/** Compatibility re-export. World-authoritative relationship changes now live
 * in sim-core and are executed by BOTH headless and persisted World Lock.
 * No application read or command calls this mutating evaluator directly.
 */
export {
  evolveCompletedWorkingPartnerships,
  WORKING_PARTNERSHIP_LEDGER_TYPE,
  WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE,
} from "../../sim-core/src/working-relationship-evolution.js";

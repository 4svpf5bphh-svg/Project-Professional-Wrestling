declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorldOwnershipState, joinPlayerToWorld, claimIndependentPromotionForPlayer } from "../packages/application/src/ownership.js";
import { createWorldCommandState } from "../packages/application/src/commands.js";
import { createWorldRuntimeState } from "../packages/application/src/runtime.js";
import { hireStaffCommand, authoriseStaffRenewalCommand } from "../packages/application/src/staff-commands.js";
import { sameTermsRenewalTemplate } from "../packages/application/src/contract-renewal.js";
import { staffRetentionAdvice } from "../packages/application/src/staff-retention-advice.js";
import { buildFreshPlan } from "../packages/web-adapter/src/talent-service.js";
import {
  addPpwWeeks, createWorld, createPersistedWorldState, restorePersistedWorldState,
  resolveWorldWeek, validateWorldInvariants,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}
function ok(condition: unknown, message: string): void { if (!condition) throw Error(message); }
function rejects(fn: () => unknown, fragment: string): void {
  let message = "";
  try { fn(); } catch (error) { message = error instanceof Error ? error.message : String(error); }
  ok(message.includes(fragment), `expected "${fragment}", got "${message}"`);
}

test("staff renewal command independently refuses a forged later term and early renewal", () => {
  const state = createWorld(49100, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  joinPlayerToWorld(ownership, "player-one", state.world.currentDate);
  const chosen = state.promotions.find(p => p.tier === "INDEPENDENT" && p.lifecycle === "ACTIVE");
  if (!chosen) throw Error("no Indie");
  claimIndependentPromotionForPlayer(state, ownership, "player-one", chosen.id);
  const contract = state.contracts.find(c => c.promotionId === chosen.id && c.status === "SIGNED" && c.family === "LIMITED_NON_EXCLUSIVE");
  if (!contract) throw Error("fixture missing limited contract");
  state.world.currentDate = { year: 1, week: 11, day: 1 };
  contract.startDate = { year: 1, week: 1, day: 1 };
  contract.endDate = { year: 1, week: 13, day: 1 };
  contract.dateEntitlement = 4;
  contract.datesUsed = 0;
  const staff = state.staffMembers![0]!;
  chosen.cash = Math.max(chosen.cash, 5_000_000);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  const employment = hireStaffCommand(state, ownership, commands, runtime, {
    worldId: state.world.id, playerId: "player-one", requestId: "audit-hire",
    commandType: "HIRE_STAFF", payload: { promotionId: chosen.id, staffId: staff.id },
  });
  const template = sameTermsRenewalTemplate(state, contract);
  if (!template) throw Error("fixture not suitable for same-terms renewal");
  const aggregate = { state, ownership, commands, runtime, planning: { worldId: state.world.id, showDrafts: [], showReservations: [] } } as Parameters<typeof buildFreshPlan>[0];
  const plan = buildFreshPlan(aggregate, chosen.id, {
    requestId: "audit-renewal", sourceContractId: contract.id,
    personId: contract.personId, ...template,
  });
  const payload = { promotionId: chosen.id, staffEmploymentId: employment.id, sourceContractId: contract.id, plan };
  const submit = (p: typeof payload, requestId: string): void => {
    authoriseStaffRenewalCommand(state, ownership, commands, runtime, {
      worldId: state.world.id, playerId: "player-one", requestId,
      commandType: "AUTHORISE_TALENT_MANAGER_RENEWAL", payload: p,
    });
  };
  const originalOfferCount = state.contractOffers.length;
  rejects(() => submit({ ...payload, plan: {
    ...plan, endDate: addPpwWeeks(plan.endDate, 1, state.ruleset.weeksPerYear),
  } }, "forged-end"), "staff renewal must match active recurring contract terms exactly");
  rejects(() => submit({ ...payload, plan: {
    ...plan, startDate: addPpwWeeks(plan.startDate, 1, state.ruleset.weeksPerYear),
  } }, "forged-start"), "staff renewal must match active recurring contract terms exactly");
  ok(state.contractOffers.length === originalOfferCount, "forged manager offer entered the World");
  // Only an actually open renewal window can be delegated by staff.
  state.world.currentDate = { year: 1, week: 2, day: 1 };
  rejects(() => submit(payload, "too-early"), "not within its renewal window");
  ok(state.contractOffers.length === originalOfferCount, "premature manager offer entered the World");
});

test("manager Insight explains evidence without pretending to predict consent", () => {
  const terms = {
    morale: 72, weeklyGuarantee: 500, appearanceFee: 1000, dateEntitlement: 4,
    termWeeks: 13, marketWeeklyEstimate: 2000, weeksToExpiry: 3,
  };
  const low = staffRetentionAdvice({ ...terms, insight: 40 });
  const high = staffRetentionAdvice({ ...terms, insight: 82 });
  ok(low.includes("check wages") && high.includes("below market"),
    "Insight did not improve level of concrete warning");
  const combined = staffRetentionAdvice({ ...terms, morale: 30, insight: 82 });
  ok(combined.includes("morale"), "poor morale was not explained");
  ok(!high.includes("will reject") && !combined.includes("will reject"),
    "staff advice implies deterministic consent");
  // Nonexclusive dates pay as well as wages: avoid false below-market warnings.
  const withAppearanceFees = staffRetentionAdvice({
    ...terms, insight: 82, appearanceFee: 9000,
  });
  ok(!withAppearanceFees.includes("below market"), "fee package was ignored when evaluating pay");
});

test("26 actual PPW weeks of staff wages are real expenses without retention or booking power", () => {
  for (const seed of [49101, 49102]) {
    const unstaffed = createWorld(seed, DEFAULT_RULESET);
    const independent = unstaffed.promotions.find(p => p.tier === "INDEPENDENT" && p.lifecycle === "ACTIVE");
    if (!independent) throw Error("no Indie promotion for 26-week audit");
    const ownership = createWorldOwnershipState(unstaffed.world.id);
    joinPlayerToWorld(ownership, "player-one", unstaffed.world.currentDate);
    claimIndependentPromotionForPlayer(unstaffed, ownership, "player-one", independent.id);
    independent.cash = Math.max(independent.cash, 8_000_000);
    const staffed = restorePersistedWorldState(createPersistedWorldState(unstaffed));
    const hired = staffed.staffMembers![0]!;
    const commands = createWorldCommandState(staffed.world.id);
    const runtime = createWorldRuntimeState(staffed.world.id);
    const employment = hireStaffCommand(staffed, ownership, commands, runtime, {
      worldId: staffed.world.id, playerId: "player-one", requestId: `hire-${seed}`,
      commandType: "HIRE_STAFF", payload: { promotionId: independent.id, staffId: hired.id },
    });
    const cashInitially = staffed.promotions.find(p => p.id === independent.id)!.cash;
    ok(cashInitially === unstaffed.promotions.find(p => p.id === independent.id)!.cash,
      "hiring charged an unexpected upfront fee");
    for (let week = 0; week < 26; week++) {
      resolveWorldWeek(unstaffed);
      resolveWorldWeek(staffed);
      const paid = staffed.financialTransactions.filter(t =>
        t.promotionId === independent.id && t.category === "STAFF_SALARY" && t.source === employment.id);
      ok(paid.length === week + 1, `missing or duplicate staff wage on PPW week ${week + 1}`);
      ok(paid.every(t => t.amount === -employment.weeklySalary), "staff wage differs from signed amount");
      ok(staffed.promotions.find(p => p.id === independent.id)!.cash
        <= unstaffed.promotions.find(p => p.id === independent.id)!.cash,
      "staff salary somehow gave promoter additional money");
    }
    ok(staffed.contractOffers.length === unstaffed.contractOffers.length,
      "employing a passive manager generated additional contract offers");
    ok(staffed.events.length === unstaffed.events.length,
      "employing a manager generated additional shows or bookings");
    ok(validateWorldInvariants(staffed).length === 0,
      "staffed 26-week World broke invariants");
    const restored = restorePersistedWorldState(createPersistedWorldState(staffed));
    ok(restored.staffEmployments?.find(e => e.id === employment.id)?.status === "ACTIVE",
      "26-week persistence lost active employment");
  }
});

console.log(`\nStaff integration audit tests: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;

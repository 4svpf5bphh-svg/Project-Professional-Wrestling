declare const process: { exitCode?: number };
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  createWorld, createPersistedWorldState, restorePersistedWorldState,
  validateWorldInvariants, settleWorldFinances, seedWorldStaffPool,
} from "../packages/sim-core/src/index.js";
import type { StaffEmployment } from "../packages/domain/src/staff.js";

let passed = 0; let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`); }
}
function ok(value: unknown, message: string): void { if (!value) throw new Error(message); }

function employment(world: ReturnType<typeof createWorld>, staffId: string, promotionId: string): StaffEmployment {
  return {
    id: `employment-${staffId}-${promotionId}`,
    worldId: world.world.id,
    staffId, promotionId, role: "TALENT_MANAGER", status: "ACTIVE",
    startDate: { ...world.world.currentDate }, endedDate: null, weeklySalary: 800,
  };
}

test("staff pool is deterministic, World-unique and not yet employed by default", () => {
  const world = createWorld(26100, DEFAULT_RULESET);
  ok(world.staffMembers?.length === 8, "World genesis did not seed one shared management pool");
  ok(world.staffEmployments?.length === 0, "genesis silently hired managers for promotions");
  ok(JSON.stringify(world.staffMembers) === JSON.stringify(seedWorldStaffPool(world.world.id, world.world.seed)),
    "staff pool is not deterministic");
  ok(new Set(world.staffMembers?.map(staff => staff.id)).size === 8, "duplicate World staff identities");
  ok(validateWorldInvariants(world).length === 0, "unhired staff made World invalid");
});

test("two promotions cannot warehouse or duplicate the same manager", () => {
  const world = createWorld(26101, DEFAULT_RULESET);
  const staff = world.staffMembers![0]!, a = world.promotions[0]!, b = world.promotions[1]!;
  world.staffEmployments!.push(employment(world, staff.id, a.id));
  ok(validateWorldInvariants(world).length === 0, "one legally employed manager invalid");
  world.staffEmployments!.push(employment(world, staff.id, b.id));
  ok(validateWorldInvariants(world).some(error => error.includes("simultaneously works")),
    "a staff member was employable in two promotions in the same World");
});

test("staff salaries are itemised in the canonical weekly ledger, once per employer", () => {
  const withStaff = createWorld(26102, DEFAULT_RULESET);
  const withoutStaff = restorePersistedWorldState(createPersistedWorldState(withStaff));
  const promotion = withStaff.promotions.find(p => p.lifecycle === "ACTIVE")!;
  const manager = withStaff.staffMembers![0]!;
  withStaff.staffEmployments!.push(employment(withStaff, manager.id, promotion.id));
  settleWorldFinances(withoutStaff);
  settleWorldFinances(withStaff);
  const baselinePromotion = withoutStaff.promotions.find(p => p.id === promotion.id)!;
  const staffedPromotion = withStaff.promotions.find(p => p.id === promotion.id)!;
  const charge = withStaff.financialTransactions.filter(t =>
    t.promotionId === promotion.id && t.category === "STAFF_SALARY");
  ok(charge.length === 1 && charge[0]!.amount === -800,
    "hired manager did not incur precisely one 800 weekly cost");
  ok(baselinePromotion.cash - staffedPromotion.cash === 800,
    "staff wage was not reflected in promotion cash accounting");
  ok(staffedPromotion.lastWeeklyNet === baselinePromotion.lastWeeklyNet - 800,
    "staff wage was omitted from weekly net and runway");
});

test("v9 Worlds migrate to a neutral available staff pool without fabricated hires", () => {
  const initial = createWorld(26103, DEFAULT_RULESET);
  const snapshot = createPersistedWorldState(initial);
  const { staffMembers: _members, staffEmployments: _jobs, ...historic } = snapshot;
  const old = { ...historic, stateSchemaVersion: 9 };
  const restored = restorePersistedWorldState(old);
  ok(restored.staffMembers?.length === 8, "historic World did not receive a seeded neutral pool");
  ok(restored.staffEmployments?.length === 0, "migration invented an employment contract");
  ok(validateWorldInvariants(restored).length === 0, "migrated World staff invalid");
});

console.log(`\nWorld staff tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

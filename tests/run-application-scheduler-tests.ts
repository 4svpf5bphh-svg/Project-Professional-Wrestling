declare const process: { exitCode?: number };

import {
  createWorldCommandState,
  activityForPlayer,
  claimIndependentPromotionForPlayer,
  joinPlayerToWorld,
  recordPlayerActivity,
  activeSchedulerDaysBetween,
  createWorldEngagementState,
  recordMissedSchedulerCycles,
  evaluatePlayerInactivity,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  lockPersistedWorldForResolution,
  lockScheduledShowCommitments,
  resolveScheduledWorldCycle,
  PPW_COMMITMENT_UTC_HOUR,
  PPW_RESOLUTION_UTC_HOUR,
  utcScheduledCycleKey,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { readFileSync } from "node:fs";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/memory-world-repository.js";
import { addPpwWeeks, advanceWeek, createWorld } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
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

function fixture(seed: number): ApplicationWorldAggregate {
  const state = createWorld(seed, DEFAULT_RULESET);
  return {
    state,
    ownership: createWorldOwnershipState(state.world.id, 1),
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
  };
}

await test("scheduled commitment lock freezes show commitments without advancing the World", async () => {
  const aggregate = fixture(18010);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  const result = await lockScheduledShowCommitments(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(result.status === "COMMITTED", "first scheduled commitment cycle did not commit");
  ok(after.runtime.phase === "OPEN", "commitment scheduler closed the World");
  ok(after.runtime.commitmentLockedPpwDate?.week === 1, "commitment scheduler did not lock the current PPW week");
  ok(after.runtime.commitmentLockedRealCycleKey === "2026-10-04", "commitment scheduler did not persist its cycle key");
  ok(after.state.world.currentDate.week === 1, "commitment scheduler advanced the PPW week");
});

await test("duplicate scheduled commitment delivery is harmless before World lock", async () => {
  const aggregate = fixture(18011);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await lockScheduledShowCommitments(repository, worldId, "2026-10-04");
  const first = await repository.load(worldId);
  const duplicate = await lockScheduledShowCommitments(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(duplicate.status === "ALREADY_COMMITTED", "duplicate commitment delivery was not recognized");
  ok(after.runtime.phase === "OPEN", "duplicate commitment delivery changed World phase");
  ok(after.runtime.revision === first.runtime.revision, "duplicate commitment delivery changed World revision");
  ok(after.state.world.currentDate.week === 1, "duplicate commitment delivery advanced the PPW week");
});

await test("World resolution follows an earlier commitment lock and clears it", async () => {
  const aggregate = fixture(18012);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await lockScheduledShowCommitments(repository, worldId, "2026-10-04");
  const committed = await repository.load(worldId);
  ok(committed.runtime.phase === "OPEN", "commitment boundary did not leave World open");

  const result = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(result.status === "RESOLVED", "World lock did not resolve after commitment boundary");
  ok(after.state.world.currentDate.week === 2, "World resolution after commitment lock did not advance exactly one week");
  ok(after.runtime.commitmentLockedPpwDate === null, "resolved World retained the prior commitment lock");
  ok(after.runtime.commitmentLockedRealCycleKey === null, "resolved World retained the prior commitment cycle key");
  ok(after.runtime.lastResolvedRealCycleKey === "2026-10-04", "World resolution did not record the resolved cycle");
});

await test("commitment scheduler backs away after the same cycle has already resolved", async () => {
  const aggregate = fixture(18013);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const result = await lockScheduledShowCommitments(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(result.status === "ALREADY_RESOLVED", "late commitment delivery was not treated as already resolved");
  ok(after.state.world.currentDate.week === 2, "late commitment delivery altered the resolved World");
});

await test("scheduled resolver advances exactly one week for a new UTC cycle", async () => {
  const aggregate = fixture(18001);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  const result = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(result.status === "RESOLVED", "first scheduled cycle did not resolve");
  ok(after.state.world.currentDate.week === 2, "scheduled cycle did not advance exactly one PPW week");
  ok(after.runtime.phase === "OPEN", "scheduled cycle did not reopen the World");
  ok(after.runtime.lastResolvedRealCycleKey === "2026-10-04", "scheduled cycle key was not persisted");
  ok(after.runtime.lockedRealCycleKey === null, "resolved World retained its scheduled lock key");
});

await test("duplicate scheduler delivery cannot resolve the same real cycle twice", async () => {
  const aggregate = fixture(18002);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const first = await repository.load(worldId);
  const duplicate = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(duplicate.status === "ALREADY_RESOLVED", "duplicate scheduled cycle was not recognized");
  ok(after.state.world.currentDate.week === first.state.world.currentDate.week, "duplicate scheduler delivery advanced another PPW week");
  ok(after.runtime.revision === first.runtime.revision, "duplicate scheduler delivery changed World revision");
});

await test("a later UTC cycle resolves the next PPW week", async () => {
  const aggregate = fixture(18003);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const second = await resolveScheduledWorldCycle(repository, worldId, "2026-10-05");
  const after = await repository.load(worldId);

  ok(second.status === "RESOLVED", "later scheduled cycle did not resolve");
  ok(after.state.world.currentDate.week === 3, "later scheduled cycle did not advance the next PPW week");
  ok(after.runtime.lastResolvedRealCycleKey === "2026-10-05", "latest scheduled cycle key was not persisted");
});

await test("scheduler recovers a durable lock for the same cycle without double advancing", async () => {
  const aggregate = fixture(18004);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await lockPersistedWorldForResolution(repository, worldId, 0, "2026-10-04");
  const locked = await repository.load(worldId);
  ok(locked.runtime.phase === "LOCKING", "fixture did not persist the World lock");
  ok(locked.runtime.lockedRealCycleKey === "2026-10-04", "fixture did not persist the cycle key");

  const recovered = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const afterRecovery = await repository.load(worldId);
  const duplicate = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const finalState = await repository.load(worldId);

  ok(recovered.status === "RESOLVED", "scheduler did not recover the durable lock");
  ok(afterRecovery.state.world.currentDate.week === 2, "recovered lock did not resolve exactly one week");
  ok(duplicate.status === "ALREADY_RESOLVED", "recovered cycle was not protected from retry");
  ok(finalState.state.world.currentDate.week === 2, "retry after recovery double-resolved the World");
});

await test("scheduler consumes the current cycle when recovering a legacy lock", async () => {
  const aggregate = fixture(18005);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await lockPersistedWorldForResolution(repository, worldId, 0);
  const recovered = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const afterRecovery = await repository.load(worldId);
  const duplicate = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const finalState = await repository.load(worldId);

  ok(recovered.status === "RESOLVED", "legacy lock was not recovered");
  ok(afterRecovery.state.world.currentDate.week === 2, "legacy lock recovery advanced the wrong number of weeks");
  ok(afterRecovery.runtime.lastResolvedRealCycleKey === "2026-10-04", "legacy recovery did not consume the active real cycle");
  ok(duplicate.status === "ALREADY_RESOLVED", "same-cycle retry after legacy recovery was not blocked");
  ok(finalState.state.world.currentDate.week === 2, "same-cycle retry after legacy recovery double-resolved the World");
});

await test("scheduler consumes today rather than double advancing when an older cycle lock is recovered", async () => {
  const aggregate = fixture(18006);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await lockPersistedWorldForResolution(repository, worldId, 0, "2026-10-03");
  const recovered = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const afterRecovery = await repository.load(worldId);
  const duplicate = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");

  ok(recovered.status === "RESOLVED", "older durable lock was not recovered");
  ok(afterRecovery.state.world.currentDate.week === 2, "older lock recovery advanced more than one PPW week");
  ok(afterRecovery.runtime.lastResolvedRealCycleKey === "2026-10-04", "older lock recovery did not consume today's cycle");
  ok(duplicate.status === "ALREADY_RESOLVED", "today's duplicate delivery was not blocked after older lock recovery");
});

await test("an older scheduler delivery is harmless after a newer cycle has resolved", async () => {
  const aggregate = fixture(18007);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-05");
  const before = await repository.load(worldId);
  const stale = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(stale.status === "ALREADY_RESOLVED", "older scheduler delivery was not treated as stale/already resolved");
  ok(after.state.world.currentDate.week === before.state.world.currentDate.week, "older scheduler delivery advanced the World");
  ok(after.runtime.revision === before.runtime.revision, "older scheduler delivery changed World revision");
});

await test("an older scheduler delivery cannot interfere with a newer durable lock", async () => {
  const aggregate = fixture(18008);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await lockPersistedWorldForResolution(repository, worldId, 0, "2026-10-05");
  const stale = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(stale.status === "ALREADY_RESOLVED", "stale scheduler delivery did not back away from newer lock");
  ok(after.runtime.phase === "LOCKING", "stale scheduler delivery changed newer lock phase");
  ok(after.runtime.lockedRealCycleKey === "2026-10-05", "stale scheduler delivery rewrote newer lock cycle");
  ok(after.state.world.currentDate.week === 1, "stale scheduler delivery resolved a newer lock");
});

await test("scheduler rejects malformed real-cycle keys", async () => {
  const aggregate = fixture(18009);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);

  let rejected = false;
  try {
    await resolveScheduledWorldCycle(repository, aggregate.state.world.id, "04-10-2026");
  } catch {
    rejected = true;
  }
  ok(rejected, "malformed cycle key was accepted");
});


await test("all seven UTC weekdays lock then resolve once, with Sunday and duplicate delivery safe", async () => {
  const aggregate = fixture(18020);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  for (let offset = 0; offset < 7; offset += 1) {
    const cycle = new Date(Date.UTC(2026, 9, 5 + offset));
    const cycleKey = utcScheduledCycleKey(cycle);
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(cycle);
    ok(weekday === weekdays[offset], `calendar drift on day ${offset}: got ${weekday}`);
    const commitment = await lockScheduledShowCommitments(repository, worldId, cycleKey);
    ok(commitment.status === "COMMITTED", `${weekday} was not committed`);
    const beforeResolution = await repository.load(worldId);
    ok(beforeResolution.runtime.commitmentLockedRealCycleKey === cycleKey,
      `${weekday} commitment used a different UTC date`);
    ok(beforeResolution.state.world.currentDate.week === offset + 1,
      `${weekday} commitment advanced the World prematurely`);
    const resolution = await resolveScheduledWorldCycle(repository, worldId, cycleKey);
    ok(resolution.status === "RESOLVED", `${weekday} did not resolve once`);
    const after = await repository.load(worldId);
    ok(after.state.world.currentDate.year === 1 && after.state.world.currentDate.week === offset + 2
      && after.state.world.currentDate.day === 1,
      `${weekday} did not advance exactly one complete seven-day PPW week`);
    ok(after.runtime.lastResolvedRealCycleKey === cycleKey, `${weekday} cycle was not recorded`);
    const repeated = await resolveScheduledWorldCycle(repository, worldId, cycleKey);
    ok(repeated.status === "ALREADY_RESOLVED", `${weekday} duplicate caused another resolution`);
  }
  const mondayAfterSunday = utcScheduledCycleKey(new Date(Date.UTC(2026, 9, 12)));
  const nextCommitment = await lockScheduledShowCommitments(repository, worldId, mondayAfterSunday);
  ok(nextCommitment.status === "COMMITTED", "Monday after Sunday rollover could not commit");
  await resolveScheduledWorldCycle(repository, worldId, mondayAfterSunday);
  const nextWeek = await repository.load(worldId);
  ok(nextWeek.state.world.currentDate.week === 9 && nextWeek.state.world.currentDate.day === 1,
    "Monday rollover lost or duplicated an in-game week");
});

await test("daily production cron rules and shared UTC lock/resolve keys stay aligned", async () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  const commit = config.crons.find((entry) => entry.path === "/api/internal/commit-shows");
  const resolve = config.crons.find((entry) => entry.path === "/api/internal/resolve-week");
  ok(commit?.schedule === `0 ${PPW_COMMITMENT_UTC_HOUR} * * *`,
    "production commitment cron must run all 7 UTC weekdays at the canonical hour");
  ok(resolve?.schedule === `0 ${PPW_RESOLUTION_UTC_HOUR} * * *`,
    "production resolution cron must run all 7 UTC weekdays at the canonical hour");
  ok(PPW_COMMITMENT_UTC_HOUR < PPW_RESOLUTION_UTC_HOUR,
    "the full World cannot resolve before the show commitment deadline");
  for (const timestamp of [
    "2026-10-10T23:59:59.999Z", "2026-10-11T00:00:00.000Z",
    "2026-10-24T23:59:59.999Z", "2026-10-25T00:00:00.000Z",
    "2027-03-28T00:00:00.000Z", "2028-02-29T08:00:00.000Z",
  ]) {
    const instant = new Date(timestamp);
    ok(utcScheduledCycleKey(instant) === timestamp.slice(0, 10),
      `UTC cycle key drifted at ${timestamp}`);
  }
  function londonTime(utcIso: string): string {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date(utcIso));
  }
  // Vercel schedules UTC, not British wall-clock time. Tests make the
  // shift explicit rather than accidentally declaring both as 06/08 UK.
  ok(londonTime("2026-10-24T06:00:00Z") === "07:00"
    && londonTime("2026-10-24T08:00:00Z") === "09:00",
    "BST scheduler display is not one hour ahead of UTC");
  ok(londonTime("2026-10-25T06:00:00Z") === "06:00"
    && londonTime("2026-10-25T08:00:00Z") === "08:00",
    "GMT scheduler display did not adjust after autumn clock change");
  ok(londonTime("2027-03-27T06:00:00Z") === "06:00"
    && londonTime("2027-03-28T06:00:00Z") === "07:00",
    "spring clock change was not recognized");
});

await test("PPW's internal day 1–7 calendar stays distinct from daily UTC scheduler cycles", async () => {
  const state = createWorld(18021, DEFAULT_RULESET);
  const weeks = state.ruleset.weeksPerYear;
  ok(weeks === 52, "PPW year must have 52 in-game weeks");
  for (let day = 1; day <= 7; day += 1) {
    const date = { year: 1, week: 52, day };
    const next = addPpwWeeks(date, 1, weeks);
    ok(next.year === 2 && next.week === 1 && next.day === day,
      `PPW day ${day} did not survive the 52-week year boundary`);
  }
  state.world.currentDate = { year: 1, week: 52, day: 7 };
  advanceWeek(state.world, weeks);
  ok(state.world.currentDate.year === 2
    && state.world.currentDate.week === 1
    && state.world.currentDate.day === 1,
    "new PPW week did not restart at Monday after Sunday/year rollover");
});

await test("outage resumes exactly one PPW week and protects accrued inactivity days", async () => {
  const aggregate = fixture(18030);
  joinPlayerToWorld(aggregate.ownership, "offline-player", aggregate.state.world.currentDate);
  const independent = aggregate.state.promotions.find((entry) =>
    entry.tier === "INDEPENDENT" && entry.lifecycle === "ACTIVE");
  ok(independent, "fixture has no claimable independent promotion");
  claimIndependentPromotionForPlayer(aggregate.state, aggregate.ownership, "offline-player", independent.id);
  aggregate.engagement = createWorldEngagementState(aggregate.state.world.id);
  recordPlayerActivity(
    aggregate.engagement, "offline-player", aggregate.state.world.currentDate, 0, "2026-10-01",
  );
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await resolveScheduledWorldCycle(repository, worldId, "2026-10-01");
  const first = await repository.load(worldId);
  const recovered = await resolveScheduledWorldCycle(repository, worldId, "2026-10-12");
  ok(recovered.status === "RESOLVED", "World did not resume after 10 missing cycles");
  let after = await repository.load(worldId);
  ok(after.state.world.currentDate.week === first.state.world.currentDate.week + 1,
    "scheduler replayed multiple unplanned PPW weeks after outage");
  ok(after.runtime.lastResolvedRealCycleKey === "2026-10-12", "resumed cycle did not become authoritative");
  ok(after.engagement?.schedulerPauseSpans?.length === 1
    && after.engagement.schedulerPauseSpans[0]?.firstMissedCycleKey === "2026-10-02"
    && after.engagement.schedulerPauseSpans[0]?.lastMissedCycleKey === "2026-10-11",
    "missing real calendar days were not persisted exactly once");
  ok(after.engagement
    && activeSchedulerDaysBetween(after.engagement, "2026-10-01", "2026-10-12") === 1,
    "missed dates counted toward effective inactive days");
  ok(activityForPlayer(after.engagement!, "offline-player")?.status === "ACTIVE",
    "offline player was unfairly warned or stewarded on recovery");
  ok(after.state.ledger.filter((entry) => entry.type === "SCHEDULER_MISSED_CYCLES_PROTECTED").length === 1,
    "outage was not auditable");

  const duplicate = await resolveScheduledWorldCycle(repository, worldId, "2026-10-12");
  after = await repository.load(worldId);
  ok(duplicate.status === "ALREADY_RESOLVED"
    && after.engagement?.schedulerPauseSpans?.length === 1,
    "retry duplicated outage credit or advanced the World again");
  await resolveScheduledWorldCycle(repository, worldId, "2026-10-18");
  after = await repository.load(worldId);
  ok(after.engagement?.schedulerPauseSpans?.length === 2,
    "second disconnected run of missed cycles was not tracked");
  ok(after.engagement && activeSchedulerDaysBetween(after.engagement, "2026-10-01", "2026-10-18") === 2,
    "second pause did not protect multiple disjoint outages");
});

await test("next normal days accrue inactivity after missed-cycle credit without resetting player activity", async () => {
  const aggregate = fixture(18031);
  const engagement = createWorldEngagementState(aggregate.state.world.id);
  recordPlayerActivity(engagement, "player-a", aggregate.state.world.currentDate, 0, "2026-10-01");
  recordMissedSchedulerCycles(engagement, "2026-10-01", "2026-10-06");
  ok(activeSchedulerDaysBetween(engagement, "2026-10-01", "2026-10-06") === 1,
    "recording a skipped window did not exclude four real dates");
  ok(evaluatePlayerInactivity(engagement, "player-a", "2026-10-11") === "ACTIVE",
    "missing days prematurely caused a warning");
  ok(evaluatePlayerInactivity(engagement, "player-a", "2026-10-12") === "WARNING",
    "normal successful days no longer trigger fair inactivity warnings");
  ok(evaluatePlayerInactivity(engagement, "player-a", "2026-10-19") === "STEWARDED",
    "normal inactivity can no longer progress into Stewardship");
});
console.log(`\nApplication scheduler tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

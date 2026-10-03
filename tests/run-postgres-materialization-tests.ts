declare const process: { env: Record<string, string | undefined>; exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  materializePersistedCurrentWeekReservations,
  reserveDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldAggregate,
  type DetailedShowDraft,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createPostgresApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { createWorld } from "../packages/sim-core/src/index.js";

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL materialization tests");

const { repository, close } = createPostgresApplicationWorldRepository(connectionString);
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

try {
  await repository.migrate();
  await test("PostgreSQL atomically replaces a due reservation with its materialized show", async () => {
    const aggregate = fixture(16150);
    const playerId = "materialization-player";
    joinPlayerToWorld(aggregate.ownership, playerId, aggregate.state.world.currentDate);
    const promotion = aggregate.state.promotions.find(
      (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
    )!;
    claimIndependentPromotionCommand(aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime, {
      requestId: "materialization-claim",
      worldId: aggregate.state.world.id,
      playerId,
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: promotion.id },
    });
    await repository.initialize(aggregate);

    const required = aggregate.state.ruleset.minEventParticipants % 2 === 0
      ? aggregate.state.ruleset.minEventParticipants
      : aggregate.state.ruleset.minEventParticipants + 1;
    const participantIds = [...new Set(aggregate.state.contracts
      .filter((contract) => contract.promotionId === promotion.id && contract.status === "SIGNED" && contract.datesUsed < contract.dateEntitlement)
      .map((contract) => contract.personId))]
      .filter((personId) => aggregate.state.people.find((person) => person.id === personId)?.status === "ACTIVE")
      .slice(0, required);
    if (participantIds.length < required) throw new Error("PostgreSQL materialization fixture lacks reservable roster");
    const market = aggregate.state.markets.find((candidate) => candidate.id === promotion.homeMarketId)!;
    const venue = aggregate.state.venues.find((candidate) => candidate.marketId === market.id)!;
    const draft: DetailedShowDraft = {
      draftId: "postgres-materialized-show",
      promotionId: promotion.id,
      targetDate: { ...aggregate.state.world.currentDate, day: 5 },
      marketId: market.id,
      venueId: venue.id,
      ticketStrategy: "STANDARD",
      participantIds,
      matches: [],
      championshipAssignments: [],
    };

    await repository.transact(aggregate.state.world.id, 1, (working) => {
      upsertDetailedShowDraftCommand(working.state, working.ownership, working.planning, working.commands, working.runtime, {
        requestId: "postgres-save-materialization-draft",
        worldId: working.state.world.id,
        playerId,
        commandType: "UPSERT_DETAILED_SHOW_DRAFT",
        payload: { promotionId: promotion.id, expectedPlanVersion: 0, draft },
      });
    });
    await repository.transact(aggregate.state.world.id, 2, (working) => {
      reserveDetailedShowDraftCommand(working.state, working.ownership, working.planning, working.commands, working.runtime, {
        requestId: "postgres-reserve-materialization-show",
        worldId: working.state.world.id,
        playerId,
        commandType: "RESERVE_DETAILED_SHOW_DRAFT",
        payload: { promotionId: promotion.id, expectedPlanVersion: 1, draftId: draft.draftId },
      });
    });

    const before = await repository.load(aggregate.state.world.id);
    ok(before.runtime.revision === 3, "pre-materialization revision was not persisted");
    ok(before.planning.showReservations.length === 1, "pre-materialization reservation was not persisted");
    const materialized = await materializePersistedCurrentWeekReservations(repository, aggregate.state.world.id, 3);
    ok(materialized.pass.materialized.length === 1, "PostgreSQL materialization pass did not create show");
    ok(materialized.revision === 4, "PostgreSQL materialization did not advance revision exactly once");

    const loaded = await repository.load(aggregate.state.world.id);
    ok(loaded.planning.showReservations.length === 0, "materialized PostgreSQL World retained scarce-resource reservation");
    const event = loaded.state.events.find(
      (candidate) => candidate.promotionId === promotion.id && candidate.status === "SCHEDULED" && candidate.date.day === 5,
    );
    ok(Boolean(event), "materialized event did not survive PostgreSQL reload");
    const appearances = loaded.state.scheduledAppearances.filter((appearance) => appearance.eventId === event!.id);
    ok(appearances.length === participantIds.length, "materialized appearances did not survive PostgreSQL reload");
    ok(loaded.state.ledger.some((entry) => entry.type === "PLANNED_SHOW_MATERIALIZED"), "materialization audit ledger did not persist");

    const retry = await materializePersistedCurrentWeekReservations(repository, aggregate.state.world.id, 4);
    ok(retry.pass.materialized.length === 0, "PostgreSQL materialization retry duplicated show");
    ok(retry.revision === 4, "no-op materialization retry advanced revision");
  });
} finally {
  await close();
}

console.log(`\nPostgreSQL materialization tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

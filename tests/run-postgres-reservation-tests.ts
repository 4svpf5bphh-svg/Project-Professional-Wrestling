declare const process: { env: Record<string, string | undefined>; exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
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
if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL reservation tests");

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
  await test("PostgreSQL persists show reservations atomically with command receipt and revision", async () => {
    const aggregate = fixture(16050);
    joinPlayerToWorld(aggregate.ownership, "reservation-player", aggregate.state.world.currentDate);
    const promotion = aggregate.state.promotions.find(
      (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
    )!;
    claimIndependentPromotionCommand(aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime, {
      requestId: "reservation-claim",
      worldId: aggregate.state.world.id,
      playerId: "reservation-player",
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
    if (participantIds.length < required) throw new Error("PostgreSQL reservation fixture lacks reservable roster");
    const venue = aggregate.state.venues[0]!;
    const draft: DetailedShowDraft = {
      draftId: "postgres-reserved-show",
      promotionId: promotion.id,
      targetDate: { ...aggregate.state.world.currentDate, day: 5 },
      marketId: venue.marketId,
      venueId: venue.id,
      ticketStrategy: "STANDARD",
      participantIds,
      matches: [],
      championshipAssignments: [],
    };

    await repository.transact(aggregate.state.world.id, 1, (working) => {
      upsertDetailedShowDraftCommand(working.state, working.ownership, working.planning, working.commands, working.runtime, {
        requestId: "postgres-save-reservation-draft",
        worldId: working.state.world.id,
        playerId: "reservation-player",
        commandType: "UPSERT_DETAILED_SHOW_DRAFT",
        payload: { promotionId: promotion.id, expectedPlanVersion: 0, draft },
      });
    });
    await repository.transact(aggregate.state.world.id, 2, (working) => {
      reserveDetailedShowDraftCommand(working.state, working.ownership, working.planning, working.commands, working.runtime, {
        requestId: "postgres-reserve-show",
        worldId: working.state.world.id,
        playerId: "reservation-player",
        commandType: "RESERVE_DETAILED_SHOW_DRAFT",
        payload: { promotionId: promotion.id, expectedPlanVersion: 1, draftId: draft.draftId },
      });
    });

    const loaded = await repository.load(aggregate.state.world.id);
    ok(loaded.runtime.revision === 3, "reservation transaction revision was not persisted");
    ok(loaded.planning.showReservations.length === 1, "reservation did not survive PostgreSQL reload");
    ok(loaded.planning.showReservations[0]?.venueId === venue.id, "persisted reservation lost its venue");
    ok(loaded.planning.showReservations[0]?.participants.length === participantIds.length, "persisted reservation lost wrestler commitments");
    ok(loaded.state.events.length === aggregate.state.events.length, "reservation persistence prematurely changed simulation events");
    ok(loaded.commands.receipts.some((receipt) => receipt.requestId === "postgres-reserve-show"), "reservation receipt was not persisted");
  });
} finally {
  await close();
}

console.log(`\nPostgreSQL reservation tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

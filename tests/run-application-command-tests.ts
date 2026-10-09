declare const process: { exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createTagTeamCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  submitContractOfferCommand,
  upsertPromotionShowSeriesCommand,
  archivePromotionShowSeriesCommand,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPerson,
  addPpwWeeks,
  createWorld,
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

function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  return { state, ownership, commands, runtime };
}

test("retrying the same promotion claim returns the committed result without mutating twice", () => {
  const { state, ownership, commands, runtime } = fixture(12001);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  const envelope = {
    requestId: "claim-001",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
    payload: { promotionId: promotion.id, options: { name: "Retry Wrestling" } },
  };

  const first = claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  const controlsAfterFirst = ownership.promotionControls.length;
  const ledgerAfterFirst = state.ledger.filter((entry) => entry.type === "HUMAN_PROMOTION_CLAIMED").length;
  const revisionAfterFirst = runtime.revision;
  const second = claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    ...envelope,
    payload: { options: { name: "Retry Wrestling" }, promotionId: promotion.id },
  });

  ok(first.id === second.id, "retry did not return the originally committed promotion");
  ok(ownership.promotionControls.length === controlsAfterFirst, "retry created another promotion-control record");
  ok(
    state.ledger.filter((entry) => entry.type === "HUMAN_PROMOTION_CLAIMED").length === ledgerAfterFirst,
    "retry wrote the promotion claim to history twice",
  );
  ok(commands.receipts.length === 1, "retry created more than one command receipt");
  ok(revisionAfterFirst === 1 && runtime.revision === 1, "idempotent retry advanced the World revision");
  ok(commands.receipts[0]!.committedRevision === 1, "receipt did not record the committed revision");
});

test("a request ID cannot be reused for a different payload or player", () => {
  const { state, ownership, commands, runtime } = fixture(12002);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotions = state.promotions.filter(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  );

  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-conflict",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotions[0]!.id },
  });

  let payloadRejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, runtime, {
      requestId: "claim-conflict",
      worldId: state.world.id,
      playerId: "player-a",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: promotions[1]!.id },
    });
  } catch {
    payloadRejected = true;
  }
  ok(payloadRejected, "request ID could be reused with a different payload");
  ok(promotions[1]!.controllerType === "AI", "conflicting retry mutated the second promotion");

  let playerRejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, runtime, {
      requestId: "claim-conflict",
      worldId: state.world.id,
      playerId: "player-b",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: promotions[0]!.id },
    });
  } catch {
    playerRejected = true;
  }
  ok(playerRejected, "request ID could be reused by a different player");
  ok(runtime.revision === 1, "conflicting request reuse advanced the World revision");
});

test("a failed command does not consume its request ID or revision", () => {
  const { state, ownership, commands, runtime } = fixture(12003);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  const envelope = {
    requestId: "claim-after-failure",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
    payload: { promotionId: promotion.id },
  };

  let rejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  } catch {
    rejected = true;
  }
  ok(rejected, "claim without World membership unexpectedly succeeded");
  ok(commands.receipts.length === 0, "failed command was recorded as committed");
  ok(runtime.revision === 0, "failed command advanced the World revision");
  ok(promotion.controllerType === "AI", "failed command partially mutated promotion control");

  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const claimed = claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  ok(claimed.controllerType === "HUMAN", "same request could not succeed after the underlying problem was fixed");
  ok(commands.receipts.length === 1, "successful retry did not create exactly one receipt");
  ok(runtime.revision === 1, "successful retry did not advance revision exactly once");
});

test("retrying a contract offer cannot submit, allocate or revise twice", () => {
  const { state, ownership, commands, runtime } = fixture(12004);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-for-contract",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  const freeAgent = state.people.find(
    (person) => person.status === "ACTIVE" && activeContractsForPerson(state, person.id).length === 0,
  )!;
  const payload = {
    promotionId: promotion.id,
    personId: freeAgent.id,
    family: "LIMITED_NON_EXCLUSIVE" as const,
    exclusivity: "NON_EXCLUSIVE" as const,
    roleExpectation: "FEATURED" as const,
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 4,
    weeklyGuarantee: 12_000,
    appearanceFee: 6_500,
    signingBonus: 8_000,
  };
  const envelope = {
    requestId: "offer-001",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "SUBMIT_CONTRACT_OFFER" as const,
    payload,
  };

  const first = submitContractOfferCommand(state, ownership, commands, runtime, envelope);
  const offerCount = state.contractOffers.length;
  const ledgerCount = state.ledger.filter((entry) => entry.type === "HUMAN_CONTRACT_OFFER_SUBMITTED").length;
  const revisionAfterFirst = runtime.revision;
  const second = submitContractOfferCommand(state, ownership, commands, runtime, envelope);

  ok(first.id === second.id, "contract retry did not return the original offer");
  ok(state.contractOffers.length === offerCount, "contract retry submitted a duplicate offer");
  ok(
    state.ledger.filter((entry) => entry.type === "HUMAN_CONTRACT_OFFER_SUBMITTED").length === ledgerCount,
    "contract retry wrote a duplicate Ledger entry",
  );
  ok(commands.receipts.filter((receipt) => receipt.requestId === "offer-001").length === 1, "offer retry duplicated receipt");
  ok(revisionAfterFirst === 2 && runtime.revision === 2, "contract retry advanced revision more than once");
});

test("creating a tag team is idempotent and does not manufacture chemistry", () => {
  const { state, ownership, commands, runtime } = fixture(12006);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-for-team",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  const roster = state.contracts
    .filter((contract) => contract.promotionId === promotion.id && contract.status === "SIGNED")
    .map((contract) => contract.personId)
    .filter((personId, index, all) => all.indexOf(personId) === index);
  ok(roster.length >= 2, "team fixture needs two roster wrestlers");
  const chemistryBefore = state.workingChemistry.length;
  const envelope = {
    requestId: "create-team-001",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CREATE_TAG_TEAM" as const,
    payload: {
      promotionId: promotion.id,
      name: "The Test Pilots",
      personIds: [roster[0]!, roster[1]!] as [string, string],
    },
  };

  const first = createTagTeamCommand(state, ownership, commands, runtime, envelope);
  const revisionAfterFirst = runtime.revision;
  const second = createTagTeamCommand(state, ownership, commands, runtime, envelope);

  ok(first.id === second.id, "team retry returned a different team");
  ok((state.teams ?? []).filter((team) => team.id === first.id).length === 1, "team retry duplicated team identity");
  ok((state.teamMemberships ?? []).filter((membership) => membership.teamId === first.id && membership.active).length === 2, "team creation did not create exactly two memberships");
  ok(state.workingChemistry.length === chemistryBefore, "forming a team manufactured chemistry");
  ok(state.ledger.filter((entry) => entry.type === "TEAM_FORMED" && entry.entityIds.includes(first.id)).length === 1, "team formation history duplicated");
  ok(runtime.revision === revisionAfterFirst, "team retry advanced World revision");

  let duplicateRejected = false;
  try {
    createTagTeamCommand(state, ownership, commands, runtime, {
      ...envelope,
      requestId: "create-team-duplicate-pair",
      payload: { ...envelope.payload, name: "Different Name" },
    });
  } catch {
    duplicateRejected = true;
  }
  ok(duplicateRejected, "same pair could create a duplicate active team identity");
});

test("player-created tag teams cannot mix men's and women's divisions", () => {
  const { state, ownership, commands, runtime } = fixture(12007);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-for-mixed-team",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  const roster = state.contracts
    .filter((contract) => contract.promotionId === promotion.id && contract.status === "SIGNED")
    .map((contract) => contract.personId)
    .filter((personId, index, all) => all.indexOf(personId) === index);
  ok(roster.length >= 2, "mixed-team fixture needs two roster wrestlers");
  state.people.find((person) => person.id === roster[0])!.division = "MEN";
  state.people.find((person) => person.id === roster[1])!.division = "WOMEN";
  const teamsBefore = state.teams?.length ?? 0;
  let rejected = false;
  try {
    createTagTeamCommand(state, ownership, commands, runtime, {
      requestId: "mixed-team",
      worldId: state.world.id,
      playerId: "player-a",
      commandType: "CREATE_TAG_TEAM",
      payload: {
        promotionId: promotion.id,
        name: "Mixed Test Team",
        personIds: [roster[0]!, roster[1]!] as [string, string],
      },
    });
  } catch (error) {
    rejected = String(error).includes("cannot mix");
  }
  ok(rejected, "mixed-division tag team was created");
  ok((state.teams?.length ?? 0) === teamsBefore, "rejected mixed team partially mutated team state");
});

test("contract command authorization is tied to the player-owned promotion", () => {
  const { state, ownership, commands, runtime } = fixture(12005);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-owned",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  const freeAgent = state.people.find(
    (person) => person.status === "ACTIVE" && activeContractsForPerson(state, person.id).length === 0,
  )!;

  let rejected = false;
  try {
    submitContractOfferCommand(state, ownership, commands, runtime, {
      requestId: "unauthorized-offer",
      worldId: state.world.id,
      playerId: "player-b",
      commandType: "SUBMIT_CONTRACT_OFFER",
      payload: {
        promotionId: promotion.id,
        personId: freeAgent.id,
        family: "ONE_OFF",
        exclusivity: "OPEN",
        roleExpectation: "REGULAR",
        startDate: { ...state.world.currentDate },
        endDate: { ...state.world.currentDate },
        dateEntitlement: 1,
        weeklyGuarantee: 0,
        appearanceFee: 10_000,
        signingBonus: 0,
      },
    });
  } catch {
    rejected = true;
  }

  ok(rejected, "player could submit a contract offer for another player's promotion");
  ok(!commands.receipts.some((receipt) => receipt.requestId === "unauthorized-offer"), "unauthorized command was committed");
  ok(runtime.revision === 1, "unauthorized command advanced World revision");
});



test("show identities are editable only by their promotion owner and custom identities can be archived", () => {
  const { state, ownership, commands, runtime } = fixture(12008);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-for-calendar",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });

  const flagship = state.showSeries?.find((series) => series.promotionId === promotion.id && series.role === "FLAGSHIP");
  if (!flagship) throw new Error("calendar fixture is missing a flagship identity");

  const renamed = upsertPromotionShowSeriesCommand(state, ownership, commands, runtime, {
    requestId: "rename-flagship",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "UPSERT_PROMOTION_SHOW_SERIES",
    payload: {
      promotionId: promotion.id,
      showSeriesId: flagship.id,
      name: "Friday Fight Night",
      role: "FLAGSHIP",
      eventType: "REGULAR",
      cadenceWeeks: 1,
      anchorWeek: 0,
      eventImportance: 62,
    },
  });
  ok(renamed.name === "Friday Fight Night", "owner could not rename the flagship show identity");

  const created = upsertPromotionShowSeriesCommand(state, ownership, commands, runtime, {
    requestId: "create-special",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "UPSERT_PROMOTION_SHOW_SERIES",
    payload: {
      promotionId: promotion.id,
      name: "Final Reckoning",
      role: "SPECIAL",
      eventType: "MAJOR",
      cadenceWeeks: state.ruleset.weeksPerYear,
      anchorWeek: 12,
      eventImportance: 88,
    },
  });
  const retried = upsertPromotionShowSeriesCommand(state, ownership, commands, runtime, {
    requestId: "create-special",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "UPSERT_PROMOTION_SHOW_SERIES",
    payload: {
      promotionId: promotion.id,
      name: "Final Reckoning",
      role: "SPECIAL",
      eventType: "MAJOR",
      cadenceWeeks: state.ruleset.weeksPerYear,
      anchorWeek: 12,
      eventImportance: 88,
    },
  });
  ok(created.id === retried.id, "show-series command retry created a second identity");
  ok(state.showSeries?.filter((series) => series.id === created.id).length === 1, "custom show identity duplicated");

  let foreignEditRejected = false;
  try {
    upsertPromotionShowSeriesCommand(state, ownership, commands, runtime, {
      requestId: "foreign-calendar-edit",
      worldId: state.world.id,
      playerId: "player-b",
      commandType: "UPSERT_PROMOTION_SHOW_SERIES",
      payload: {
        promotionId: promotion.id,
        showSeriesId: created.id,
        name: "Stolen Event",
        role: "SPECIAL",
        eventType: "MAJOR",
        cadenceWeeks: state.ruleset.weeksPerYear,
        anchorWeek: 12,
        eventImportance: 88,
      },
    });
  } catch {
    foreignEditRejected = true;
  }
  ok(foreignEditRejected, "another player could edit a promotion's show calendar");

  const archived = archivePromotionShowSeriesCommand(state, ownership, commands, runtime, {
    requestId: "archive-special",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "ARCHIVE_PROMOTION_SHOW_SERIES",
    payload: { promotionId: promotion.id, showSeriesId: created.id },
  });
  ok(archived.active === false, "custom show identity was not archived");

  let flagshipArchiveRejected = false;
  try {
    archivePromotionShowSeriesCommand(state, ownership, commands, runtime, {
      requestId: "archive-flagship",
      worldId: state.world.id,
      playerId: "player-a",
      commandType: "ARCHIVE_PROMOTION_SHOW_SERIES",
      payload: { promotionId: promotion.id, showSeriesId: flagship.id },
    });
  } catch {
    flagshipArchiveRejected = true;
  }
  ok(flagshipArchiveRejected, "mandatory flagship identity could be archived");
});

console.log(`\nApplication command tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

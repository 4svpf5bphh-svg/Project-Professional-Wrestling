from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f"{path}: expected {count} occurrences, found {actual}: {old!r}")
    write(path, text.replace(old, new))


# Resolution: stop mutating ownership to borrow AI execution.
replace(
    "packages/sim-core/src/resolution.ts",
    '''function withTemporaryAiControl(state: WorldState, promotionIds: ReadonlySet<string>, action: () => void): void {\n  const changed = state.promotions.filter(\n    (promotion) => promotion.controllerType === "HUMAN" && promotionIds.has(promotion.id),\n  );\n  for (const promotion of changed) promotion.controllerType = "AI";\n  try {\n    action();\n  } finally {\n    for (const promotion of changed) promotion.controllerType = "HUMAN";\n  }\n}\n\n''',
    "",
)
replace(
    "packages/sim-core/src/resolution.ts",
    '''  withTemporaryAiControl(state, staffPlansShow, () => planWorldEvents(state));\n  withTemporaryAiControl(state, staffControlsCard, () => resolveWorldEvents(state));''',
    '''  planWorldEvents(state, { staffMayPlanShowFor: staffPlansShow });\n  resolveWorldEvents(state, { staffMayBookCardFor: staffControlsCard });''',
)

# Event layer: execution authority is explicit and independent from controller ownership.
replace(
    "packages/sim-core/src/events.ts",
    '''export function planWorldEvents(state: WorldState): void {''',
    '''export interface WorldEventExecutionPolicy {\n  staffMayPlanShowFor?: ReadonlySet<string>;\n  staffMayBookCardFor?: ReadonlySet<string>;\n}\n\nexport function planWorldEvents(state: WorldState, execution: WorldEventExecutionPolicy = {}): void {''',
)
replace(
    "packages/sim-core/src/events.ts",
    '''    if (promotion.controllerType !== "AI") continue;''',
    '''    if (promotion.controllerType !== "AI" && !execution.staffMayPlanShowFor?.has(promotion.id)) continue;''',
)
replace(
    "packages/sim-core/src/events.ts",
    '''  contractsById: Map<string, Contract>,\n): void {''',
    '''  contractsById: Map<string, Contract>,\n  staffMayBookCard: boolean,\n): void {''',
)
replace(
    "packages/sim-core/src/events.ts",
    '''  const { usedPersonIds, completedMatches } = resolveEventCard(state, event, eligibleAppearances);''',
    '''  const { usedPersonIds, completedMatches } = resolveEventCard(state, event, eligibleAppearances, { staffMayBookCard });''',
)
replace(
    "packages/sim-core/src/events.ts",
    '''export function resolveWorldEvents(state: WorldState): void {''',
    '''export function resolveWorldEvents(state: WorldState, execution: WorldEventExecutionPolicy = {}): void {''',
)
replace(
    "packages/sim-core/src/events.ts",
    '''      currentContractById,\n    );''',
    '''      currentContractById,\n      execution.staffMayBookCardFor?.has(promotion.id) === true,\n    );''',
)

# Match layer: a human card remains authoritative unless explicit staff card authority fills a missing card.
replace(
    "packages/sim-core/src/matches.ts",
    '''function preparedHumanEventCard(state: WorldState, event: WrestlingEvent, appearances: ScheduledAppearance[]): PlannedMatch[] | null {''',
    '''function preparedHumanEventCard(\n  state: WorldState,\n  event: WrestlingEvent,\n  appearances: ScheduledAppearance[],\n  staffMayBookCard: boolean,\n): PlannedMatch[] | null {''',
)
replace(
    "packages/sim-core/src/matches.ts",
    '''  if (scheduledMatches.length === 0) return [];''',
    '''  if (scheduledMatches.length === 0) return staffMayBookCard ? null : [];''',
)
replace(
    "packages/sim-core/src/matches.ts",
    '''export function resolveEventCard(state: WorldState, event: WrestlingEvent, appearances: ScheduledAppearance[]): { usedPersonIds: Set<string>; completedMatches: Match[] } {\n  const preparedHumanCard = preparedHumanEventCard(state, event, appearances);''',
    '''export function resolveEventCard(\n  state: WorldState,\n  event: WrestlingEvent,\n  appearances: ScheduledAppearance[],\n  execution: { staffMayBookCard?: boolean } = {},\n): { usedPersonIds: Set<string>; completedMatches: Match[] } {\n  const preparedHumanCard = preparedHumanEventCard(state, event, appearances, execution.staffMayBookCard === true);''',
)

# Tests: prove staff can execute delegated work while ownership remains HUMAN throughout the call boundary.
replace(
    "tests/run-human-routine-tests.ts",
    '''  prepareHumanShow,\n  resolveWorldWeek,''',
    '''  prepareHumanShow,\n  planWorldEvents,\n  resolveWorldEvents,\n  resolveWorldWeek,''',
)
marker = '''test("fully prepared human show runs untouched without a routine takeover", () => {'''
insert = '''test("staff show authority plans for a human promotion without changing ownership", () => {\n  const { state, promotionId } = fixture(13006);\n  const promotion = state.promotions.find((candidate) => candidate.id === promotionId)!;\n  ok(promotion.controllerType === "HUMAN", "fixture did not begin under human ownership");\n\n  planWorldEvents(state, { staffMayPlanShowFor: new Set([promotionId]) });\n\n  ok(promotion.controllerType === "HUMAN", "staff show planning changed promotion ownership");\n  const event = state.events.find(\n    (candidate) => candidate.promotionId === promotionId && candidate.date.year === 1 && candidate.date.week === 1,\n  );\n  ok(Boolean(event), "explicit staff show authority did not plan the missing human show");\n  ok(event!.status === "SCHEDULED", "staff-planned human show did not remain scheduled for resolution");\n});\n\ntest("staff card authority books a missing human card without changing ownership", () => {\n  const { state, promotionId, participantIds } = fixture(13007);\n  const promotion = state.promotions.find((candidate) => candidate.id === promotionId)!;\n  const event = prepareShow(state, promotionId, participantIds);\n  ok(promotion.controllerType === "HUMAN", "fixture did not begin under human ownership");\n\n  resolveWorldEvents(state, { staffMayBookCardFor: new Set([promotionId]) });\n\n  ok(promotion.controllerType === "HUMAN", "staff card execution changed promotion ownership");\n  ok(event.status === "COMPLETED", `staff-authorized human card finished as ${event.status}`);\n  ok(state.matches.some((match) => match.eventId === event.id && match.status === "COMPLETED"), "staff authority did not create and resolve the missing card");\n});\n\n'''
text = read("tests/run-human-routine-tests.ts")
if text.count(marker) != 1:
    raise RuntimeError("routine tests: insertion marker mismatch")
write("tests/run-human-routine-tests.ts", text.replace(marker, insert + marker))

print("Staff execution boundary slice applied")

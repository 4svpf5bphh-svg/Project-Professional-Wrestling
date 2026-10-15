# PPW persistence rebuild execution contract — 15 October 2026

Status: implementation plan, not deployment authorization. Source of truth: docs/ROADMAP-LOCK-2026-10-14.md, docs/ALPHA-1-ARCHITECTURE-REVIEW.md, docs/ALPHA-1A-GATE-B-TRANSACTIONAL-PERSISTENCE.md, docs/PPW-FEATURE-DEPENDENCY-AUDIT.md.

## Scope
Keep deterministic sim-core, domain, application gameplay logic, content, UI and existing API response contracts. Replace the persistence/read access bottleneck, not the game. Existing JSONB/gzip World checkpoint is the rollback and recovery format until parity is proven. The original Gate B.4 architecture explicitly identified the JSONB checkpoint as temporary.

## Invariants
- One authoritative World and wrestler identity, identical AI/human rules, authored match/segment outcomes.
- Commitment Lock then World Lock; one deterministic weekly resolution and crash-safe retries.
- Server-side ownership, player isolation, optimistic revisions plus serialized authoritative mutations.
- Immutable idempotency receipts; same command never double-applies.
- Preserve contract dates, exclusivity, money, roster, morale, career time, ledger, staff and engagement.
- No World reset, branch deletion, production merge or deployment without explicit approval.

## Evidence
Cold /api/session, /api/talent and /api/results-overview requests may download a full World gzip (~556 KB in the observed live World). loadTalentView trims history after loading, not before. Routine GETs also probe engagement. Per-process snapshot counters do not equal Neon billed egress. A prior audit measured 204 branches and documented 44 previously zero-ahead cleanup candidates, but those must be rechecked.

## Target architecture
Keep authoritative checkpoint for deterministic simulation and recovery. Add *small, transactionally versioned* per-player read projections for high-frequency navigation. Never duplicate the entire World per player.

First slice: /api/session. Preserve response schema exactly; generate using the existing application projection logic. Store world_id, player_id, projection kind, schema version, authoritative version/revision, payload and update time. Query by authorized player identity, never untrusted client-supplied identity. A valid read model must be served without fetching world_state_gzip.

On authoritative mutation, update checkpoint, runtime, receipts and affected projections in the **same transaction**. No eventual consistency for lock-sensitive screens. On missing/stale projection, fall back to authoritative read and repair with version guard. Activity-only changes must not invalidate unrelated heavyweight views. The read model is never a second source of gameplay truth.

If projections prove too costly to maintain, normalize a bounded set of hot transactional entities (planning, contracts, reservations), not every sim object. Preserve one authoritative mutation boundary.

## First acceptance gate
1. Golden response deep equality: legacy vs projected Home for two different players.
2. Player A cannot see player B private contracts, plans, notices.
3. Fresh server process reads only narrow projection when current.
4. A mutation invalidates B's stale view across processes.
5. World Lock/resolution is atomic and recoverable.
6. Repeated command IDs return identical receipt/results with no double effects.
7. Old World save restores equivalent state and simulation hashes.
8. Two-player fixture (600+ wrestlers) measured for Home, talent, results, card save, contracts, locks, resolution and idle.
9. Record SQL calls, transferred DB-to-app bytes, writes, latency and Neon billed transfer; estimate <=2.5 GB/month for two players with headroom. Payload estimates alone do not satisfy this gate.

## Execution sequence
A. Verify CI green and capture golden responses.
B. Implement one end-to-end session read projection, migration and tests on an isolated branch.
C. Benchmark cold/warm and two-player concurrency against unchanged baseline.
D. Only if proven, extend to talent/results and reduce mutation write amplification.
E. Request user approval before controlled production release; keep rollback checkpoint.
F. Resume docs/ROADMAP-LOCK-2026-10-14.md point 1 (Contracts/Talent).

## Preserve the backlog
Contracts Desk, future renewals, date amendments, mobile input sizing, deep links and dismissible alerts; iPhone card scrolling, compact booking editor, wrestler picker and card reordering; segment purposes/roles/outcomes, debut/return, video packages and scripted consequences; stable and tag-team continuity; wrestler-owned gimmicks, moves, relationships and creative resistance; Talent Manager and backstage phone messages; distinctive results, staff commentary and fan reactions; A/B shows, calendar, championships, business, multiplayer fairness, historical collections and noncompetitive Kayfabe Points. Existing code, tests, documents and unmerged PRs remain evidence, not disposable experiments.

## GitHub cleanup
Read docs/FINAL-GITHUB-BRANCH-DELETE-LISTS-2026-10-14.md and docs/DELETE-APPROVED-BRANCHES-2026-10-14.md before any cleanup. The 44 previously zero-ahead branches are candidates, not unconditional approval. Verify current SHA, ahead commits, PRs, protection, unique code/tests and deployment/recovery dependency at deletion time. On 15 October there were 15 open PRs (#101, #98, #93, #92, #90, #87, #86, #85, #83, #82, #81, #59, #58, #52, #34); preserve their branches until disposition. Do not delete main, production Neon, recovery snapshots or active preview dependencies.

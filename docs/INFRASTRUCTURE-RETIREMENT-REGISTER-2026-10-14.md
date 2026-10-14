# PPW repository cleanup — retirement register (14 October 2026)

## Ground rules
- Production `main` is the only release branch and production World must never be reset or deleted.
- Vercel automatic preview deployments are disabled. Do not restore them without an explicit testing requirement.
- Neon production `main` and both recovery snapshots are protected. `preview/alpha-1a` was retired; two access-gate preview Neon branches remain pending connection/dependency verification.
- Deleting a Git branch reference does not delete commits already reachable from `main`. Never delete a branch with commits ahead of `main` without separately verifying its feature contents and current equivalent.
- No automatic deployment on housekeeping changes; this document lives on `work/neon-cleanup-batched`.

## Audit findings
204 GitHub branches inspected against `main`: 178 with zero ahead commits, 26 with one or more ahead commits (including the current work branch). Counts describe commit ancestry, not necessarily missing features.

### Retirement candidates
All 178 zero-ahead branch references are eligible for retirement after a final current-head comparison, open PR/protection check and GitHub branch deletion through an authorized channel. Categories: legacy Alpha and `work-alpha-1a-*`, Alpha freeze/validation/gates, historical `sim-*` (except `sim-0.0.7` and `sim-0.0.8`), `tmp-*`, `ignore*`, completed `work/*`, and older fix/release references. Keep `main` and current `work/neon-cleanup-batched`.

### Protect pending review
`alpha-character-pitches` (3 ahead); `alpha-freeze-booking-game-programmes` (11); `alpha-gate-f-roster-talent` (2); `sim-0.0.7` (14); `sim-0.0.8` (19).
Also protect outstanding feature/integration branches including `work/results-review-voice-v1`, `work/combined-playtest-release`, `work/contract-desk-clean-main`, `work/contracts-desk-playtest-integration`, `work/live-debut-return-appearances`, `work/card-ios-nested-scroll-lock-hotfix`, `work/alpha-access-gate`, `work/alpha-access-gate-current`, and any other branch with ahead commits. Some may be squash-integrated; compare file functionality before retiring.

## Temporary resource exit checklist
1. Name owner, reason, expected expiry, replacement and rollback source at creation.
2. After integration: verify production release and database routing; confirm no open PR or active deployment dependency.
3. Retire preview deployments/variables and Neon preview branches only after positive dependency verification.
4. Remove branch refs once commits are contained in `main` or unique changes are deliberately archived/dispositioned.
5. Notify the user when the temporary stage ends and identify exactly which resources can now be removed.
6. Keep at most one active production World; retain documented, non-running recovery snapshots.

## Remaining blockers
- Connected GitHub actions do not expose deletion of branch refs, so the 178 candidates are **not deleted**.
- Two access-gate Neon branches have idle computes but require final dependency verification; previous deletion attempt was blocked.
- The 26 ahead-commit branches require feature-level disposition.

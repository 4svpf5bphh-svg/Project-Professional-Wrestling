# PPW — Show Results Wave 2: Who Cheated?
13 October 2026. Draft stacked above PR #74. No merge, deploy, migrations, contract changes or World reset.

## Product rule
- The finish still says **foreign object**, not "chair", "ring bell" or an exhaustive weapon inventory.
- In **singles**, identify the only wrestler on the cheating side automatically.
- In **tags**, the booker chooses **one specific wrestler on the cheating team** in the Card editor. No random wrestler attribution and no assumption that both tag partners cheated.
- DQ cheating side = **the losing team** (caught by the referee); foreign-object cheating side = **the winning team** (referee unsighted). The booked winning side remains the authorial truth.
- Switching the booked winner or finish clears the previous culprit. If the booker changes team members, a stale/wrong-side culprit is rejected when saving.
- Captured identity is stored as a wrestler ID in the authoritative planned match. World Resolution records it in `MATCH_COMPLETED` **only if that cheating finish actually happens**. An injury-stoppage override does not record the unrealized cheating action.
- Private and public completed show views get the same checked result: a named culprit must be a recorded participant on the right side of the actual resolved finish. Old matches lacking attribution remain unnamed. Results copy never names a weapon and never infers an individual in a tag match.
- Existing title-on-DQ rule and successful interference restrictions from PR #74 remain untouched.

## Dependency decisions
1. Depends on: booked winner, two participant sides, planned finish, match resolution, ledger, completed-results projections.
2. Downstream: highlights, results storytelling, feud continuity, match recap language.
3. Authoritative vs presentation: culprit choice/validation/frozen performance is authority-side; name rendering is a read-only public/private projection.
4. Smallest complete: singles auto-culprit; tag selector, validation, persisted identity, truthful recorded replay, regressions and full CI. No weapon choices or additional random referee behaviour.

## Verification
Web Card end-to-end tests reject unnamed and wrong-side tag culprits; accept and persist the selected performer across World Lock; confirm no cheater in injury-stoppage ledger. Results tests cover owner/public parity and historical safety. Full CI required on this exact branch.

**Release gate:** the normal PR-to-main GitHub workflow verifies this unmerged, stacked draft; restore its parent branch after completion.

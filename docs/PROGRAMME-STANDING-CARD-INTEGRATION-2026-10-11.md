# PPW — Explicit Programme matches and standing creative consent

Status: protected CI branch only. No merge, Vercel preview, deployment or World reset.

## Scope
- An optional explicit Programme link is carried through the Show Card UI, HTTP parsing, application validation, and World planning persistence. Historical unmatched cards remain unlinked.
- Only an active Programme belonging to the controlling promotion and including every booked competitor may be linked. The server enforces this; no auto-association based on opponents.
- Exact match consent signatures include the Programme link, so switching storylines cannot reuse a stale waiver.
- A prior standing consent can satisfy only that wrestler's FULL_APPROVAL match-assignment right, and only within its agreed contract, Programme, opponents, type, permitted finish and expiry. Clean/submission losses, third-party interference, altered opposition and unlinked cards remain blocked.
- The UI distinguishes 'Covered by Programme agreement' from one-match consent. No separate match approval record is fabricated and no scripted winner or finish is rewritten.
- Current-week committed-card safety, proposed amendment withdrawal, future-show reservation and World Lock continue to use the existing unified blocker audit.

## Tests and release boundaries
- Pure regression on explicit linking, clean loss, interference, altered match, unlinked legacy drafts, invalid foreign Programme reference.
- Repository integration on saving, reading, unlinking and forged competitor links without partial World mutation.
- Player negotiation UI still deferred: the server-owned idempotent requestStandingProgrammeCreativeAgreementCommand is present but not surfaced as a new conversation until Backstage integration is designed.
- Future mobile Backstage chat presentation reuses existing conversation/decision state. Paid creative-control clauses remain disabled.

Four checks: depends on actual Programmes/contracts, underpins later Backstage standing agreements, simulated evidence remains server-authoritative, smallest usable stage is a safe optional Programme selector.

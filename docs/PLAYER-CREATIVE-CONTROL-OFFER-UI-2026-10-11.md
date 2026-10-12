# PPW — player-selectable creative control during contract offers

**CI-only draft**, stacked after PR #30 and the validated seven-seed creative economics / AI backoff audit. No merge, Vercel preview, deployment or World reset.

## Smallest complete player-facing version

- Both **new recruitment and renewal offers** now support four genuine contract clause levels: Standard/NONE, Consultation, Protected finishes, Full creative approval.
- Use **tap-friendly selectable cards**, not another generic grey dropdown. New wrestlers default to NONE. A renewal starts with the original wrestler's **existing signed level** to avoid an accidental loss or increase in rights; the player may explicitly propose a different level.
- A plain-language description explains each tier's precise booking implications. Especially: consultation is not a veto, protected finishes require consent only for clean/submission losses, and FULL_APPROVAL can cause a wrestler to decline a booking; standing Programme terms mitigate repetitive requests but never override their limited scope.
- The existing salary/appearance fee/signing bonus guidance remains visible and updates with changed money/term/dates. Creative concessions may make a credible bid more attractive to autonomy-minded wrestlers, but **do not guarantee acceptance and cannot replace viable cash terms**. No fake acceptance percentage, secret opponent contract disclosure, or fabricated specific cash savings.
- New offers, older API clients omitting the field and any exact replay of an omitted NONE clause normalize to NONE. The HTTP service rejects invalid/forged values before changing the World.
- Clause choice travels through the actual ownership-controlled, server-authoritative World command to the pending contract offer, and is visible in the pending offer summary. The signed contract acquires it through existing acceptance rules; this does **not** instantly rewrite an already signed deal.
- Same request ID with changed creative terms is **rejected without changing the revision, offer or receipt**. All four explicit values are tested end-to-end; the original date-addendum path stays separate and cannot change creative rights.
- Contract value and AI rivalry have **no player-special bonuses**: same shared credible bonus, deterministic willingness and rejection as the previous full multi-seed audit.
- One-off appearances can choose rights, but their short validity severely discounts bargaining value and they can still be refused. For ordinary indies, the cheap straightforward starting choice remains NONE.

## Dependency questions

1. Depends on signed contract rights, existing wrestler utility and World ownership/idempotency, Show Card matching and standing Programme creative consent.
2. Enables player-facing negotiation, selective Backstage discussions, future rich persistent chat history, meaningful bidding versus other promotions.
3. The offer and decision are simulation/application state; the selectable cards and bargaining explanations are merely presentation.
4. First complete release is an optional four-card picker with authoritative API persistence and replay guards, not another multi-page legal negotiation system.

## Tests and remaining gates

- Existing and new Web Talent service regressions cover four levels, backward compatibility, pending-view round trip, unauthorized level, exact retry versus altered request, and explicit renewal rights without premature mutation.
- Full application/Backstage, web build, HTTP/PostgreSQL, seven-seed creative audit and 10-year simulation must pass before treating the draft as validated.
- A passing automated suite isn't proof that real multiplayer experience is ideal. Continue to playtest offer economics, UI comprehension, wrestler refusals and protected-finish friction before the eventual bundled reset/deployment.

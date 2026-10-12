# PPW — Creative-control economics and AI parity (11 October 2026)

Status: isolated CI-only PR after PR #27. No merge, Vercel preview, production deployment, player World reset or player-selectable creative clauses.

## What changes
- The same wrestler-utility engine now scores creative-rights concessions from both AI and human promotions. Creative control still cannot rewrite scripted wrestling outcomes; its cost to a promoter is the future consent and protected-finish obligations already enforced by the booking engine.
- A signed creative promise has real noncash value, but does not substitute for an implausibly low cash package. The base autonomy premium is multiplied by the existing offer money score and contract duration. Zero/weak pay receives a small fraction; a market-credible offer receives the full incremental premium.
- One-off creative clauses have minimal bargaining value and should never mimic 26/52-week promises. Dates addenda cannot buy or change contractual creative control.
- Cautious AI promoters now choose modest rights on new/renewal offers based on actual wrestler recognisability, role/schedule priorities, promotion tier, contract family and financial distress. Rarer full approval requires a healthy premium promotion, genuine main-event star, strong autonomy preference and exclusive deal. Financial crisis never grants new creative perks.
- The generator never rewrites the AI's wages, bonuses, appearance fees, exclusivity, term or date counts to justify a clause. The wrestler accepts/rejects through the same uncertainty/utility engine, and the signed contract carries the real right forward.

## Multiplayer and economics boundaries
- No online-status benefit and no special cheap AI acceptance threshold. A player does not have a hidden penalty against an identically priced and scoped AI offer.
- Opponent permissions are evaluated in the actual World when shows are booked. AI and Routine Continuity respect protected finish/full consent; the existing automated creative-booking tests cover this.
- This wave changes future AI contract offers (and their negotiation utilities). That is an intentional simulation behaviour change which requires the full 10-year smoke and application regression gates. Existing signed contracts are left untouched.
- Player contract UI still intentionally offers no new rights-selection control. That depends on the economic and refusal balance review, realistic guidance, clear warning about veto costs, and a release audit.

## Validation
- Offer-score monotonicity for NONE / CONSULTATION / PROTECTED_FINISHES / FULL_APPROVAL at credible terms and reduced premium at zero/weak pay.
- One-off term is discounted; same exact offer/person gets precisely the same creative premium when the controlling promotion flips from AI to human.
- AI-tier guardrails for top stars, nonexclusive deals, financial crisis, weak talent, and one-off contracts.
- Real AI offer generation uses the documented clause policy without altering financial fields or exclusive appearance fees.
- Full application, Backstage, World Lock, HTTP, PostgreSQL and 10-year sim CI required before the branch is considered validated.

## After this
Audit modelled rights prevalence, star availability, refusal rates, AI matches affected by veto rights, and player market competitiveness across multiple seeds. Only then build actual player-selectable clauses with guidance in the contract screen. Major messaging/UI polish remains deferred.

Four invariants: foundation is signed contract rights and match consent; downstream systems include market offers and AI booking; all valuation remains server-side sim, UI is merely a guide; smallest complete safe first wave is cash-credible shared utility plus guarded AI offers.
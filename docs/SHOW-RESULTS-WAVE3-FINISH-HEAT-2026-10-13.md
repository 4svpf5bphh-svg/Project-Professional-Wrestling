# PPW Show Results — Wave 3A: Cheating Heat & Storyline Fallout

13 October 2026. Draft stacked on PR #75. No merge, deployment, World reset or automatic booking.

## Existing system audit
- `matches.ts` already uses planned finish + style/intent to rate match execution and base crowd, while winner momentum/popularity are separately awarded.
- `programme-signals.ts` already derives heat and repetition from factual MATCH/SEGMENT activities with an 8-week repetition window. `show-flow.ts` already applies a separate Programme context correction and pacing/alignment crowd correction.
- `programme-match-integration.ts` already records completed Programme matches. We must not create another Programme activity or award direct Programme heat for a cheating finish.
- `show-flow.ts` freezes event and match crowd-context evidence into the completed ledger. Read from that frozen evidence in private and public Results; never recompute old shows with today's alignments.

## First complete Wave 3 improvement
- Add a **small Show Flow-level** finish psychology modifier only for an actually performed DQ or unseen foreign-object win with a valid named cheating wrestler.
- Heel cheating against a face can make a crowd invest in the conflict: +1.8 foreign-object or +1.2 caught DQ. A face cheating receives -1.3 crowd-flow context. Other relationships remain neutral instead of pretending to know audience interpretation.
- Historic **exact same culprit + finish + opponent lineup** in the previous eight weeks erodes only the additional *positive* heel-cheating lift by 0.9 per repetition, capped at zero after two. Existing Programme overexposure may still affect the wider card, but this creates no second negative repetition penalty.
- Match quality, individual crowd response, actual outcome, popularity, wrestler momentum, and Programme scores remain untouched. Show Flow event response may change modestly, with its existing audience pathway. Player authors the finish and any follow-up story.
- Frozen ledger records finish reason/impact/repeat count and whether a completed match was already linked to a Programme. Private and World Results replay the same factual details without accessing competitor private booking decisions. The player chooses the next Programme beat; no automatic rematch or feud closure.
- Older recorded finishes without frozen Wave 3 evidence show no retroactive reaction. Injury stoppages, unnamed/wrong-side culprits and ordinary non-cheating finishes receive no invented finish psychology.

## PPW four-question check
1. Depends on actual `MATCH_COMPLETED` finish + named culprit, promotion-specific alignment, completed match histories, existing Show Flow, Programme-match integration.
2. Supports post-show payoff, rival continuation prompts, future fans/social reactions and AI commentary constrained to fact.
3. Simulation authority: small deterministic final-show crowd adjustment + frozen evidence. Presentation: replay ribbons, wrestling vocabulary and highlights. No autonomous story decisions.
4. Smallest complete first version: small deterministic signals, exact-repeat diminishing returns, ledger freeze, owner/public projection, concise result replay, regression coverage and full CI.

## Next Wave 3 work, not silently added
Richer programme-specific consequence choices for the player after a show (e.g. choose retaliation, demand rematch or move on) only after auditing booking opportunities and asynchronous World Lock fairness. Do not override match or segment outcomes.

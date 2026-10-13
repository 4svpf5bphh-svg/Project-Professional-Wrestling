# PPW — Show Results Wave 3B: Post-show Programme directions
13 October 2026. Draft stacked directly above PR #76. No merge, deploy, World reset or scheduled player action.

## A choice, not a forced workflow
- Only **the controlling promotion** may choose an optional next direction from **private completed Results** when an actual DQ, foreign-object finish, or successfully interfered protected finish belongs to exactly **one active Programme**.
- Choices: **Pursue rematch**, **Plan retaliation**, **Let the result stand**.
- The decision is **a persistent planning note**, not a match result, contract/venue booking, new Programme activity, momentum, fan reaction, guaranteed rematch, promo, or feud end. Existing card and segment booking remain fully player-authored.
- The note appears in Results after saving and on the corresponding active Programme management screen, with a way to navigate. Players may defer the decision indefinitely without simulation penalties. Different Worlds/player promotion scopes are authoritative.
- Record is bound to a completed event, match and active explicitly linked Programme. It cannot be inferred by wrestler coincidence, applied to a fictional future result, or attributed to an unperformed finish. Multiple plausible Programmes are **not guessed**; this first version allows only one unambiguous Programme.
- Save is an idempotent, World-open, revision-checked command under the existing transactional repository. The same saved match note may later be revised while the Programme remains active. World Lock / resolution does not block simulation awaiting a decision; online presence does not grant competitive power.
- Older World planning snapshots normalize to an empty optional follow-up list. The World state retains notes in the application planning snapshot, not in the simulation ledger. Public rival results expose **no private follow-up or planning intent**.

## Four dependency questions
1. **Depends on:** authoritative World ownership + command transaction, real completed match finishes, explicit Programme MATCH activity, World planning persistence, private Results & Programme management.
2. **Later depends on:** booking-context hints, post-show editorial recaps, optional backstage responses, story beat menus. Future improvements can link a follow-up to a subsequently booked match/segment instead of confusing intention for action.
3. **Simulation/application vs presentation:** saved note is application planning state only; no score and no automatic action. Selector and reminder live in UI.
4. **Smallest complete:** Save a choice from Results, persist/reload safely, display it on the existing Programme workspace, allow revisions, deny non-owners and bad references, do not require online attendance to progress the week.

## Release gate
Full application tests (including owner/public boundary and persistence), web build, HTTP and PostgreSQL integration and long-running World simulations. No automatic Vercel deployment, merge or reset.

**CI procedure:** Temporary PR-to-main base to run normal GitHub Actions; restore stacked #76 base once check starts; this never merges the PR.

# PPW Show Results — Wave 4B: World News Discovery & iPhone Browse Audit
13 October 2026. Draft stacked directly on #79. **No merge, deployment, release or World reset.**

## Audit: existing behavior and weakness
- The authoritative public World Results projection delivers the 30 most recent **completed** shows, with actual match finishes, public title and injury outcomes, completed show segments, ratings and venue/attendance. It correctly omits rival economics, contracts, staff, intentions and future bookings.
- The current World tab is a flat list with a promotion dropdown and large show cards. With WWE/AEW/NJPW/etc. active, discovering an interesting title change or arrival requires manually opening every show.
- The last broadcast polish (PR #79) provides a factual headline but only *inside* each expanded show. On a phone the collapsed list gives too little reason to tap.
- Critical **privacy** edge: a VIDEO_PACKAGE marked CRYPTIC already omits `videoSubjectName`, but could still render its `participantIds` as public participant names. A search index based on those participants would worsen the leak.

## Smallest complete first version
1. **Public World timeline discovery, client-only.** Promotion filter retained. Add a compact search across public show/promotions/venue, public match participants, public championship names/holders and non-cryptic performed segment participants.
2. **Meaningful spotlights:** All, title changes, debuts & returns, actual controversial finishes (DQ/foreign object or successful run-in), and injuries. Read the **full performed public show**, not just the top three editorial cards; meaningful events cannot disappear because higher-priority headlines took their spot.
3. **Scannable weekly index.** Group the existing reverse-chronological list under canonical PPW Year/Week. Add the factual highest-priority existing `showResultHighlights` headline to each collapsed show card. Show latest first, retain detailed broadcast and jump links inside the expanded card.
4. **Touch-friendly.** iPhone search input has font-size 16px to avoid browser zoom. Spotlight chips have a 44px target and horizontally scroll with no autofocus. Empty results offer a functional one-tap clear filter.
5. **Public mystery protection.** Cryptic VIDEO_PACKAGE participant list is empty in **public** World projection. Private promoter results remain unchanged. Public client search excludes such a clip's participants even when analysing an old malformed/legacy snapshot.
6. **Honest scope.** Filters search only the 30 most recent completed shows currently sent by the server; the UI explicitly says this isn't an all-time archive. A later server-side paginated search is a separate feature.

## PPW four-question gate
- **Depends on:** performed match/segment World projection, actual finish, injury/title outcome, real recorded debut/return, existing recap helper.
- **Downstream:** news discovery, World Pulse/social reactions, rivalry-following, broader event-search and a future archive.
- **Authority:** read-only public result formatting and public-video identity suppression. No simulation changes, wrestler progression, Programme heat, booking, future-plan access or effect of logging in.
- **Smallest complete:** fast public discovery from the existing 30-show window, meaningful filters, weekly hierarchy, subject concealment, tests and full CI.

## Regression / verification
- Full application Results regression and public World Results parity.
- Spotlights for a real title change, injury, performed arrival, caught/unseen cheating and absence of unrecorded controversy.
- Case-insensitive wrestler/championship searches, composition with a promotion filter, preserved source order.
- Cryptic public clip does not reveal subject name, is not searchable by subject, and a *separately performed genuine debut* subsequently makes the wrestler publicly discoverable.
- Full TypeScript/application, web build, HTTP, PostgreSQL and 26-week/10-year World audits. No production deployment; iPhone physical playtest still required.

## Deferred
True all-history search requires API pagination/indexing, not a silent claim against the latest 30.

**Workflow trigger:** The PR is temporarily based on main only to start standard full Actions CI; restore the draft's stacked PR #79 base once scheduled. This never merges or deploys.

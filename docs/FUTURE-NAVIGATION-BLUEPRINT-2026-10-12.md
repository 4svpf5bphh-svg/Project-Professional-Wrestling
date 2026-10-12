# PPW — Forward Navigation and Screen Ownership Blueprint
**12 October 2026 | PR #51 | Pre-playtest information architecture.**
Stacked after the green PR #50 release-readiness gate. No deployment, World reset or simulation changes authorised.

## Navigation philosophy
**TEW underneath, EWR on top**: comprehensive underlying systems with shallow, task-first player journeys. Five existing global mobile roots remain **World / Talent / Plan / Business / Results**. Important actions stay live and obvious; future destinations appear only as a handful of dimmed, explicitly **Planned** cards at the bottom of the relevant drawer, never as fake live links. No extra bottom tabs, nested dead routes or scroll traps.

**Single responsibility:** every major system has a primary home; other screens may deep-link to it. Contextual match/wrestler tools belong beside the action, not as unrelated top-level destinations. Do not put the whole design dossier into the drawer. A disabled navigation placeholder is an early architectural promise, not a release-date promise.

## Owned features — where they live now and later

| Home | Already playable / current spine | Future owned surfaces | Contextual placement rather than an extra menu |
| --- | --- | --- | --- |
| **World** | World overview, Promotions/industry, Championships | Industry headlines & press, world-wide rankings, historical archive, major shared World Moments, promotion lifecycles | Rival promotion details and public roster on industry page; true multiplayer joining/account invitation flows when authentication ships |
| **Talent** | Your Singles and Tag Teams, Stables, Market, Offers, Directory, Backstage, wrestler profiles, contract renewal / purchased dates | Trios roster mode (already visibly dimmed on RosterNav), training/wrestler development, deeper wrestler career histories, expanded relationships | Portable gimmicks, finishers, creative resistance and morale live **on wrestler profile**; relationships/chemistry live on wrestler/team/stable profiles; real backstage text-message presentation is a **Backstage** redesign, not a new menu; new contracts and consent live in Offers |
| **Plan** | Six-week Shows planner, World calendar, Card booking, Programmes/rivalries, matches and segments | Tournament bracket planning, booking templates, production workflow, deeper show type/schedule choices | Road-agent notes, spot advice, producer suggestions and creative acceptance appear **on the Card**; story arc tools belong inside Programmes; show media classification belongs inside show setup |
| **Business** | Cash/weekly finance, operations, Talent Manager Staff (live and linked), company operating position | TV/streaming/premium-event broadcast rights, sponsorships, marketing campaigns, investments/facilities, staff expansion, promotion identity and governance, acquisitions/succession later | Doctor/medical staff and road agents share **Business → Staff** for hiring/salaries/roles; treatment decisions also surface on injured **wrestler profile** and booking readiness; manager renewal attempts deep-link to Talent; salary exposure belongs in Business |
| **Results** | Completed shows, match ratings, attendance and show history | Audience/fan trends, financial/show analytics, annual awards, records and achievements, historical match comparisons | Contextual match report and audience feedback open from each show; no forced popups; dedicated rankings of worldwide talent belong under **World** |

## Personal meta-collection boundary
Kayfabe Points remain earn-only, account-capped, **non-competitive** and cannot change salaries, injuries, negotiations, talent availability or the sim. Personal binders, legend/history cards and commemorative World Moment collectibles should eventually sit under an account/collection entry reached from World/Moments (or a profile menu once accounts exist). Do **not** create a sixth primary root or imply World Moments transfer simulation power.

## Current placeholder selection (deliberately limited)
- World: **Industry headlines**, **World rankings**.
- Talent: **Development**. Trios already has an appropriate disabled contextual roster tab.
- Plan: **Tournaments**.
- Business: **Media deals**, **Sponsorships**, **Facilities**. Staff is an **active** Business destination, not a placeholder.
- Results: **Analytics**, **Awards & records**.

Nine muted `<div aria-disabled="true">` cards share live navigation styling but have no link, click handler, server call, fake route or implied delivery date. Each chosen future destination has an eventual distinct screen and can be made live one at a time. Fine-grained options such as individual doctors and road agents **do not** receive separate menu entries.

## Future capability and availability rules
- Keep one server-authoritative World and one wrestler/staff identity each. Menu/UI availability **cannot** authorize an action that World rules disallow. Human presence online never yields more sim ticks or extra talent negotiation power.
- A future placeholder becomes an active route only when the smallest complete gameplay loop is implemented and tested: input, server command/World state, outcomes, player feedback, multiplayer permissions, persistence and reasonable balance. A decorative screen alone is not a release.
- Until then, disabled cards remain genuinely inert and out of keyboard tab order, with an explicit Planned label, low-contrast styling that is still legible, and no pretend buttons.
- The same existing navigation layout renders on phone/PWA with scrollable expanded drawer; it must retain reachable live entries and enough space to operate mandatory weekly work.
- Avoid adding entire placeholder panels to match booking/finances, obscuring essential current controls or resurfacing grey-dropdown-heavy interactions.
- New and returning players should see **what is playable first**. At most 1–3 future destinations per main drawer in this wave; extra design mapping lives in this document instead of the game.

## The four dependency questions
1. **What does it depend on?** Current five-section navigation, roster subnav with Trios/active Stables, live Staff screen, active Card/Show/Backstage paths and the complete features dossier. This UI refinement sits on the validated PR #50 stack.
2. **What depends on it later?** Discoverable new game loops, staff expansion, real shared-world login, future production/medical systems, account-level collectibles, mobile onboarding and eventual UI design polish.
3. **Simulation or presentation?** Pure presentational/static navigational metadata. No World state, command, schema, side effects, simulation power, access rights, deadlines or finances change. Live Staff route moves navigation ownership only.
4. **Smallest complete version?** Keep five roots, add nine honest passive planned entries, align Staff with Business, record a full location map, check web TypeScript/build and preserve all existing actions. No feature stubs, fake clickables, blank pages or reset.

## Explicitly deferred
A full visual redesign, a sixth nav root, developer-only future toggle menus, a place for every speculative micro-feature, new staff roles or simulation functionality, real user-to-user co-play login, and detailed screen wireframes. Revisit after the fresh playtest shows where people actually get lost. The first iteration should not be judged by how many disabled buttons it displays.

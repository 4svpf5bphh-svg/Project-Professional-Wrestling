# SIM-0.0.6 Career Time, Development & Generational Continuity

This milestone makes PPW Worlds capable of outliving their starting wrestler population without treating each PPW calendar year as a biological year.

## Included
- Biological Career Time advances independently from the PPW calendar.
- Wrestlers gain career experience from actual matches rather than passive weekly ticks.
- Match-driven development with diminishing returns, career-stage factors and individual development aptitude.
- Career-stage transitions: Prospect, Prime, Veteran and Special Attraction.
- Age/Wear decline affects physical ability while Match Craft can continue improving later in a career.
- Retirement pressure uses biological age, Wear and audience demand rather than a fixed birthday.
- Retirement terminates active contractual rights and pending offers cleanly while preserving history.
- World population health triggers generated prospects only when active supply drops below a configured threshold.
- Generated prospects receive their own age, skills, priorities, home market and development aptitude.
- AI recruitment now preserves a development pipeline instead of allowing established names to dominate every shortlist.
- Development-focused promotions reserve limited regular-show opportunities for prospects.
- Non-exclusive outside-work recruitment remains available so limited-date careers can span promotions.
- Match exposure slowly grows wrestler Recognition; performance, wins and strong crowd response can build Popularity without punishing unknown wrestlers merely for starting cold.
- Long-world indexes remove repeated full-history scans from contracts, events and career progression.
- Historical appearance validation uses booking-time Service Capacity so later ageing cannot retroactively make a past legal booking illegal.
- Diagnostic World hashing now uses deterministic bounded sampling of very large historical collections instead of materialising the entire archive into one giant string.
- Summary free-agent counts now exclude retired wrestlers.

## Long-world diagnostics

Standard seed `20261002` remains invariant-clean through 100 PPW Years.

At PPW Year 101 the World contains roughly:
- 385 active wrestlers from a total historical population of about 690;
- 300+ retirements;
- roughly 290 generated wrestlers across history;
- several generated wrestlers that have reached genuine star-level careers, including 60–70+ Recognition/Popularity and 80+ in-ring ability;
- more than 138,000 completed matches;
- more than 1.5 million financial transactions;
- no World invariant failures.

A 100-PPW-Year run resolves in roughly 30 seconds in the current development environment. Ten-to-thirty-year runtime is close to linear after the indexing work.

## Deliberate limitation / next diagnostic target

Two Independent AI promotions can eventually become effectively empty shells while remaining active. That is not being hidden with artificial roster grants. The next milestone adds survival/restructuring behaviour so financially or competitively weak AI promotions can shrink, alter cadence, recruit affordable workers, enter Stewardship/Dormancy or otherwise react coherently instead of simply decaying to zero roster.

## Balance note

The first generational version produced technically capable prospects who never became known because Recognition/Popularity barely moved. The final 0.0.6 loop explicitly separates exposure from audience affection: working meaningful shows creates Recognition, while good performances and sustained response create Popularity. Generated stars therefore emerge organically rather than receiving a generation bonus.

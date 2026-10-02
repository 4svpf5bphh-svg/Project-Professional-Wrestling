# SIM-0.0.4 Shows, Venues & Gate Economy

This milestone adds the first live-event economy and makes purchased contract dates matter operationally.

## Included
- Three deterministic venue bands per market with capacity, hire cost, prestige and production suitability.
- Promotion-specific market awareness, live strength and loyalty.
- Tier-appropriate event cadence: larger promotions run more often than smaller promotions.
- Regular and quarterly major events.
- Home-market shows plus bounded AI touring based on promotion scale and expansion preference.
- Broad ticket strategies: Accessible, Standard, Premium and Prestige.
- Demand derived from local strength, awareness, market interest, media reach, advertised talent, event importance and ticket strategy.
- Venue selection based on expected demand rather than automatic largest-building booking.
- Same-market competition pressure.
- Gate revenue, venue hire, production, travel and appearance fees in the financial transaction ledger.
- Contract date entitlements are consumed only by completed appearances.
- Non-exclusive wrestlers can work multiple promotions in one PPW week when Service Capacity permits, but cannot be double-booked on the same PPW day.
- Event results update local market awareness/live strength/loyalty.
- Event cancellation if insufficient contracted talent is available.
- Completed/cancelled event history in the World Ledger.

## Deliberate limitations
- Events currently contain an abstract participant roster, not a match card. Match simulation is the next layer.
- Venue availability is only checked for same-day event clashes; no long-range venue booking market exists yet.
- Geography/travel uses home-vs-away costs rather than real distance.
- Scheduling priority clauses are not yet modelled; weekly planning order rotates to avoid permanently favouring the same promotion.
- Audience segments and storyline heat are not yet used in event demand.
- No routine staff/AI restructuring response exists yet for promotions in prolonged financial crisis.

## Current diagnostic finding
For the standard seed, the first 52 PPW weeks produce both profitable and loss-making events. National and Rising promotions often make money directly on live shows, Global events can function as media-supported loss leaders, and Independent events are near break-even with some profitable nights and some costly misses. After ten PPW Years several smaller AI promotions can still enter crisis because AI does not yet cut costs or restructure; that pressure is intentionally left visible for later survival-AI testing.

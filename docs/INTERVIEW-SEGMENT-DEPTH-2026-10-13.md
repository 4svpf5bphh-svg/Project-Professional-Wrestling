# PPW Interview Segment: Question, Response and Format — 13 October 2026

**State:** draft-only, stacked on PR #65. No merge, Vercel deployment or World reset.

## Goal: depth, not duplicate angles

A wrestling interview is not just another promo. An independent, neutral production host asks a question; the player's wrestler responds in a **scripted** way. The neutral host is not a wrestler, has no separate contract, takes no show appearance date and is not counted as an extra participant. Multiple booked wrestlers may be interviewed together where the existing Card supports them.

The normal booking path is **two choices**:
- **Question/topic:** career story, rivalry pressure, recent form, or next steps.
- **On-screen answer:** candid, evasive, defiant, or walks out.

**Advanced Booking** adds a setting: backstage, sit-down, or in-ring. That is one INTERVIEW type rather than 48 duplicate segment types. No direct challenge, assault, change to result, title, signing or rebooking is invented from any answer.

A walkout is an actual authored exit from the interview, not a backstage contract dispute, automatic match refusal or employee termination.

## Simulation and repetition

The server freezes question, setting and answer in `SHOW_SEGMENT_COMPLETED` for factual Results. Subject alignment, format, programme context and performer skill govern how well the scripted answer lands. Rivalry questions are more plausible when an actual Programme is linked, but remain legal without one.

A bounded, modest repetition reduction applies only when the **same wrestler(s)** in the **same promotion** answer the **same topic the same way** in a previously **completed interview** within six earlier PPW weeks. It is capped at 3.5 points on angle fit, not a booking prohibition. It never counts pending shows, recordings that never aired, future events, another talent or promotion, a new question, a different scripted answer, or old history.

Legacy interviews without the new fields retain their original behaviour; they do not retroactively gain scripted outcomes. New Card segments receive explicit defaults that casual players can change with two taps. No database migration required.

## Dependency and scope check

1. **Depends on:** existing participant reservations, typed Card segments, World Lock, completed-segment ledger, wrestler alignment and Programme links.
2. **Later dependencies:** celebration and confrontation endings, varied show recaps, character arcs, rich Results visuals and anti-repeat story memory.
3. **Simulation vs presentation:** `interviewFormat`, `interviewTopic`, `interviewResponse` and historical frozen evidence are actual server-authoritative state. Button labels, optional Advanced placement and Results prose are presentation.
4. **Smallest complete version:** three compatible fields, two Quick choices, one optional Advanced choice, deterministic reception, saved/reloaded Card, immutable private/public Results, and regression tests.

## Regression coverage and verification

- Explicit walkout survives World Lock and remains a factual interview, without a fictional second wrestler, challenge, confrontation or attack.
- Invalid or partial choices are rejected without mutating the saved script.
- The audience penalty is limited to actual recent equivalent interview behaviour, not unrelated bookings or other promotions.
- Card save/reload and reserved appearance headcount remain stable.
- Private and public Results reflect the actual performed script rather than recomputing today’s character state.

**CI:** New draft requires its own complete workflow; PR #65 CI #1012 passed, but does not validate this branch. No release until later integration permission.

**Next bounded slice:** celebrations—occasion, presentation, scripted ending and truthfulness about a real milestone—then remaining confrontation/aftermath gaps. Keep main contract development closed.

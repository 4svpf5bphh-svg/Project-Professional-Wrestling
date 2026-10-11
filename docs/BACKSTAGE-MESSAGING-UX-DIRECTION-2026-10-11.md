# PPW Backstage Messaging — locked UX direction (11 October 2026)

This is a **future presentation overhaul**, not a new or competing simulation. Build it after underlying Backstage and creative-contract workflows stabilise; retain a clean, mobile-first experience.

## Player-facing direction
- A **full-width, phone-like messaging inbox**: wrestler headshots, names, last message preview, unread count, clear timestamp, and sensible filters for active/unread/archived threads.
- Opening a thread shows **persistent left/right chat bubbles** between wrestler and booker, with genuine conversation history across weeks, promotions where relevant, and important decisions. Avoid a drawn miniature smartphone frame on a real iPhone.
- Replies are **intent-based, selectable choices**, not a free-text parser making unpredictable simulation decisions. Relevant branches might include explaining a long-term booking, discussing a protected finish, promising a role, standing firm, revisiting a gimmick, or agreeing to a Programme arc.
- Show concrete but appropriately uncertain **negotiation context** and a brief consequence in the thread. Wrestlers can reject proposed creative work; only the promoter authors/revises scripted finishes, betrayals, and winners. The sim must never silently rewrite a booking.
- Keep chat delivery responsive and skimmable. No constant generic small talk, fabricated urgent push notifications, or repetitive filler. Background activity does not grant online players extra competitive power.

## Dependencies and implementation boundaries
- **Underneath**: current persistent BackstageConversation records, working relationships, Trust/morale, wrestler-owned gimmicks, promise history, contracts, creative waivers, and Programme agreements remain single source of truth.
- **Presentation**: a message projection from factual stored state, messages sent/decisions returned through existing server-authoritative commands. Any narrative generation embellishes dialogue only, never writes outcomes, approvals or competitive state.
- Thread messages need stable IDs, chronology, actual PPW timestamps, read/unread state, history after response, and meaningful links from show cards, rosters and notifications.
- Avoid duplicating an old Backstage card alongside a new messaging simulation. The inbox **replaces the grey dropdown/card presentation** at the scheduled major UI polish pass; it does not create an additional game currency or chat-only bonus.
- Works especially well for repeated wrestler discussions and standing Programme creative agreements. Existing conversation and consent decisions will be the source of the transcript.
- Build mobile-first for iPhone/PWA, but desktop must remain readable and keyboard-accessible.

## Smallest complete first release (deferred)
1. Read-only inbox and threaded transcript from actual stored Backstage conversations.
2. Render one existing response choice set as message-reply chips, with exactly the existing command effects.
3. Mark read/unread, deep links, and clear notification counts; no involuntary popup.
4. Playtest for clarity and repetition before adding richer scripted dialogue or AI-generated tone.

**Not implemented in this PR.** This design requirement is now retained in the PPW repository for the future UI overhaul.

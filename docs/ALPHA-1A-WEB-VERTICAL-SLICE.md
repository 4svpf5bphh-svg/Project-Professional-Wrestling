# ALPHA-1A — First Web Vertical Slice

Status: **validated application-to-browser foundation**  
Baseline: `alpha-1a` planning/status contract at `3910622`  

## Purpose

This slice begins the transition from a proven persistent headless application into a game a player can operate from a browser/PWA. It deliberately proves one thin end-to-end path before broader screens are built.

The accepted vertical path is:

> **mobile shell → Next Route Handler → server-owned Alpha identity → application service → transactional PostgreSQL repository → ownership/idempotency command → deterministic World → privacy-safe read model → browser**

## Included

### Mobile-first Next application shell

`apps/web` is a Next.js App Router application with:

- responsive mobile-first styling intended for iPhone/PWA use;
- standalone web-app manifest metadata;
- World/PPW-date/runtime-phase display;
- Independent-promotion entry screen;
- initial promotion dashboard after claim;
- cash, recent weekly net, lifecycle/distress/runway and planning counts;
- top contracted roster summary;
- placeholder bottom navigation for later World/Roster/Plan/Industry surfaces.

Only the World surface is active in this slice. Disabled navigation is intentional rather than mocked functionality.

### Player-safe read model

The web app never receives raw `WorldState`.

`buildAlphaPlayerWorldView()` exposes only the information needed by this first surface:

- current World/date/runtime/revision metadata;
- the server-authorized player's promotion control;
- eligible Independent choices before control is claimed;
- the controlled promotion summary and contracted roster afterward.

This establishes the privacy/read-model boundary that ALPHA-1B multiplayer will rely on.

### Server-owned Alpha identity

The browser does **not** submit or choose a player ID.

For ALPHA-1A the server obtains identity from `PPW_ALPHA_PLAYER_ID` and uses that identity for membership and ownership authorization. This is a temporary single-player authentication adapter; a later real login/session provider can replace it without changing the application commands.

Environment inputs:

- `DATABASE_URL` — required;
- `PPW_ALPHA_PLAYER_ID` — defaults to `alpha-player-1`;
- `PPW_ALPHA_WORLD_SEED` — defaults to `20261002`;
- `PPW_ALPHA_WORLD_NAME` — defaults to `PPW Alpha World`.

### Persistent World bootstrap

On first access the server creates one deterministic PPW World for the configured seed, with:

- one ALPHA-1A human seat;
- one active World membership for the configured player;
- runtime, command/idempotency and planning application state;
- the normal deterministic Genesis simulation state.

Subsequent requests load the same PostgreSQL-backed aggregate.

### First real HTTP command

Two thin Route Handlers exist:

- `GET /api/session`
- `POST /api/claim`

The claim route accepts promotion choice plus a client-generated request ID but **never accepts player identity**. It executes the existing transactional `CLAIM_INDEPENDENT_PROMOTION` application command.

The client retains a request ID for a failed/retried claim so losing an HTTP response cannot claim twice. The command receipt remains the authoritative idempotency boundary.

### Compiled web adapter boundary

The deterministic/application packages retain their NodeNext ESM `*.js` source-import convention.

Next does not bundle those raw TypeScript files directly. Root TypeScript first compiles `packages/web-adapter` and its application/simulation dependencies, and the Route Handlers consume the compiled adapter. This prevents frontend bundler rules from leaking into sim-core while still allowing the Next standalone build to trace the server dependencies.

## Validation

The slice is accepted only if all of these remain green:

1. existing PPW functional suites;
2. dedicated Alpha web-service tests;
3. optimized Next.js production build;
4. live Next HTTP integration against PostgreSQL;
5. existing PostgreSQL repository/reservation/materialization integration suites;
6. standard 10-PPW-Year deterministic gate;
7. standard 100-PPW-Year deterministic gate on `[long]` validation.

The live HTTP integration launches the built production server and proves:

- `/` returns the PPW shell;
- first `GET /api/session` bootstraps/loads the persistent World;
- `POST /api/claim` assigns the selected Independent through the real ownership command;
- repeating the identical request is idempotent and does not advance the World revision twice;
- a later `GET /api/session` reloads the persisted claimed-promotion dashboard.

## Deliberately not included yet

This is the first vertical slice, **not yet a complete playable ALPHA-1A**.

Still outside this slice:

- real login/account authentication;
- deployment/production environment configuration;
- final dependency-lock/deployment packaging cleanup;
- install icons/offline/service-worker behavior beyond basic manifest/standalone metadata;
- week lock/resolve controls or scheduled World worker exposed through the app;
- contract-market UI;
- full roster/talent details;
- planning/card/championship UI;
- Attention and Opportunity surfaces;
- results/history/Industry screens;
- visual browser/device verification on a deployed URL;
- ALPHA-1B second human.

These are subsequent slices built on the now-tested browser/API/database boundary rather than reasons to widen this slice.

## Development commands

```bash
npm install
npm test
npm run web:build
npm run web:dev
npm run test:web-http
```

`web:build` first compiles the PPW server/application adapter and then performs the optimized Next production build.

## Acceptance principle

The first browser action is intentionally small, but it is not fake UI state:

> **If the browser says the player claimed a promotion, PostgreSQL, ownership state, the command receipt, World revision and deterministic simulation state all agree that it happened exactly once.**

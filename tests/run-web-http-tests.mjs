import { spawn } from "node:child_process";

const port = 3100;
const baseUrl = `http://127.0.0.1:${port}`;
let output = "";

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "apps/web", "-p", String(port)],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited before becoming ready\n${output}`);
    }
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready\n${output}`);
}

async function json(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function weekKey(view) {
  return `${view.world.year}:${view.world.week}`;
}

try {
  await waitForServer();

  const page = await fetch(baseUrl, { cache: "no-store" });
  ok(page.ok, "Alpha page did not return HTTP 200");
  const html = await page.text();
  ok(html.includes("PPW"), "Alpha page did not render the PPW shell");

  const before = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(before.player?.promotionId === null, "fresh HTTP Alpha session unexpectedly controls a promotion");
  ok(Array.isArray(before.availableIndependentPromotions) && before.availableIndependentPromotions.length > 0, "HTTP session exposed no Independent choices");
  const promotionId = before.availableIndependentPromotions[0].promotionId;

  const claimBody = JSON.stringify({ promotionId, requestId: "ci-http-claim-001" });
  const first = await json(await fetch(`${baseUrl}/api/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: claimBody,
  }));
  ok(first.player?.promotionId === promotionId, "HTTP claim did not assign the selected promotion");
  ok(first.promotion?.promotionId === promotionId, "HTTP claim did not return the promotion dashboard");
  ok(first.world?.revision === 1, "HTTP claim did not advance revision exactly once");
  ok(first.promotion?.weekReadiness?.status, "HTTP dashboard did not expose week readiness");

  const retry = await json(await fetch(`${baseUrl}/api/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: claimBody,
  }));
  ok(retry.world?.revision === 1, "HTTP idempotent retry advanced revision twice");

  const afterClaim = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(afterClaim.player?.promotionId === promotionId, "HTTP reload lost promotion ownership");
  ok(afterClaim.promotion?.promotionId === promotionId, "HTTP reload lost promotion dashboard state");
  ok(afterClaim.world?.revision === 1, "HTTP reload returned the wrong persisted World revision");

  const weekBefore = weekKey(afterClaim);
  const revisionBeforeAdvance = afterClaim.world.revision;
  const advanced = await json(await fetch(`${baseUrl}/api/advance-week`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: revisionBeforeAdvance }),
  }));
  ok(weekKey(advanced) !== weekBefore, "HTTP week endpoint did not advance the PPW calendar");
  ok(advanced.world?.phase === "OPEN", "HTTP week endpoint did not reopen the World");
  ok(advanced.world?.revision > revisionBeforeAdvance, "HTTP week endpoint did not advance the World revision");
  ok(advanced.world?.lastResolvedPpwDate, "HTTP week endpoint did not expose the resolved week");

  const staleResponse = await fetch(`${baseUrl}/api/advance-week`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: revisionBeforeAdvance }),
  });
  ok(staleResponse.status === 409, `stale HTTP week retry returned ${staleResponse.status} instead of 409`);
  const stalePayload = await staleResponse.json();
  ok(String(stalePayload.error ?? "").includes("stale World revision"), "stale HTTP week retry returned the wrong conflict reason");

  const afterAdvance = await json(await fetch(`${baseUrl}/api/session`, { cache: "no-store" }));
  ok(weekKey(afterAdvance) === weekKey(advanced), "stale HTTP retry advanced the World a second time");
  ok(afterAdvance.world.revision === advanced.world.revision, "stale HTTP retry changed the persisted World revision");

  console.log("PASS Alpha Next HTTP bootstrap, claim, retry, week resolution and stale-retry safety");
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once("exit", resolve);
    setTimeout(resolve, 3000);
  });
}

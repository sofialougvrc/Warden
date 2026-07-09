import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { evaluateCanary } from "./stats.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const appDir = join(root, "app");
const dataPath = join(root, "data", "warden-state.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: "internal_error", message: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Warden dashboard running at http://${host}:${port}`);
});

async function handleApi(req, res, url) {
  const state = await loadState();
  if (req.method === "GET" && url.pathname === "/api/summary") return sendJson(res, 200, state.summary);
  if (req.method === "GET" && url.pathname === "/api/runs") return sendJson(res, 200, state.runs);
  if (req.method === "GET" && url.pathname.startsWith("/api/runs/")) {
    const run = state.runs.find((item) => item.id === decodeURIComponent(url.pathname.split("/").pop()));
    return run ? sendJson(res, 200, run) : sendJson(res, 404, { error: "not_found" });
  }
  if (req.method === "GET" && url.pathname === "/api/registry") return sendJson(res, 200, state.registry);
  if (req.method === "GET" && url.pathname === "/api/costs") return sendJson(res, 200, state.costs);
  if (req.method === "GET" && url.pathname === "/api/events") return sendJson(res, 200, state.events);
  if (req.method === "GET" && url.pathname === "/api/architecture") return sendJson(res, 200, state.architecture);
  if (req.method === "POST" && url.pathname === "/api/replay-failure") return replayFailure(res, state);
  if (req.method === "POST" && url.pathname === "/api/acknowledge") return acknowledge(res, state);
  return sendJson(res, 404, { error: "not_found" });
}

async function replayFailure(res, state) {
  const baselineLatency = Array.from({ length: 700 }, (_, index) => 1200 + (index % 80) * 8 + Math.floor(index / 29));
  const candidateLatency = Array.from({ length: 700 }, (_, index) => 1375 + (index % 95) * 9 + Math.floor(index / 19));
  const decision = evaluateCanary({
    baselineLatency,
    candidateLatency,
    retrievalBaseline: 0.842,
    retrievalCandidate: 0.771
  });

  state.summary.gateState = decision.verdict === "block" ? "blocked" : "allowed";
  state.summary.pipelineStatus = decision.verdict === "block" ? "awaiting-human-review" : "ready-to-promote";
  state.summary.rolloutPercent = decision.verdict === "block" ? 12 : 100;
  state.generatedAt = new Date().toISOString();
  state.events.unshift({
    id: `evt-${Date.now()}`,
    time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    kind: "stats",
    message: `Replay completed: ${decision.verdict.toUpperCase()} with p=${formatPValue(decision.mannWhitneyU.pValue)}.`
  });
  await saveState(state);
  sendJson(res, 200, { ok: true, decision, summary: state.summary, events: state.events });
}

async function acknowledge(res, state) {
  state.summary.pipelineStatus = "human-review-acknowledged";
  state.events.unshift({
    id: `evt-${Date.now()}`,
    time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    kind: "gate",
    message: "Reviewer acknowledged the blocked canary and kept production on v17."
  });
  await saveState(state);
  sendJson(res, 200, { ok: true, summary: state.summary, events: state.events });
}

async function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(appDir, requested));
  if (!filePath.startsWith(appDir)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  const type = mime[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).on("error", () => {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }).pipe(res);
}

async function loadState() {
  return JSON.parse(await readFile(dataPath, "utf8"));
}

async function saveState(state) {
  await writeFile(dataPath, `${JSON.stringify(state, null, 2)}\n`);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function formatPValue(value) {
  if (value === 0) return "<1e-12";
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { evaluateCanary } from "../server/stats.mjs";

const dataPath = join(process.cwd(), "data", "warden-state.json");

export async function loadState() {
  return JSON.parse(await readFile(dataPath, "utf8"));
}

export async function saveState(state) {
  await writeFile(dataPath, `${JSON.stringify(state, null, 2)}\n`);
}

export async function getResource(path) {
  const state = await loadState();
  if (path === "summary") return state.summary;
  if (path === "runs") return state.runs;
  if (path.startsWith("runs/")) {
    const id = path.split("/").pop();
    return state.runs.find((run) => run.id === id) ?? null;
  }
  if (path === "registry") return state.registry;
  if (path === "costs") return state.costs;
  if (path === "events") return state.events;
  if (path === "architecture") return state.architecture;
  return undefined;
}

export async function replayFailure() {
  const state = await loadState();
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
  return { ok: true, decision, summary: state.summary, events: state.events };
}

export async function acknowledgeBlock() {
  const state = await loadState();
  state.summary.pipelineStatus = "human-review-acknowledged";
  state.events.unshift({
    id: `evt-${Date.now()}`,
    time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    kind: "gate",
    message: "Reviewer acknowledged the blocked canary and kept production on v17."
  });
  await saveState(state);
  return { ok: true, summary: state.summary, events: state.events };
}

function formatPValue(value) {
  if (value === 0) return "<1e-12";
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

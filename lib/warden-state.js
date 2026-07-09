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
  const baselineLatency = Array.from({ length: 480 }, (_, index) => 1450 + (index % 90) * 5.5 + Math.floor(index / 37));
  const candidateLatency = baselineLatency.map((value, index) => {
    const tailPenalty = index / baselineLatency.length > 0.88 ? 210 + (index % 7) * 9 : 0;
    return value + 10 + tailPenalty;
  });
  const decision = evaluateCanary({
    baselineLatency,
    candidateLatency,
    retrievalBaseline: 0.823,
    retrievalCandidate: 0.776
  });

  state.summary.gateState = decision.verdict === "block" ? "blocked" : "allowed";
  state.summary.pipelineStatus = decision.verdict === "block" ? "awaiting-operator-ack" : "ready-to-promote";
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
  state.summary.pipelineStatus = "operator-acknowledged";
  state.events.unshift({
    id: `evt-${Date.now()}`,
    time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    kind: "gate",
    message: "Operator acknowledged the blocked canary and kept production on v17."
  });
  await saveState(state);
  return { ok: true, summary: state.summary, events: state.events };
}

function formatPValue(value) {
  if (value === 0) return "<1e-12";
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

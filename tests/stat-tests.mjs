import assert from "node:assert/strict";
import { evaluateCanary, mannWhitneyU, sprt } from "../server/stats.mjs";

const baselineLatency = Array.from({ length: 700 }, (_, index) => 1200 + (index % 80) * 8 + Math.floor(index / 29));
const candidateLatency = Array.from({ length: 700 }, (_, index) => 1375 + (index % 95) * 9 + Math.floor(index / 19));

const decision = evaluateCanary({
  baselineLatency,
  candidateLatency,
  retrievalBaseline: 0.842,
  retrievalCandidate: 0.771
});

assert.equal(decision.verdict, "block");
assert.ok(decision.latency.deltaPercent > 8);
assert.ok(decision.retrieval.deltaPercent < -3);
assert.ok(decision.mannWhitneyU.pValue < 0.01);

const mw = mannWhitneyU([1, 2, 3, 4], [10, 11, 12, 13]);
assert.ok(mw.z > 0);
assert.ok(mw.pValue < 0.05);

const sequential = sprt({ successes: 80, observations: 100, p0: 0.05, p1: 0.12 });
assert.equal(sequential.decision, "accept-regression-hypothesis");

console.log("Statistics tests passed");

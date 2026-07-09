import assert from "node:assert/strict";
import { evaluateCanary, mannWhitneyU, sprt } from "../server/stats.mjs";

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

assert.equal(decision.verdict, "block");
assert.ok(decision.latency.deltaPercent > 8);
assert.ok(decision.latency.deltaPercent < 13);
assert.ok(decision.retrieval.deltaPercent < -3);
assert.ok(decision.mannWhitneyU.pValue < 0.01);
assert.ok(decision.mannWhitneyU.pValue > 0.001);

const mw = mannWhitneyU([1, 2, 3, 4], [10, 11, 12, 13]);
assert.ok(mw.z > 0);
assert.ok(mw.pValue < 0.05);

const sequential = sprt({ successes: 80, observations: 100, p0: 0.05, p1: 0.12 });
assert.equal(sequential.decision, "accept-regression-hypothesis");

console.log("Statistics tests passed");

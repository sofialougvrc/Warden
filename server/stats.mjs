export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

export function mannWhitneyU(baseline, candidate) {
  const combined = baseline
    .map((value) => ({ value, sample: "baseline" }))
    .concat(candidate.map((value) => ({ value, sample: "candidate" })))
    .sort((a, b) => a.value - b.value);

  const ranks = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i + 1;
    while (j < combined.length && combined[j].value === combined[i].value) j += 1;
    const averageRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) ranks[k] = averageRank;
    i = j;
  }

  let rankSumCandidate = 0;
  combined.forEach((item, index) => {
    if (item.sample === "candidate") rankSumCandidate += ranks[index];
  });

  const n1 = baseline.length;
  const n2 = candidate.length;
  const u = rankSumCandidate - (n2 * (n2 + 1)) / 2;
  const mean = (n1 * n2) / 2;
  const variance = (n1 * n2 * (n1 + n2 + 1)) / 12;
  const z = (u - mean) / Math.sqrt(variance);
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));

  return { u: Math.round(u), z, pValue };
}

export function sprt({ successes, observations, p0, p1, alpha = 0.01, beta = 0.05 }) {
  const failures = observations - successes;
  const llr = successes * Math.log(p1 / p0) + failures * Math.log((1 - p1) / (1 - p0));
  const upper = Math.log((1 - beta) / alpha);
  const lower = Math.log(beta / (1 - alpha));
  let decision = "continue";
  if (llr >= upper) decision = "accept-regression-hypothesis";
  if (llr <= lower) decision = "accept-baseline-hypothesis";
  return { logLikelihoodRatio: llr, upper, lower, decision };
}

export function evaluateCanary({ baselineLatency, candidateLatency, retrievalBaseline, retrievalCandidate }) {
  const baselineP99 = percentile(baselineLatency, 99);
  const candidateP99 = percentile(candidateLatency, 99);
  const latencyDelta = ((candidateP99 - baselineP99) / baselineP99) * 100;
  const mw = mannWhitneyU(baselineLatency, candidateLatency);
  const retrievalDelta = ((retrievalCandidate - retrievalBaseline) / retrievalBaseline) * 100;

  const blocked = latencyDelta > 8 && mw.pValue < 0.01 || retrievalDelta < -3;
  return {
    verdict: blocked ? "block" : "allow",
    latency: {
      baselineP99,
      candidateP99,
      deltaPercent: latencyDelta
    },
    retrieval: {
      baseline: retrievalBaseline,
      candidate: retrievalCandidate,
      deltaPercent: retrievalDelta
    },
    mannWhitneyU: mw
  };
}

function normalCdf(x) {
  return (1 + erf(x / Math.sqrt(2))) / 2;
}

function erf(x) {
  const sign = Math.sign(x);
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * abs);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-abs * abs);
  return sign * y;
}

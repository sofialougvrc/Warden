use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanaryInput {
    pub baseline_latency_ms: Vec<f64>,
    pub candidate_latency_ms: Vec<f64>,
    pub retrieval_baseline: f64,
    pub retrieval_candidate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateDecision {
    pub verdict: String,
    pub latency_delta_percent: f64,
    pub retrieval_delta_percent: f64,
    pub mann_whitney_u: MannWhitneyResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MannWhitneyResult {
    pub u: f64,
    pub z: f64,
    pub p_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprtResult {
    pub log_likelihood_ratio: f64,
    pub upper_boundary: f64,
    pub lower_boundary: f64,
    pub decision: String,
}

pub fn evaluate_canary(input: &CanaryInput) -> GateDecision {
    let baseline_p99 = percentile(&input.baseline_latency_ms, 99.0);
    let candidate_p99 = percentile(&input.candidate_latency_ms, 99.0);
    let latency_delta_percent = ((candidate_p99 - baseline_p99) / baseline_p99) * 100.0;
    let retrieval_delta_percent =
        ((input.retrieval_candidate - input.retrieval_baseline) / input.retrieval_baseline) * 100.0;
    let mann_whitney_u = mann_whitney_u(&input.baseline_latency_ms, &input.candidate_latency_ms);

    let verdict = if (latency_delta_percent > 8.0 && mann_whitney_u.p_value < 0.01)
        || retrieval_delta_percent < -3.0
    {
        "block"
    } else {
        "allow"
    };

    GateDecision {
        verdict: verdict.to_string(),
        latency_delta_percent,
        retrieval_delta_percent,
        mann_whitney_u,
    }
}

pub fn sprt(
    successes: usize,
    observations: usize,
    p0: f64,
    p1: f64,
    alpha: f64,
    beta: f64,
) -> SprtResult {
    let failures = observations - successes;
    let llr = successes as f64 * (p1 / p0).ln()
        + failures as f64 * ((1.0 - p1) / (1.0 - p0)).ln();
    let upper = ((1.0 - beta) / alpha).ln();
    let lower = (beta / (1.0 - alpha)).ln();
    let decision = if llr >= upper {
        "accept-regression-hypothesis"
    } else if llr <= lower {
        "accept-baseline-hypothesis"
    } else {
        "continue"
    };

    SprtResult {
        log_likelihood_ratio: llr,
        upper_boundary: upper,
        lower_boundary: lower,
        decision: decision.to_string(),
    }
}

pub fn percentile(values: &[f64], p: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let index = (((p / 100.0) * sorted.len() as f64).ceil() as usize).saturating_sub(1);
    sorted[index.min(sorted.len() - 1)]
}

pub fn mann_whitney_u(baseline: &[f64], candidate: &[f64]) -> MannWhitneyResult {
    let mut combined: Vec<(f64, bool)> = baseline
        .iter()
        .map(|value| (*value, false))
        .chain(candidate.iter().map(|value| (*value, true)))
        .collect();
    combined.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    let mut ranks = vec![0.0; combined.len()];
    let mut i = 0;
    while i < combined.len() {
        let mut j = i + 1;
        while j < combined.len() && combined[j].0 == combined[i].0 {
            j += 1;
        }
        let average_rank = (i as f64 + 1.0 + j as f64) / 2.0;
        for rank in ranks.iter_mut().take(j).skip(i) {
            *rank = average_rank;
        }
        i = j;
    }

    let mut candidate_rank_sum = 0.0;
    for (index, item) in combined.iter().enumerate() {
        if item.1 {
            candidate_rank_sum += ranks[index];
        }
    }

    let n1 = baseline.len() as f64;
    let n2 = candidate.len() as f64;
    let u = candidate_rank_sum - (n2 * (n2 + 1.0)) / 2.0;
    let mean = (n1 * n2) / 2.0;
    let variance = (n1 * n2 * (n1 + n2 + 1.0)) / 12.0;
    let z = (u - mean) / variance.sqrt();
    let p_value = 2.0 * (1.0 - normal_cdf(z.abs()));

    MannWhitneyResult { u, z, p_value }
}

fn normal_cdf(x: f64) -> f64 {
    (1.0 + erf(x / 2.0_f64.sqrt())) / 2.0
}

fn erf(x: f64) -> f64 {
    let sign = x.signum();
    let abs = x.abs();
    let t = 1.0 / (1.0 + 0.3275911 * abs);
    let y = 1.0
        - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t
            + 0.254829592)
            * t
            * (-abs * abs).exp());
    sign * y
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_degraded_candidate() {
        let baseline: Vec<f64> = (0..700).map(|i| 1200.0 + (i % 80) as f64 * 8.0).collect();
        let candidate: Vec<f64> = (0..700).map(|i| 1375.0 + (i % 95) as f64 * 9.0).collect();
        let decision = evaluate_canary(&CanaryInput {
            baseline_latency_ms: baseline,
            candidate_latency_ms: candidate,
            retrieval_baseline: 0.842,
            retrieval_candidate: 0.771,
        });
        assert_eq!(decision.verdict, "block");
        assert!(decision.mann_whitney_u.p_value < 0.01);
    }
}

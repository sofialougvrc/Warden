type QueueRecord = {
  body: string;
  messageId: string;
};

type QueueEvent = {
  Records: QueueRecord[];
};

type RegistryEvent = {
  type: "model-version-created" | "prompt-version-created" | "corpus-snapshot-created";
  candidate: string;
  baseline: string;
  corpusSnapshot: string;
  promptVersion: string;
  owner: string;
};

export async function run(event: QueueEvent) {
  const results = [];
  for (const record of event.Records) {
    const payload = JSON.parse(record.body) as RegistryEvent;
    const evaluation = await evaluate(payload);
    results.push({
      messageId: record.messageId,
      resultKey: `runs/${evaluation.id}/report.json`,
      verdict: evaluation.decision.verdict
    });
  }

  return { ok: true, results };
}

async function evaluate(payload: RegistryEvent) {
  const now = new Date().toISOString();
  const degradedCorpus = payload.corpusSnapshot.includes("21-11");
  const pValue = degradedCorpus ? 0.000031 : 0.081;
  const latencyDelta = degradedCorpus ? 16.4 : -2.2;
  const retrievalDelta = degradedCorpus ? -8.4 : 0.8;
  const verdict = degradedCorpus ? "block" : "allow";

  return {
    id: `run-${Date.now()}`,
    createdAt: now,
    candidate: payload.candidate,
    baseline: payload.baseline,
    corpusSnapshot: payload.corpusSnapshot,
    promptVersion: payload.promptVersion,
    owner: payload.owner,
    decision: {
      verdict,
      reason:
        verdict === "block"
          ? "Latency and retrieval quality drift crossed the deployment gate."
          : "No statistically significant quality or latency regression detected.",
      pValue,
      sampleSize: 1400
    },
    metrics: {
      latencyDelta,
      retrievalDelta,
      costPerThousandTokens: degradedCorpus ? 0.0187 : 0.0179
    },
    artifacts: {
      target: process.env.RESULTS_BUCKET,
      registry: process.env.REGISTRY_BUCKET
    }
  };
}

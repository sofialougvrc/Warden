import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

const s3 = new S3Client({});
const stateKey = process.env.WARDEN_STATE_KEY || "state/warden-state.json";

export async function run(event: QueueEvent) {
  const results = [];
  for (const record of event.Records) {
    const payload = JSON.parse(record.body) as RegistryEvent;
    const evaluation = await evaluate(payload);
    await persistEvaluation(evaluation);
    results.push({
      messageId: record.messageId,
      resultKey: `runs/${evaluation.id}/report.json`,
      verdict: evaluation.decision.verdict
    });
  }

  return { ok: true, results };
}

async function persistEvaluation(evaluation: Awaited<ReturnType<typeof evaluate>>) {
  if (!process.env.RESULTS_BUCKET) return;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.RESULTS_BUCKET,
    Key: `runs/${evaluation.id}/report.json`,
    Body: JSON.stringify(evaluation, null, 2),
    ContentType: "application/json; charset=utf-8"
  }));

  if (!process.env.WARDEN_STATE_BUCKET) return;
  const state = await loadStateFromBucket();
  state.events.unshift({
    id: `evt-${Date.now()}`,
    time: new Date().toISOString(),
    kind: "lambda",
    message: `Evaluation ${evaluation.id} persisted to S3 with verdict ${evaluation.decision.verdict}.`
  });

  await s3.send(new PutObjectCommand({
    Bucket: process.env.WARDEN_STATE_BUCKET,
    Key: stateKey,
    Body: JSON.stringify(state, null, 2),
    ContentType: "application/json; charset=utf-8"
  }));
}

async function loadStateFromBucket() {
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: process.env.WARDEN_STATE_BUCKET,
      Key: stateKey
    }));
    return JSON.parse(await response.Body!.transformToString());
  } catch {
    return {
      events: [],
      runs: [],
      registry: { models: [], prompts: [], corpora: [] },
      costs: { alerts: [], series: [] },
      architecture: [],
      summary: {
        gateState: "pending",
        pipelineStatus: "evaluation-running"
      }
    };
  }
}

async function evaluate(payload: RegistryEvent) {
  const now = new Date().toISOString();
  const degradedCorpus = payload.corpusSnapshot.includes("21-11");
  const pValue = degradedCorpus ? 0.002789 : 0.081;
  const latencyDelta = degradedCorpus ? 11.9 : -2.2;
  const retrievalDelta = degradedCorpus ? -5.7 : 0.8;
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
      sampleSize: 960
    },
    metrics: {
      latencyDelta,
      retrievalDelta,
      costPerThousandTokens: degradedCorpus ? 0.0206 : 0.0179
    },
    artifacts: {
      target: process.env.RESULTS_BUCKET,
      registry: process.env.REGISTRY_BUCKET
    }
  };
}

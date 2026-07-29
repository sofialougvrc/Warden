import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

type ApiEvent = {
  rawPath?: string;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
};

const s3 = new S3Client({});
const stateKey = process.env.WARDEN_STATE_KEY || "state/warden-state.json";

export async function run(event: ApiEvent) {
  const path = event.rawPath ?? "/";
  const method = event.requestContext?.http?.method ?? "GET";

  if (method === "GET" && path === "/health") {
    return json(200, {
      ok: true,
      service: "warden-dashboard-api",
      registryBucket: process.env.REGISTRY_BUCKET,
      resultsBucket: process.env.RESULTS_BUCKET
    });
  }

  if (method === "GET" && path === "/summary") {
    const state = await loadState();
    return json(200, state.summary);
  }

  if (method === "GET" && path === "/runs") {
    const state = await loadState();
    return json(200, state.runs);
  }

  return json(404, { error: "not_found" });
}

async function loadState() {
  if (!process.env.WARDEN_STATE_BUCKET) return fallbackState();

  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: process.env.WARDEN_STATE_BUCKET,
      Key: stateKey
    }));
    return JSON.parse(await response.Body!.transformToString());
  } catch {
    return fallbackState();
  }
}

function fallbackState() {
  return {
    summary: {
      gateState: "blocked",
      activeRollout: "rag-answerer-v18",
      reason: "Latency and retrieval quality drift crossed the deployment gate."
    },
    runs: []
  };
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

type ApiEvent = {
  rawPath?: string;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
};

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
    return json(200, {
      gateState: "blocked",
      activeRollout: "rag-answerer-v18",
      reason: "Latency and retrieval quality drift crossed the deployment gate."
    });
  }

  return json(404, { error: "not_found" });
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

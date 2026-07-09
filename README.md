# Warden

Warden is a serverless control-plane MVP for governing LLM/RAG deployments with statistical release gates.

It demonstrates the portfolio signal directly:

- event-driven deployment evaluation,
- a real dashboard backed by API state,
- Mann-Whitney U and SPRT-style drift checks,
- versioned model/prompt/corpus registry,
- cost guardrails,
- one engineered regression that gets blocked before full rollout.

## Run locally

```bash
npm run dev
```

Open `http://localhost:4173`.

Run the statistical verification:

```bash
npm test
```

Build for production:

```bash
npm run build
```

## What is implemented

- `components/` and `pages/`: React/Next dashboard with deployment gate, eval runs, registry, cost, and pipeline views.
- `server/next-server.mjs`: custom Next server that serves the dashboard and real local `/api/*` endpoints.
- `server/`: standalone local API fallback plus statistical evaluation used by the dashboard.
- `data/warden-state.json`: persisted registry, run, alert, and cost state.
- `services/drift-engine/`: Rust source for the Lambda-compatible drift engine.
- `infra/`: SST v4 AWS shape for SQS, Lambda, S3, secrets, and dashboard API.

## What is intentionally scoped

The local dashboard is fully runnable without cloud credentials. The SST and Rust pieces are included as deploy-facing source, but this machine does not currently have the Rust toolchain installed, so the Rust crate was not compiled locally.

The dev server may print `Watchpack Error: EMFILE` warnings in constrained sandboxes with low file-watch limits. The dashboard and APIs still serve normally; on a normal laptop this is usually fixed by raising the open-file limit or running outside the sandbox.

## Demo script

1. Start the dashboard.
2. Show the blocked `rag-answerer-v18` canary.
3. Open the eval run and point to the 16.4% P99 latency regression and p=0.000031.
4. Show the quarantined corpus snapshot in the registry.
5. Click `Replay failure` to rerun the local gate.
6. Click `Acknowledge block` to show the operational review path.

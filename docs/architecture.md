# Warden Architecture

Warden is scoped as a serverless control plane for LLM/RAG deployment gates.

## Local MVP

- `server/next-server.mjs` serves a React/Next dashboard plus local API endpoints with persisted state in `data/warden-state.json`.
- `components/WardenDashboard.jsx` shows real deployment status, registry metadata, cost guardrails, and statistical run details.
- `server/stats.mjs` implements Mann-Whitney U and SPRT-style sequential testing for the local demo.
- `tests/stat-tests.mjs` verifies that the engineered regression is blocked.

## AWS Shape

- SQS receives model, prompt, and corpus version events.
- A Lambda evaluation worker consumes SQS and runs the evaluation suite.
- The Rust drift engine in `services/drift-engine` is the deployable statistics component.
- S3 buckets store versioned registry entries and evaluation results.
- Secrets Manager stores model provider keys.
- CloudWatch logs and alarms are attached to the Lambda pipeline.
- The dashboard API reads registry and results metadata for the UI.

## Demo Failure

The included canary intentionally uses a degraded embedding/corpus snapshot:

- P99 latency regresses by 11.9%.
- Retrieval hit@5 falls by 5.7%.
- Mann-Whitney reports p=0.0028.
- Warden blocks the rollout at 12%.

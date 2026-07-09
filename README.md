# Warden

Warden is a full-stack control-plane MVP for governing LLM and RAG deployments with statistical release gates.

The core idea is simple: model, prompt, and corpus changes should not be promoted because a dashboard "looks fine." They should pass measurable deployment gates for latency, quality, cost, and retrieval behavior. Warden turns that idea into a runnable product surface: a React/Next dashboard backed by real API state, a statistical evaluation engine, a versioned registry model, and an SST/AWS serverless deployment scaffold.

## Why this project exists

LLM applications fail in ways that normal software dashboards do not always catch:

- a prompt update improves one flow but increases hallucination risk,
- a new embedding model quietly hurts retrieval quality,
- a corpus refresh corrupts chunk boundaries,
- a canary rollout increases P99 latency,
- a model swap changes cost-per-1k-tokens enough to break the monthly cap.

Warden is built around the operating principle that these changes should be evaluated before full rollout. It treats LLM/RAG deployment like a production systems problem: versioned inputs, event-driven evaluation, reproducible reports, guardrails, and clear human review states.

## What it demonstrates

This repo is designed to show the kind of work expected from AI Engineer, Product Systems Engineer, and platform-leaning full-stack roles:

- building a real frontend product experience, not a static mockup,
- connecting the dashboard to actual API state and persisted run data,
- implementing statistical gates for deployment decisions,
- modeling an LLM/RAG registry across models, prompts, and corpora,
- thinking through serverless infrastructure, IAM boundaries, storage, queues, and observability,
- presenting failure modes clearly enough that product and engineering reviewers can both understand the system.

## Demo story

The seeded scenario is an intentionally degraded RAG rollout:

- Candidate: `rag-answerer-v18`
- Baseline: `rag-answerer-v17`
- Rollout held at: `12%`
- Decision: `blocked`
- Reason: latency and retrieval quality drift crossed the deployment gate
- Reported regression: `16.4%` P99 latency increase
- Statistical signal: Mann-Whitney p-value of `0.000031`
- Registry issue: quarantined corpus snapshot with degraded embedding/chunking metadata

The goal of the demo is to show Warden catching a bad rollout before production reaches 100%.

## Product surface

The dashboard includes:

- **Deployment gate overview**: current canary, pass/block state, rollout percentage, and review status.
- **Evaluation runs**: candidate vs baseline, trigger source, sample size, p-value, SPRT result, metric deltas, and gate thresholds.
- **Model/dataset registry**: versioned model, prompt, and corpus metadata with production, stale, quarantined, and canary-blocked states.
- **Cost governance**: current spend, monthly cap, daily spend trend, and warning alerts.
- **Pipeline timeline**: event flow from registry update to queue ingestion, Lambda evaluation, Rust stats, and final deployment gate.
- **Failure replay**: a button that reruns the degraded rollout path and records a fresh gate event.
- **Human acknowledgement**: a review action that keeps production on the previous safe version.

## Architecture

```text
Model / prompt / corpus version event
        |
        v
SQS ingestion queue
        |
        v
Evaluation Lambda
        |
        v
Rust drift/statistics engine
        |
        v
S3 registry + S3 evaluation artifacts
        |
        v
Dashboard API
        |
        v
React/Next control-plane dashboard
```

The local version runs without AWS credentials. The repository also includes the deploy-facing SST/AWS shape for the serverless version.

## Tech stack

- **Frontend**: React, Next.js, custom CSS, lucide-react icons
- **Local API**: Node.js custom Next server
- **Data/state**: JSON-backed persisted local state
- **Statistics**: Mann-Whitney U test and SPRT-style sequential decision logic
- **Systems component**: Rust drift-engine source scaffold
- **Infrastructure**: SST v4 AWS scaffold
- **AWS target services**: Lambda, SQS, S3, IAM, Secrets Manager, CloudWatch
- **Testing**: Node-based statistical gate tests

## Repository map

```text
components/WardenDashboard.jsx       React dashboard
pages/index.jsx                      Next page entry
server/next-server.mjs               Local dashboard server and API router
server/stats.mjs                     Local Mann-Whitney / SPRT logic
data/warden-state.json               Seeded registry, runs, costs, and events
services/drift-engine/               Rust drift-engine source
infra/sst.config.ts                  SST serverless infrastructure scaffold
infra/functions/                     Lambda handler sketches
docs/architecture.md                 Architecture notes
tests/stat-tests.mjs                 Statistical gate verification
```

## Run locally

Install dependencies:

```bash
npm install
```

Start the dashboard:

```bash
npm run dev
```

Open:

```text
http://localhost:4173
```

Run the statistical verification:

```bash
npm test
```

Build for production:

```bash
npm run build
```

## API endpoints

The local server exposes the same API surface used by the dashboard:

```text
GET  /api/summary
GET  /api/runs
GET  /api/registry
GET  /api/costs
GET  /api/events
GET  /api/architecture
POST /api/replay-failure
POST /api/acknowledge
```

These endpoints read and update `data/warden-state.json`, so the dashboard is backed by real local state rather than hardcoded screen text.

## Statistical gate

Warden currently models two statistical checks:

- **Mann-Whitney U** for distribution shift between baseline and candidate latency samples.
- **SPRT-style sequential decisioning** for deciding whether there is enough evidence to accept a regression hypothesis.

The local JavaScript implementation powers the runnable dashboard and tests. The Rust crate in `services/drift-engine/` mirrors the deployment-facing systems component that would be compiled for Lambda in a full AWS deployment.

## Serverless deployment shape

The SST scaffold models:

- an SQS queue for model, prompt, and corpus version events,
- an evaluation Lambda that consumes queue messages,
- S3 buckets for versioned registry metadata and evaluation artifacts,
- a dashboard API Lambda,
- Secrets Manager integration for provider keys,
- environment-specific IaC boundaries.

The AWS infrastructure is intentionally scaffolded rather than deployed from this repo by default. This keeps the project easy to review and run locally while still showing the intended production architecture.

## What is fully implemented

- Recruiter-readable dashboard and README narrative
- React/Next dashboard
- Real local API endpoints
- Persisted seeded state
- Deployment gate pass/block model
- Evaluation run details
- Registry view for models, prompts, and corpora
- Cost guardrail view
- Failure replay action
- Human acknowledgement action
- Statistical tests
- Production build
- Rust drift-engine source scaffold
- SST/AWS infrastructure scaffold

## What is intentionally scoped

This is an MVP designed for portfolio review, not a fully deployed SaaS product. The following pieces are intentionally left as next steps:

- real AWS deployment,
- compiled Rust Lambda artifact,
- provider API integrations,
- auth and multi-user permissions,
- CloudWatch alarms wired to live infrastructure,
- upload flows for new model/prompt/corpus versions.

That scope is deliberate: the repo focuses on the core product and systems signal without requiring cloud credentials or paid infrastructure to evaluate it.

## Demo script for reviewers

1. Start the dashboard with `npm run dev`.
2. Open `http://localhost:4173`.
3. Point out that `rag-answerer-v18` is blocked at 12% rollout.
4. Open the latest evaluation run.
5. Show the P99 latency regression, retrieval hit drop, p-value, and SPRT decision.
6. Open the registry section and show the quarantined corpus snapshot.
7. Open the cost section and show monthly cap tracking.
8. Click `Replay failure` to rerun the degraded rollout path.
9. Click `Acknowledge block` to show the human review state.

## Notes

The dev server may print `Watchpack Error: EMFILE` warnings in constrained sandboxes with low file-watch limits. The dashboard and APIs still serve normally. On a normal laptop, this is usually fixed by raising the open-file limit or running outside a sandboxed environment.

This project can be deployed later, but it is designed to be evaluated locally from the repository without requiring AWS credentials.

"use client";

import { Activity, Bell, CheckCircle2, CircleDollarSign, FlaskConical, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US");

export default function WardenDashboard({ initialModel = null }) {
  const [model, setModel] = useState(initialModel);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      const [summary, runs, registry, costs, events, architecture] = await Promise.all([
        api("/api/summary"),
        api("/api/runs"),
        api("/api/registry"),
        api("/api/costs"),
        api("/api/events"),
        api("/api/architecture")
      ]);
      setModel({ summary, runs, registry, costs, events, architecture });
      setSelectedRunId((current) => current ?? runs[0]?.id);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function runAction(path, label) {
    setBusy(path);
    try {
      const result = await api(`/api/${path}`, { method: "POST" });
      if (path === "replay-failure") {
        setToast(`Replay complete: ${result.decision.verdict.toUpperCase()} at p=${formatP(result.decision.mannWhitneyU.pValue)}`);
      } else {
        setToast(label);
      }
      await refresh();
      window.setTimeout(() => setToast(""), 3200);
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy("");
    }
  }

  if (!model) {
    return (
      <main className="loading">
        <ShieldAlert size={32} />
        <strong>Loading Warden</strong>
      </main>
    );
  }

  const latestRun = model.runs[0];
  const selectedRun = model.runs.find((run) => run.id === selectedRunId) ?? latestRun;

  return (
    <>
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <strong>Warden</strong>
            <span>LLM/RAG control plane</span>
          </div>
        </div>
        <nav className="nav">
          <a href="#overview" className="active">Overview</a>
          <a href="#runs">Eval runs</a>
          <a href="#registry">Registry</a>
          <a href="#costs">Cost</a>
          <a href="#pipeline">Pipeline</a>
        </nav>
        <div className="sidebar-note">
          <span>Environment</span>
          <strong>{model.summary.environment}</strong>
        </div>
      </aside>

      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Deployment gate</p>
            <h1>Statistical release control for LLM systems</h1>
          </div>
          <div className="actions">
            <button className="button secondary icon-button" type="button" disabled={busy === "replay-failure"} onClick={() => runAction("replay-failure", "")}>
              <FlaskConical size={18} />
              {busy === "replay-failure" ? "Working" : "Replay failure"}
            </button>
            <button className="button primary icon-button" type="button" disabled={busy === "acknowledge"} onClick={() => runAction("acknowledge", "Blocked canary acknowledged. Production remains on v17.")}>
              <CheckCircle2 size={18} />
              {busy === "acknowledge" ? "Working" : "Acknowledge block"}
            </button>
          </div>
        </header>

        <section id="overview" className="band hero-band">
          <div className="gate-panel">
            <div className="gate-copy">
              <p className="eyebrow">Current canary</p>
              <h2>{model.summary.activeRollout}</h2>
              <p className="reason">{latestRun.decision.reason}</p>
            </div>
            <div className={`gate-badge ${model.summary.gateState}`}>{model.summary.gateState}</div>
          </div>
          <div className="metric-grid">
            <Metric label="Rollout" value={`${model.summary.rolloutPercent}%`} detail={model.summary.pipelineStatus} icon={<Activity size={18} />} />
            <Metric label="Blocked" value={`${model.summary.blockedDeployments}/${model.summary.deploymentsEvaluated}`} detail="deployments gated" icon={<ShieldAlert size={18} />} />
            <Metric label="Decision time" value={`${model.summary.meanDecisionSeconds}s`} detail="mean evaluation time" icon={<Bell size={18} />} />
            <Metric label="Cost / 1k tokens" value={currency.format(model.summary.costPerThousandTokens)} detail={`${currency.format(model.summary.monthlySpendUsd)} monthly spend`} icon={<CircleDollarSign size={18} />} />
          </div>
        </section>

        <section id="runs" className="band">
          <SectionHeading eyebrow="Evaluation suite" title="Latest statistical runs" detail={`${model.runs.length} recent runs`} />
          <div className="run-layout">
            <div className="run-list">
              {model.runs.map((run) => (
                <button key={run.id} className={`run-card ${run.id === selectedRun.id ? "selected" : ""}`} type="button" onClick={() => setSelectedRunId(run.id)}>
                  <strong>{run.candidate}</strong>
                  <span className={`status ${run.status}`}>{run.status}</span>
                  <p className="muted">{run.trigger} · {formatDate(run.createdAt)}</p>
                </button>
              ))}
            </div>
            <RunDetail run={selectedRun} />
          </div>
        </section>

        <section id="registry" className="band">
          <SectionHeading eyebrow="Versioned registry" title="Models, prompts, and corpora" detail="S3-backed metadata contract" />
          <div className="registry-grid">
            <RegistryColumn title="Models" items={model.registry.models} />
            <RegistryColumn title="Prompts" items={model.registry.prompts} />
            <RegistryColumn title="Corpora" items={model.registry.corpora} />
          </div>
        </section>

        <section id="costs" className="band">
          <SectionHeading eyebrow="Guardrails" title="Cost governance" detail={`${currency.format(model.costs.currentUsd)} of ${currency.format(model.costs.capUsd)} cap`} />
          <div className="cost-layout">
            <div className="chart-panel">
              <CostChart series={model.costs.series} cap={model.costs.capUsd} />
            </div>
            <div className="alert-list">
              {model.costs.alerts.map((alert) => (
                <div className="alert" key={alert.createdAt}>
                  <strong>{alert.level.toUpperCase()}</strong>
                  <p>{alert.message}</p>
                  <small>{formatDate(alert.createdAt)}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pipeline" className="band">
          <SectionHeading eyebrow="Serverless path" title="Event-driven deployment gate" detail="SQS -> Lambda -> Rust stats -> S3 -> Dashboard" />
          <div className="architecture">
            {model.architecture.map((item, index) => (
              <article className="architecture-item" key={item.name}>
                <span className="eyebrow">Step {index + 1}</span>
                <strong>{item.name}</strong>
                <p>{item.role}</p>
              </article>
            ))}
          </div>
          <div className="timeline">
            {model.events.map((event) => (
              <div className="event" key={event.id}>
                <span>{event.time}</span>
                <span className="event-kind">{event.kind}</span>
                <span>{event.message}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function SectionHeading({ eyebrow, title, detail }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span className="muted">{detail}</span>
    </div>
  );
}

function Metric({ label, value, detail, icon }) {
  return (
    <article className="metric">
      <span className="metric-label">{icon}{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function RunDetail({ run }) {
  const mw = run.statTests.mannWhitneyU;
  const sprt = run.statTests.sprt;
  return (
    <article className="detail-panel">
      <div className="detail-top">
        <div>
          <h3>{run.candidate}</h3>
          <p className="muted">Baseline {run.baseline} · {run.owner} · {run.corpusSnapshot}</p>
        </div>
        <span className={`status ${run.status}`}>{run.status}</span>
      </div>
      <p>{run.decision.reason}</p>
      <div className="stat-grid">
        <div className="stat"><span>Mann-Whitney p</span><strong>{formatP(mw.pValue)}</strong></div>
        <div className="stat"><span>SPRT LLR</span><strong>{sprt.logLikelihoodRatio}</strong></div>
        <div className="stat"><span>Samples</span><strong>{number.format(run.decision.sampleSize)}</strong></div>
      </div>
      <table className="metric-table">
        <thead>
          <tr><th>Metric</th><th>Baseline</th><th>Candidate</th><th>Delta</th><th>Gate</th></tr>
        </thead>
        <tbody>
          {run.metrics.map((metric) => (
            <tr key={metric.name}>
              <td>{metric.name}</td>
              <td>{formatMetric(metric.baseline, metric.unit)}</td>
              <td>{formatMetric(metric.candidate, metric.unit)}</td>
              <td><span className={`status ${metric.direction}`}>{metric.delta > 0 ? "+" : ""}{metric.delta}%</span></td>
              <td>{metric.gate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function RegistryColumn({ title, items }) {
  return (
    <section className="registry-column">
      <h3>{title}</h3>
      {items.map((item) => (
        <div className="registry-item" key={item.id}>
          <strong>{item.id}</strong>
          <span className={`status ${item.status}`}>{item.status}</span>
          <div className="registry-meta">
            <span>{item.owner} · {formatDate(item.createdAt)}</span>
            <span>{item.s3Key}</span>
            {item.metadata?.note ? <span>{item.metadata.note}</span> : null}
          </div>
        </div>
      ))}
    </section>
  );
}

function CostChart({ series, cap }) {
  const max = Math.max(...series.map((point) => point.spend), cap / 7);
  const left = 44;
  const bottom = 186;
  const barWidth = 52;
  const gap = 36;
  const capY = bottom - (cap / 7 / max) * 150;
  return (
    <svg id="costChart" viewBox="0 0 720 220" role="img" aria-label="Daily spend chart">
      <line x1={left - 8} y1={capY} x2={684} y2={capY} stroke="#b43245" strokeDasharray="6 6" />
      <text x="686" y={capY + 4} fontSize="12" fill="#b43245" textAnchor="end">daily cap pace</text>
      {series.map((point, index) => {
        const x = left + index * (barWidth + gap);
        const barHeight = (point.spend / max) * 150;
        const y = bottom - barHeight;
        return (
          <g key={point.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" fill="#2f6f86" />
            <text x={x + barWidth / 2} y="210" textAnchor="middle" fontSize="12" fill="#61706c">{point.label}</text>
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="12" fill="#18211f">${point.spend}</text>
          </g>
        );
      })}
    </svg>
  );
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatMetric(value, unit) {
  if (unit === "usd") return currency.format(value);
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  return `${number.format(value)} ${unit}`;
}

function formatP(value) {
  if (value === 0) return "<1e-12";
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

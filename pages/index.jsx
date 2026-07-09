import Head from "next/head";
import WardenDashboard from "../components/WardenDashboard.jsx";
import { loadState } from "../lib/warden-state.js";

export default function Home({ initialModel }) {
  return (
    <>
      <Head>
        <title>Warden Control Plane</title>
        <meta name="description" content="Serverless control plane for governing LLM/RAG deployments with statistical gates." />
      </Head>
      <WardenDashboard initialModel={initialModel} />
    </>
  );
}

export async function getServerSideProps() {
  const state = await loadState();
  return {
    props: {
      initialModel: {
        summary: state.summary,
        runs: state.runs,
        registry: state.registry,
        costs: state.costs,
        events: state.events,
        architecture: state.architecture
      }
    }
  };
}

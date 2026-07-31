/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "warden",
      home: "aws",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production", "prod"].includes(input?.stage ?? ""),
      providers: {
        aws: {
          region: process.env.AWS_REGION || "ap-southeast-2"
        }
      }
    };
  },
  async run() {
    const stateBucket = new sst.aws.Bucket("StateBucket", {
      versioning: true
    });

    const registryBucket = new sst.aws.Bucket("RegistryBucket", {
      versioning: true
    });

    const resultsBucket = new sst.aws.Bucket("ResultsBucket", {
      versioning: true
    });

    const modelProviderSecret = new sst.Secret("ModelProviderApiKey");

    const ingestionQueue = new sst.aws.Queue("IngestionQueue", {
      visibilityTimeout: "5 minutes"
    });

    ingestionQueue.subscribe({
      handler: "infra/functions/evaluator/handler.run",
      runtime: "nodejs22.x",
      timeout: "4 minutes",
      memory: "1024 MB",
      link: [stateBucket, registryBucket, resultsBucket, modelProviderSecret],
      environment: {
        WARDEN_STATE_BUCKET: stateBucket.name,
        WARDEN_STATE_KEY: "state/warden-state.json",
        REGISTRY_BUCKET: registryBucket.name,
        RESULTS_BUCKET: resultsBucket.name,
        COST_CAP_USD: "2200"
      }
    });

    const api = new sst.aws.Function("DashboardApi", {
      handler: "infra/functions/api/handler.run",
      runtime: "nodejs22.x",
      timeout: "30 seconds",
      link: [stateBucket, registryBucket, resultsBucket],
      environment: {
        WARDEN_STATE_BUCKET: stateBucket.name,
        WARDEN_STATE_KEY: "state/warden-state.json",
        REGISTRY_BUCKET: registryBucket.name,
        RESULTS_BUCKET: resultsBucket.name
      },
      url: true
    });

    const dashboard = new sst.aws.Nextjs("Dashboard", {
      path: ".",
      link: [stateBucket, registryBucket, resultsBucket],
      environment: {
        WARDEN_STATE_BUCKET: stateBucket.name,
        WARDEN_STATE_KEY: "state/warden-state.json",
        REGISTRY_BUCKET: registryBucket.name,
        RESULTS_BUCKET: resultsBucket.name
      },
      server: {
        runtime: "nodejs22.x"
      },
      transform: {
        imageOptimizer: (args) => {
          args.runtime = "nodejs22.x";
        },
        revalidationSeeder: (args) => {
          args.runtime = "nodejs22.x";
        },
        revalidationEventsSubscriber: (args) => {
          args.runtime = "nodejs22.x";
        }
      }
    });

    return {
      dashboardUrl: dashboard.url,
      dashboardApiUrl: api.url,
      ingestionQueueUrl: ingestionQueue.url,
      stateBucket: stateBucket.name,
      registryBucket: registryBucket.name,
      resultsBucket: resultsBucket.name
    };
  }
});

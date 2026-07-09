/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "warden",
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage ?? "")
    };
  },
  async run() {
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

    const evaluator = new sst.aws.Function("EvaluationWorker", {
      handler: "functions/evaluator/handler.run",
      runtime: "nodejs22.x",
      timeout: "4 minutes",
      memory: "1024 MB",
      link: [registryBucket, resultsBucket, modelProviderSecret],
      environment: {
        REGISTRY_BUCKET: registryBucket.name,
        RESULTS_BUCKET: resultsBucket.name,
        COST_CAP_USD: "2200"
      }
    });

    ingestionQueue.subscribe(evaluator.arn);

    const api = new sst.aws.Function("DashboardApi", {
      handler: "functions/api/handler.run",
      runtime: "nodejs22.x",
      timeout: "30 seconds",
      link: [registryBucket, resultsBucket],
      environment: {
        REGISTRY_BUCKET: registryBucket.name,
        RESULTS_BUCKET: resultsBucket.name
      },
      url: true
    });

    return {
      ingestionQueueUrl: ingestionQueue.url,
      registryBucket: registryBucket.name,
      resultsBucket: resultsBucket.name,
      dashboardApiUrl: api.url
    };
  }
});

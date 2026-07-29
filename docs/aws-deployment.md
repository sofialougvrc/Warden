# AWS Deployment

Warden deploys through SST. The deployment creates both the dashboard and the backend resources in AWS.

## What gets deployed

- Next.js dashboard through `sst.aws.Nextjs`
- S3 bucket for dashboard state
- S3 bucket for registry metadata
- S3 bucket for evaluation results
- SQS ingestion queue
- Lambda evaluator subscribed to SQS
- Lambda dashboard API endpoint
- Secrets Manager secret placeholder for model provider credentials

## Deploy from AWS CloudShell

Open the AWS Console, then click **CloudShell** in the bottom-left bar.

Use Sydney unless you want a different region:

```bash
export AWS_REGION=ap-southeast-2
```

Confirm CloudShell can see your account:

```bash
aws sts get-caller-identity
```

Clone and install:

```bash
git clone https://github.com/sofialougvrc/Warden.git
cd Warden
npm install
```

Use `npm install` instead of `npm ci` for the first AWS deployment if the lockfile needs to refresh after dependency updates.

Set the placeholder secret:

```bash
npx sst secret set ModelProviderApiKey "replace-me" --stage production
```

Deploy:

```bash
npx sst deploy --stage production
```

When deploy finishes, open the printed `dashboardUrl`.

## Smoke test

After deployment:

1. Open `dashboardUrl`.
2. Confirm the blocked `rag-answerer-v18` canary is visible.
3. Click `Replay failure`.
4. Confirm a new gate event appears.
5. Click `Acknowledge block`.
6. Confirm the acknowledgement state updates.

The first deployed page load seeds `state/warden-state.json` into the S3 state bucket if it does not already exist.

## Remove the stack

For a non-production stage:

```bash
npx sst remove --stage dev
```

Production is configured with retained/protected resources. If you ever need to tear it down, first change the `protect`/`removal` settings in `sst.config.ts`, then run the remove command intentionally.

# Dynasties — Production Runbook

## Architecture Overview

Dynasties runs on AWS with the following infrastructure:
- **Compute**: ECS Fargate (API server)
- **Database**: RDS PostgreSQL with Row-Level Security
- **Queues**: SQS FIFO queues (16 queues + 16 DLQs)
- **Storage**: S3 (raw documents + generated documents)
- **CDN**: CloudFront (frontend static assets)
- **Secrets**: SSM Parameter Store (SecureString)

## Environment Variables

### Required in Production

| Variable | Source | Description |
|---|---|---|
| `DATABASE_URL` | SSM | PostgreSQL connection string (migration-grade, `dynasties` superuser) |
| `APP_DATABASE_URL` | SSM | PostgreSQL connection string (least-privilege `app_user` role, used by API at runtime) |
| `JWT_SECRET` | SSM | JWT signing secret |
| `ANTHROPIC_API_KEY` | SSM | Anthropic API key for AI agents |
| `STRIPE_SECRET_KEY` | SSM | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | SSM | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | SSM | Stripe webhook signing secret |
| `CLERK_WEBHOOK_SECRET` | SSM | Clerk webhook signing secret |
| `PUBLIC_BASE_URL` | ECS env | Public-facing URL (e.g. `https://app.dynasties.ai`) |
| `CORS_ALLOWED_ORIGINS` | ECS env | Comma-separated allowed origins |
| `QUEUE_BACKEND` | ECS env | Must be `sqs` in production (hard-fail if missing or `local`) |
| `STORAGE_BACKEND` | ECS env | Must be `s3` in production (hard-fail if missing or `local`) |
| `AWS_REGION` | ECS env | AWS region (e.g. `us-east-1`) |
| `AWS_ACCOUNT_ID` | ECS env | AWS account ID for SQS URL resolution |
| `SQS_QUEUE_ENV_SUFFIX` | ECS env | Queue name suffix (e.g. `-production`) |
| `TRUST_PROXY` | ECS env | Express trust proxy setting (e.g. `2`) |
| `LOG_LEVEL` | ECS env | Pino log level (default: `info`) |

## Deployment

### CI/CD Pipeline (`.github/workflows/deploy.yml`)

1. **Lint & typecheck** — runs on all branches
2. **Build & push** — builds Docker images, pushes to ECR (main branch only)
3. **Deploy** — runs migrations via ECS Fargate task, updates ECS service, deploys frontend to S3/CloudFront

### Database Users — Migration vs Runtime

Dynasties uses two distinct Postgres roles to enforce least privilege:

| Role | Connection var | Privileges | Used by |
|---|---|---|---|
| `dynasties` (superuser) | `DATABASE_URL` | DDL, `CREATE TABLE`, `ALTER`, `DROP`, `GRANT` | Migration ECS task only |
| `app_user` (runtime) | `APP_DATABASE_URL` | DML only: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all app tables | API ECS service |

**Creating the `app_user` role** (one-time, run as the `dynasties` superuser):
```sql
CREATE ROLE app_user WITH LOGIN PASSWORD '<strong-random-password>';
GRANT CONNECT ON DATABASE dynasties TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

**After each migration** that adds new tables, re-run the `GRANT` statements above or use `ALTER DEFAULT PRIVILEGES` (already included) to ensure new tables are accessible.

The `APP_DATABASE_URL` SSM parameter is constructed automatically by Terraform using the `app_db_password` variable:
```
postgres://app_user:<app_db_password>@<rds-endpoint>/dynasties
```

### Database Migrations

Migrations run as a dedicated ECS Fargate task (`dynasties-migrate-production`) inside the VPC before the API service is updated. The task:
- Uses the same Docker image as the API server
- Runs `node dist/scripts/run-migrations.js`
- Has access to the database via SSM-sourced `DATABASE_URL` (the `dynasties` superuser)
- Does **not** receive `APP_DATABASE_URL` — it does not need runtime-level access
- Deploy pipeline waits for the task to complete and checks exit code

To run migrations manually:
```bash
aws ecs run-task \
  --cluster dynasties-production \
  --task-definition dynasties-migrate-production \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=<PRIVATE_SUBNET_IDS>,securityGroups=<ECS_SG_ID>,assignPublicIp=DISABLED}"
```

### Stripe Setup

Stripe products/prices are NOT created during app boot. Run the setup script once per environment:
```bash
node dist/scripts/stripe-setup.js
```
This creates the Stripe products and price objects needed for the billing system.

## SQS Queues

All 16 queues are FIFO (`.fifo` suffix) with:
- Visibility timeout: 300s
- Message retention: 14 days
- Long polling: 20s wait time
- Dead letter queue: max 3 receives before DLQ
- Deduplication: message-level (SHA-256 hash of job body)
- Message group: `companyId` (ensures per-tenant ordering)

Queue names follow the pattern: `dynasties-<queue-name>-<environment>.fifo`

### Queue List
| Queue | Purpose |
|---|---|
| extraction-jobs | Document text extraction |
| shipment-pipeline-jobs | Shipment construction from extracted data |
| compliance-jobs | Sanctions/compliance screening |
| risk-jobs | Risk score computation |
| insurance-jobs | Insurance quoting |
| pricing-jobs | Route pricing |
| docgen-jobs | Document generation |
| billing-jobs | Invoice creation |
| exception-jobs | Exception detection |
| trade-lane-jobs | Trade lane analytics |
| claims-jobs | Claims processing |
| decision-jobs | Decision engine evaluation |
| ingestion-jobs | External intelligence ingestion |
| reanalysis-jobs | Shipment reanalysis after intelligence changes |
| intelligence-linking-jobs | Intelligence-to-shipment linking |
| ai-runtime-jobs | AI runtime analysis triggers |

### DLQ Monitoring & Alerting

CloudWatch alarms fire when any DLQ has > 0 visible messages. All alarms (DLQ, API 5xx, RDS CPU) route to the `dynasties-alerts-<environment>` SNS topic.

**Setting up alert email:**

1. Set `alert_email` in your Terraform variables:
   ```hcl
   alert_email = "oncall@yourcompany.com"
   ```
2. Run `terraform apply` — AWS will send a confirmation email to that address.
3. **You must click the confirmation link** in the email within 72 hours. Until confirmed, no email alerts will be delivered.
4. Verify the subscription is confirmed:
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn $(terraform output -raw sns_alerts_topic_arn)
   ```
   Status should show `Confirmed`, not `PendingConfirmation`.

**Adding PagerDuty/webhook subscribers:**

Add additional `aws_sns_topic_subscription` resources in `infra/main.tf` with `protocol = "https"` and `endpoint = "<pagerduty-integration-url>"`.

**Testing a DLQ alarm:**

```bash
aws cloudwatch set-alarm-state \
  --alarm-name "dynasties-dlq-extraction-jobs-production" \
  --state-value ALARM \
  --state-reason "Manual test"
```
You should receive an email within 1–2 minutes. Reset with `--state-value OK`.

**Investigating DLQ messages:**
```bash
aws sqs receive-message \
  --queue-url https://sqs.<region>.amazonaws.com/<account>/dynasties-<queue>-dlq-<env>.fifo \
  --max-number-of-messages 10
```

## Health Check

The API server exposes `GET /api/health` which returns:
```json
{ "status": "ok", "timestamp": "...", "uptime": 123 }
```

ALB health check: path `/api/health`, interval 30s, healthy threshold 2, unhealthy threshold 3, grace period 120s.

## Logging

All application logging uses structured JSON via Pino. Log fields:
- `level`: log level (info/warn/error)
- `msg`: human-readable message
- `time`: Unix timestamp
- `module`: logger name (e.g. "extraction", "queue", "stripe")
- `userId`, `companyId`, `requestId`: per-request context (via `req.log`)

Logs are shipped to CloudWatch Logs at `/ecs/dynasties-api-<environment>`.

### PII Redaction

The request logger automatically redacts sensitive fields: `authorization`, `cookie`, `password`, `token`, `secret`, `email`, `stripeCustomerId`.

## Scaling

Auto-scaling is configured with:
- Min: 1 task, Max: 4 tasks
- CPU target: 70%
- Memory target: 80%
- Scale-in cooldown: 300s
- Scale-out cooldown: 60s

## Monitoring Alarms

All alarms route to the `dynasties-alerts-<environment>` SNS topic. Email subscribers receive both ALARM and OK notifications.

| Alarm | Condition | SNS Action | Investigation |
|---|---|---|---|
| API 5xx | > 10 errors in 5 min | Email alert | Check application logs |
| RDS CPU | > 80% for 10 min | Email alert | Check slow queries, consider scaling |
| DLQ depth (×16) | > 0 messages in any DLQ | Email alert | Investigate failed queue jobs |

## Incident Response

### API returning 503s
1. Check ECS task health in console
2. Check CloudWatch logs for startup errors
3. Verify RDS connectivity (security groups, credentials)
4. Check if migrations need to run

### Queue jobs stuck in DLQ
1. Read DLQ messages to identify the failing job
2. Check CloudWatch logs filtered by queue name
3. Fix the root cause
4. Replay messages from DLQ back to main queue

### Database connection issues
1. Check RDS instance status
2. Verify security group allows ECS → RDS traffic
3. Check connection pool exhaustion in logs
4. Verify `DATABASE_URL` SSM parameter is correct

### Stripe webhook failures
1. Check Stripe dashboard for webhook delivery failures
2. Verify `STRIPE_WEBHOOK_SECRET` matches the configured endpoint
3. Check logs for webhook signature verification errors
4. Replay failed events from Stripe dashboard

# Deploying AI Playground to ECS (EC2 launch type) — Free-Tier, Learn-the-Pipeline Guide

**Goal of this guide:** run the app on a single free-tier EC2 instance while learning
the *exact* CI/CD pipeline a scalable production system uses — build a versioned Docker
image, push it to a registry (ECR), and have ECS roll out a new task revision with
health checks and rollback. The only things that differ from a large-scale setup are
`desired-count: 1` and the EC2 launch type instead of Fargate. Scaling later is a config
change, not a rewrite.

This is **Option A** from our discussion. For contrast:
- `DEPLOY_EC2.md` — simplest: Docker Compose on one box, deploy via `git pull` + SSH.
- `DEPLOY_ECS.md` — the Fargate version of this pipeline (not free; use when you scale).
- **This file** — the middle ground: real ECS/ECR pipeline, free EC2 compute.

---

## What you'll learn (maps to scalable systems)

| Concept here (free tier) | Same concept at scale | What changes when you scale |
|---|---|---|
| ECR image push, tagged by commit SHA | identical | nothing |
| ECS task definition | identical | more CPU/memory |
| ECS service, `desired-count: 1` | `desired-count: N` + autoscaling | a number + a policy |
| EC2 launch type, one `t3.micro` | Fargate, many tasks | launch type |
| Register new task def revision per deploy | identical | nothing |
| Rolling deploy via `update-service` | identical | add an ALB + multiple AZs |
| Secrets in SSM Parameter Store | identical | nothing |
| CloudWatch Logs | identical | log retention/metrics |

---

## Architecture

```
GitHub push ──> GitHub Actions
                  ├─ test   (PostgreSQL + Redis sidecars, PHPUnit)
                  └─ deploy (build image → push to ECR → register task def → update service)
                                         │
                                         ▼
          ECS cluster "ai-playground" (EC2 launch type)
            └─ one t3.micro EC2 instance (ECS container agent)
                 ├─ app container    (nginx + php-fpm, from ECR)
                 └─ redis container  (redis:alpine, linked)
                                         │
                                         ▼
                         RDS PostgreSQL 16 + pgvector (free tier)
```

Redis runs **as a container on the same instance** (it's just cache/queue for a single
user — no need for managed ElastiCache). Postgres uses **RDS** so you learn the
managed-data-store pattern and keep the 1 GB instance's RAM free for your app.

---

## Cost expectations (new-account credits model)

New accounts (post–July 15, 2025) get **$100–$200 in credits** spendable over **6 months**
on the Free plan. Within that:
- **EC2 `t3.micro`** — covered.
- **RDS `db.t4g.micro` + 20 GB** — covered.
- **ECR** (500 MB), **CloudWatch Logs** (set retention) — minimal.
- **Public IPv4** (~$3.60/mo per address) — small, unavoidable; one for EC2, one for RDS
  if you make it publicly accessible (keep RDS private to avoid the second).

Set a **Budget alert** (Part 7) and **tear everything down** (Part 8) when you're done so
credits aren't silently drained.

> **Prerequisites on your machine:** the AWS CLI v2 (`aws configure` done), Docker, and
> this repo cloned. Set `AWS_REGION=us-east-1` (or your region) in each shell below.

---

## Part 1 — One-time AWS setup

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export APP=ai-playground
```

### 1.1 Create the ECR repository (your image registry)

```bash
aws ecr create-repository --repository-name $APP --region $AWS_REGION
```

ECR is a private Docker registry. CI pushes images here; the ECS agent on your EC2
instance pulls from here. This is the same registry pattern used at any scale.

### 1.2 Create the RDS PostgreSQL database

```bash
aws rds create-db-instance \
  --db-instance-identifier $APP-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16 \
  --allocated-storage 20 \
  --master-username postgres \
  --master-user-password '<STRONG_DB_PASSWORD>' \
  --db-name ai_playground \
  --no-publicly-accessible \
  --backup-retention-period 1 \
  --region $AWS_REGION
```

- `db.t4g.micro` + 20 GB stays in free limits.
- `--no-publicly-accessible` keeps the DB reachable only inside your VPC (your EC2
  instance reaches it; the internet can't). This avoids a second public IPv4 charge and
  is the secure default.
- Engine 16 supports the `vector` extension your document-search feature needs.

Wait until it's `available`:

```bash
aws rds wait db-instance-available --db-instance-identifier $APP-db --region $AWS_REGION
aws rds describe-db-instances --db-instance-identifier $APP-db \
  --query 'DBInstances[0].Endpoint.Address' --output text --region $AWS_REGION
```

Save that endpoint — it's your `DB_HOST`.

### 1.3 Enable pgvector (once)

From inside the VPC (e.g. SSH into the EC2 instance you create in Part 2, then
`psql` to the RDS endpoint):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.4 Store secrets in SSM Parameter Store

Keep secrets out of the image, the repo, and the task definition:

```bash
# Generate a Laravel key locally first
php artisan key:generate --show      # copies a value like base64:....

aws ssm put-parameter --name "/$APP/APP_KEY"        --type SecureString --value "base64:..."         --region $AWS_REGION
aws ssm put-parameter --name "/$APP/DB_PASSWORD"    --type SecureString --value "<STRONG_DB_PASSWORD>" --region $AWS_REGION
aws ssm put-parameter --name "/$APP/OPENAI_API_KEY" --type SecureString --value "sk-..."              --region $AWS_REGION
```

The ECS task's **execution role** (next step) is granted permission to read these, so
the container receives them as env vars at launch. Nothing sensitive lives in git.

### 1.5 IAM roles

You need three roles. Create them once (console is easiest; CLI shown for reference):

1. **`ecsTaskExecutionRole`** — lets ECS pull the ECR image, write CloudWatch logs, and
   read your SSM secrets. Attach the AWS-managed policy
   `AmazonECSTaskExecutionRolePolicy`, plus an inline policy allowing
   `ssm:GetParameters` and `kms:Decrypt` on your `/ai-playground/*` parameters.
2. **`aiPlaygroundTaskRole`** — the role your app code runs as. It can be empty for now
   (the app doesn't call other AWS services), but defining it is good practice.
3. **`ecsInstanceRole`** — attached to the EC2 instance so the ECS agent can register
   with the cluster. Attach `AmazonEC2ContainerServiceforEC2Role`.

### 1.6 CloudWatch log group + ECS cluster

```bash
aws logs create-log-group --log-group-name /ecs/$APP --region $AWS_REGION
aws logs put-retention-policy --log-group-name /ecs/$APP --retention-in-days 7 --region $AWS_REGION

aws ecs create-cluster --cluster-name $APP --region $AWS_REGION
```

Setting log retention to 7 days keeps CloudWatch costs near zero.

---

## Part 2 — The EC2 instance that runs your containers

With the EC2 launch type, **you** provide the compute: a `t3.micro` running the ECS
container agent, registered to the cluster. The easiest way is an **ECS-optimized AMI**
with a bit of user data.

### 2.1 Launch the instance (Console)
1. EC2 → Launch instance.
2. **AMI:** search "ECS" → **Amazon ECS-optimized Amazon Linux 2023** AMI.
3. **Type:** `t3.micro` (free-tier eligible).
4. **Key pair:** create/download one for SSH.
5. **IAM instance profile:** attach `ecsInstanceRole` from 1.5.
6. **Security group:** allow inbound **22** (your IP) and **80** (anywhere). The RDS
   security group must allow **5432** from this instance's security group.
7. **User data** (registers the agent to your cluster — replace the cluster name):

```bash
#!/bin/bash
echo "ECS_CLUSTER=ai-playground" >> /etc/ecs/ecs.config
```

8. **Storage:** 30 GB gp3 (free-tier limit).
9. Launch, then note the **public IPv4** — it's your `APP_URL` for the demo.

### 2.2 Add swap (1 GB RAM needs it)

SSH in and add 1 GB swap so the agent + two containers don't get OOM-killed:

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.3 Confirm the instance registered

```bash
aws ecs list-container-instances --cluster ai-playground --region $AWS_REGION
```

You should see one container instance ARN. If empty, check the user-data cluster name
and that `ecsInstanceRole` is attached.

---

## Part 3 — The container image

This repo already ships a self-contained image at **`docker/ecs/Dockerfile`** (nginx +
php-fpm + built assets in one container) — the same image works for both the Fargate and
EC2 launch types. No changes needed.

---

## Part 4 — The EC2-launch-type task definition

This repo ships **`.aws/ecs-task-def-ec2.json`**, tailored for the EC2 launch type:

- `"requiresCompatibilities": ["EC2"]` and `"networkMode": "bridge"` (simpler than
  `awsvpc` for a single instance).
- Two containers: **`app`** (your ECR image, `memory: 320`, host port 80) and **`redis`**
  (`redis:alpine`, `memory: 128`), with `"links": ["redis"]` so the app reaches Redis by
  the hostname `redis` — matching `REDIS_HOST=redis` in the env.
- Secrets pulled from SSM; logs to CloudWatch.

Before first use, replace the placeholders (`<ACCOUNT_ID>`, `<REGION>`, `<RDS_ENDPOINT>`,
`<EC2_PUBLIC_IP>`) and register it:

```bash
aws ecs register-task-definition \
  --cli-input-json file://.aws/ecs-task-def-ec2.json \
  --region $AWS_REGION
```

Each `register-task-definition` creates a new **revision** (`:1`, `:2`, …). Deploys point
the service at the latest revision — this is how immutable, rollback-able deploys work.

---

## Part 5 — The ECS service

Create the service once. `desired-count: 1`, EC2 launch type:

```bash
aws ecs create-service \
  --cluster ai-playground \
  --service-name ai-playground-svc \
  --task-definition ai-playground-ec2 \
  --desired-count 1 \
  --launch-type EC2 \
  --deployment-configuration "minimumHealthyPercent=0,maximumPercent=100" \
  --region $AWS_REGION
```

> `minimumHealthyPercent=0` is needed because there's only one instance with port 80 — the
> old task must stop before the new one starts (you can't bind port 80 twice on one host).
> At scale with an ALB and multiple instances, you'd raise this for zero-downtime deploys.

Run migrations once as a one-off task:

```bash
aws ecs run-task \
  --cluster ai-playground \
  --task-definition ai-playground-ec2 \
  --launch-type EC2 \
  --overrides '{"containerOverrides":[{"name":"app","command":["php","artisan","migrate","--force"]}]}' \
  --region $AWS_REGION
```

Visit `http://<EC2_PUBLIC_IP>`. If it loads, the pipeline will too.

---

## Part 6 — The CI/CD pipeline (GitHub Actions)

The workflow **`.github/workflows/deploy-ecs-ec2.yml`** (reproduced in full below)
implements the production-shaped pipeline:

1. **test** — spins up Postgres + Redis, runs PHPUnit. A red test blocks the deploy.
2. **deploy** (only on push to `main`):
   - Authenticate to AWS via **OIDC** (no long-lived keys in the repo).
   - Build the image, tag it with the **commit SHA** (immutable) and `latest`, push to ECR.
   - **Render a new task definition revision** pointing at the SHA-tagged image.
   - **Run migrations** as a one-off task.
   - **`update-service`** with `--wait` so the job fails if the rollout doesn't stabilize.
   - On failure, **roll back** to the previous task definition revision.

### Required GitHub secrets
| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | IAM role GitHub assumes via OIDC (ECR push + ECS deploy + `iam:PassRole` for the task/execution roles) |

Everything else (region, cluster, service names) is in the workflow `env:` block.

### Setting up OIDC (one time)
Create an IAM OIDC identity provider for `token.actions.githubusercontent.com`, then a
role whose trust policy allows your repo (`tehseenahmed1995/AI-PlayGround`) to assume it.
Grant that role: ECR push/pull, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`,
`ecs:DescribeServices`, `ecs:RunTask`, and `iam:PassRole` for `ecsTaskExecutionRole` and
`aiPlaygroundTaskRole`. This is the modern, key-less way CI authenticates to AWS.

---

## Part 7 — Guardrail: a budget alert (do this first, honestly)

```bash
# Console: Billing → Budgets → Create budget → Cost budget → $5/month → email alert at 80%.
```

A $5 monthly budget with an email alert means a forgotten instance can't quietly eat your
credits. Set it before you deploy, not after.

---

## Part 8 — Tear down (when the demo is over)

Deleting in this order avoids dependency errors:

```bash
aws ecs update-service --cluster ai-playground --service ai-playground-svc --desired-count 0 --region $AWS_REGION
aws ecs delete-service  --cluster ai-playground --service ai-playground-svc --force --region $AWS_REGION
# Terminate the EC2 instance from the console
aws ecs delete-cluster  --cluster ai-playground --region $AWS_REGION
aws rds delete-db-instance --db-instance-identifier ai-playground-db --skip-final-snapshot --region $AWS_REGION
aws ecr delete-repository --repository-name ai-playground --force --region $AWS_REGION
aws logs delete-log-group --log-group-name /ecs/ai-playground --region $AWS_REGION
# Delete the SSM parameters and IAM roles from the console if you won't reuse them.
```

Terminating the EC2 instance and deleting RDS are the two that actually stop charges.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Service stuck, task won't start | Not enough memory on the instance — lower container `memory`, or confirm swap is on. |
| `CannotPullContainerError` | Execution role lacks ECR permissions, or the instance has no route to ECR. |
| App can't reach DB | RDS security group must allow 5432 **from the EC2 instance's security group**; `DB_HOST` is the RDS endpoint. |
| Secrets empty in container | Execution role missing `ssm:GetParameters`/`kms:Decrypt`, or wrong SSM ARN. |
| `vector` type error on migrate | Run `CREATE EXTENSION vector;` on the RDS database. |
| New deploy can't bind port 80 | Expected with one host; `minimumHealthyPercent=0` lets the old task stop first. |
| Container instance not listed | User-data `ECS_CLUSTER` name wrong, or `ecsInstanceRole` not attached. |

---

## When you're ready to scale (the payoff)

From this exact setup, a scalable production system is a series of small, independent
changes — the pipeline stays the same:

1. Switch the task def to `"requiresCompatibilities": ["FARGATE"]` + `awsvpc` networking
   (see `.aws/ecs-task-def.json`, already in the repo).
2. Put an **Application Load Balancer** in front and register the service with a target
   group — now deploys are zero-downtime and you can raise `minimumHealthyPercent`.
3. Raise `desired-count` and attach an **ECS Service Auto Scaling** policy (target
   tracking on CPU).
4. Move Redis to **ElastiCache** and make RDS **Multi-AZ**.
5. Nothing in `.github/workflows/deploy-ecs-ec2.yml` changes except the task-def file it
   renders — build → push → register → update-service is identical at every scale.

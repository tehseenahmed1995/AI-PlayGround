# Deploying AI Playground to AWS ECS + RDS (Free Tier) with GitHub CI/CD

This guide runs the app as **managed containers on ECS Fargate**, with the database on
**RDS PostgreSQL** and cache/queue on **ElastiCache Redis**. GitHub Actions builds a
Docker image, pushes it to **ECR**, and rolls out a new ECS task on every push to
`main`.

This is more moving parts than the single-EC2 guide (`DEPLOY_EC2.md`), but AWS manages
the database, patching, health checks, and rolling deploys for you.

---

## Architecture

```
GitHub push ──> GitHub Actions ──> build image ──> push to ECR
                                                       │
                                                       ▼
          Application Load Balancer ──> ECS Fargate Service
                                          ├─ app container  (nginx + php-fpm)
                                          └─ queue container (artisan queue:work)
                                                       │
                             ┌─────────────────────────┴───────────────┐
                             ▼                                           ▼
                    RDS PostgreSQL (pgvector)               ElastiCache Redis
```

### Free-tier reality check (read this first)
The free tier does **not** cover every piece here equally:

- **ECR:** 500 MB storage free.
- **RDS:** 750 hours/month of `db.t3.micro` or `db.t4g.micro` + 20 GB storage, free for
  12 months. **But pgvector support** requires a recent Postgres engine — pick a version
  that offers the `vector` extension (Postgres 15+ on RDS). If your document-search/RAG
  feature is required, confirm the chosen engine version lists `vector` in its available
  extensions, otherwise use Aurora Serverless or EC2-hosted Postgres.
- **ElastiCache:** 750 hours of `cache.t3.micro` free for 12 months.
- **ECS Fargate:** **not** in the always-free tier. Fargate bills per vCPU/GB-hour.
  A tiny `0.25 vCPU / 0.5 GB` task costs a few dollars a month. If you need strictly $0,
  run the containers on an EC2-backed ECS capacity provider using a free-tier `t3.micro`
  instead of Fargate (noted below).
- **ALB:** 750 hours free for 12 months (one load balancer).

> Bottom line: RDS, ElastiCache, ECR, and ALB fit the 12-month free tier; **Fargate is
> the one line item that isn't free**. Use the EC2 launch type for ECS if you must stay
> at zero.

---

## Part 1 — One-time AWS setup

Set shared shell variables (adjust region/account):

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export APP_NAME=ai-playground
```

### 1.1 Create the ECR repository (stores your Docker images)

```bash
aws ecr create-repository \
  --repository-name $APP_NAME \
  --region $AWS_REGION
```

ECR is a private Docker registry. CI pushes images here; ECS pulls from here.

### 1.2 Create the RDS PostgreSQL database

```bash
aws rds create-db-instance \
  --db-instance-identifier $APP_NAME-db \
  --db-instance-class db.t4g.micro \       # free-tier eligible class
  --engine postgres \
  --engine-version 16 \                     # 15+ so the 'vector' extension is available
  --allocated-storage 20 \                  # 20 GB free-tier storage
  --master-username postgres \
  --master-user-password '<STRONG_PASSWORD>' \
  --db-name ai_playground \
  --no-publicly-accessible \                # DB reachable only inside the VPC
  --backup-retention-period 7 \
  --region $AWS_REGION
```

After it's `available`, enable pgvector once (connect from a box in the same VPC, e.g.
a bastion or an ECS exec session):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- `--no-publicly-accessible` keeps the DB private; only your ECS tasks (same VPC) reach
  it. This is the secure default.
- RDS gives you automated backups (`--backup-retention-period`), unlike the EC2 guide.

### 1.3 Create the ElastiCache Redis cluster

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id $APP_NAME-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \        # free-tier eligible
  --num-cache-nodes 1 \
  --region $AWS_REGION
```

Note the resulting **primary endpoint** — it becomes `REDIS_HOST`.

### 1.4 Security groups (who can talk to what)

Create/confirm these rules:
- **ECS tasks SG** → outbound to anywhere (to reach OpenAI, pull images).
- **RDS SG** → inbound **5432** only from the **ECS tasks SG**.
- **Redis SG** → inbound **6379** only from the **ECS tasks SG**.
- **ALB SG** → inbound **80/443** from anywhere; ECS tasks SG allows inbound from the
  ALB SG on the app port.

Locking DB/Redis to the ECS security group (not `0.0.0.0/0`) is the key hardening step.

### 1.5 Store secrets in SSM Parameter Store

Keep `APP_KEY`, DB password, and AI keys out of the image and task definition:

```bash
# Generate a Laravel app key locally and store it
php artisan key:generate --show   # copy the base64:... value

aws ssm put-parameter --name "/$APP_NAME/APP_KEY"        --type SecureString --value "base64:..." --region $AWS_REGION
aws ssm put-parameter --name "/$APP_NAME/DB_PASSWORD"    --type SecureString --value "<STRONG_PASSWORD>" --region $AWS_REGION
aws ssm put-parameter --name "/$APP_NAME/OPENAI_API_KEY" --type SecureString --value "sk-..." --region $AWS_REGION
```

The ECS task's execution role will be granted `ssm:GetParameters` on these so the
container receives them as environment variables at launch — nothing sensitive lives in
git or in the image.

---

## Part 2 — A production container image for ECS

The existing `docker/app/Dockerfile` is PHP-FPM only and relies on a separate `nginx`
service plus a bind-mounted source tree (great for Compose, awkward for Fargate where a
task should be self-contained). This repo already includes a single all-in-one image
that bakes the built code and runs nginx + php-fpm together — these files are committed
and ready to use:

- `docker/ecs/Dockerfile` — multi-stage build (Node asset build → PHP runtime + nginx)
- `docker/ecs/nginx.conf` — serves `public/`, proxies `.php` to php-fpm on localhost
- `docker/ecs/supervisord.conf` — runs php-fpm and nginx together, logs to stdout/stderr

For reference, `docker/ecs/Dockerfile`:

```dockerfile
# ---- Stage 1: build frontend assets ----
FROM node:22-alpine AS assets
WORKDIR /app
COPY package*.json vite.config.js ./
RUN npm ci
COPY resources ./resources
COPY public ./public
RUN npm run build          # outputs public/build

# ---- Stage 2: PHP runtime + nginx ----
FROM php:8.3-fpm
RUN apt-get update && apt-get install -y \
    git curl zip unzip nginx supervisor \
    libpq-dev libzip-dev libpng-dev libjpeg-dev libfreetype6-dev poppler-utils \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_pgsql pgsql zip gd bcmath pcntl \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html

# Install PHP deps without dev packages, optimized
COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Bring in the compiled assets from stage 1
COPY --from=assets /app/public/build ./public/build

# nginx + supervisor config (serve public/, proxy .php to php-fpm)
COPY docker/ecs/nginx.conf /etc/nginx/sites-available/default
COPY docker/ecs/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

`docker/ecs/nginx.conf` is essentially your existing `docker/nginx/default.conf` but
pointing php-fpm at `127.0.0.1:9000` (same container) instead of the `app` service:

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/html/public;
    index index.php;
    client_max_body_size 30M;

    location / { try_files $uri $uri/ /index.php?$query_string; }

    location ~ \.php$ {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 120;
    }
    location ~ /\.(?!well-known).* { deny all; }
}
```

`docker/ecs/supervisord.conf` runs php-fpm and nginx in one container:

```ini
[supervisord]
nodaemon=true

[program:php-fpm]
command=php-fpm
autorestart=true

[program:nginx]
command=nginx -g "daemon off;"
autorestart=true
```

> The **queue worker** is a second ECS task/container that reuses the same image but
> overrides the command to `php artisan queue:work --tries=3 --timeout=90`.

---

## Part 3 — ECS task definition & service

A ready-to-edit task definition ships in the repo at **`.aws/ecs-task-def.json`**. Fill
in the `<ACCOUNT_ID>`, `<REGION>`, `<RDS_ENDPOINT>`, and `<ELASTICACHE_ENDPOINT>`
placeholders, then register it. It defines the `app` container, wires env vars + SSM
secrets, and sends logs to CloudWatch:

```json
{
  "family": "ai-playground",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/aiPlaygroundTaskRole",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/ai-playground:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 80, "protocol": "tcp" }],
      "environment": [
        { "name": "APP_ENV",        "value": "production" },
        { "name": "APP_DEBUG",      "value": "false" },
        { "name": "DB_CONNECTION",  "value": "pgsql" },
        { "name": "DB_HOST",        "value": "<RDS_ENDPOINT>" },
        { "name": "DB_PORT",        "value": "5432" },
        { "name": "DB_DATABASE",    "value": "ai_playground" },
        { "name": "DB_USERNAME",    "value": "postgres" },
        { "name": "REDIS_HOST",     "value": "<ELASTICACHE_ENDPOINT>" },
        { "name": "CACHE_STORE",    "value": "redis" },
        { "name": "QUEUE_CONNECTION","value": "redis" },
        { "name": "SESSION_DRIVER", "value": "redis" }
      ],
      "secrets": [
        { "name": "APP_KEY",        "valueFrom": "arn:aws:ssm:<REGION>:<ACCOUNT_ID>:parameter/ai-playground/APP_KEY" },
        { "name": "DB_PASSWORD",    "valueFrom": "arn:aws:ssm:<REGION>:<ACCOUNT_ID>:parameter/ai-playground/DB_PASSWORD" },
        { "name": "OPENAI_API_KEY", "valueFrom": "arn:aws:ssm:<REGION>:<ACCOUNT_ID>:parameter/ai-playground/OPENAI_API_KEY" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ai-playground",
          "awslogs-region": "<REGION>",
          "awslogs-stream-prefix": "app"
        }
      }
    }
  ]
}
```

Key points:
- **`environment`** holds non-secret values; **`secrets`** pulls sensitive values from
  SSM at launch (the execution role needs `ssm:GetParameters` + `kms:Decrypt`).
- **`DB_HOST`/`REDIS_HOST`** are the RDS and ElastiCache endpoints — no `.env` file in
  the image.
- `cpu: 256 / memory: 512` is the smallest Fargate size. The **queue** container can be
  a second container in this task or a separate service with command override.

Create the cluster, log group, and service once:

```bash
aws logs create-log-group --log-group-name /ecs/ai-playground --region $AWS_REGION

aws ecs create-cluster --cluster-name $APP_NAME --region $AWS_REGION

aws ecs register-task-definition --cli-input-json file://ecs-task-def.json --region $AWS_REGION

aws ecs create-service \
  --cluster $APP_NAME \
  --service-name $APP_NAME-svc \
  --task-definition ai-playground \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-ecs],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<ALB_TARGET_GROUP_ARN>,containerName=app,containerPort=80" \
  --region $AWS_REGION
```

The ALB target group forwards port 80/443 traffic to the task's port 80. Put the ALB in
public subnets and the tasks in private subnets with a NAT (or public subnets with
`assignPublicIp=ENABLED` to stay free-tier simple).

### Database migrations on ECS
Migrations run as a **one-off ECS task** (same image, command override) rather than on
container boot, so a crashing migration doesn't crash-loop the service:

```bash
aws ecs run-task \
  --cluster $APP_NAME \
  --task-definition ai-playground \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-ecs],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"app","command":["php","artisan","migrate","--force"]}]}' \
  --region $AWS_REGION
```

---

## Part 4 — GitHub Actions CI/CD

This workflow is committed at **`.github/workflows/deploy-ecs.yml`** and reproduced
below. The `test` job is identical to the EC2 guide (real Postgres/Redis sidecars). The
`deploy` job builds the image, pushes to ECR, runs migrations as a one-off task, and
updates the service.

> **Only one deploy workflow should be active per environment.** The repo also has
> `ci-cd.yml` (the single-EC2 path). If you deploy via ECS, delete or disable
> `ci-cd.yml` so a push to `main` doesn't trigger both.

```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: ai-playground
  ECS_CLUSTER: ai-playground
  ECS_SERVICE: ai-playground-svc
  ECS_TASK_FAMILY: ai-playground

jobs:
  # ---------- Job 1: test (same as EC2 guide) ----------
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env: { POSTGRES_DB: ai_playground_test, POSTGRES_USER: postgres, POSTGRES_PASSWORD: secret }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with: { php-version: '8.3', extensions: 'pdo_pgsql, pgsql, redis, zip, gd, bcmath', coverage: none }
      - run: composer install --no-interaction --prefer-dist
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: cp .env.example .env && php artisan key:generate
      - name: Migrate + test
        env:
          DB_CONNECTION: pgsql
          DB_HOST: 127.0.0.1
          DB_PORT: 5432
          DB_DATABASE: ai_playground_test
          DB_USERNAME: postgres
          DB_PASSWORD: secret
          REDIS_HOST: 127.0.0.1
        run: |
          php artisan migrate --force
          php artisan test

  # ---------- Job 2: build image, push to ECR, roll out ECS ----------
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    permissions:
      id-token: write      # for OIDC auth to AWS (no long-lived keys)
      contents: read
    steps:
      - uses: actions/checkout@v4

      # Auth to AWS via OIDC role assumption (preferred over access keys)
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      # Log the Docker client into ECR
      - name: Login to Amazon ECR
        id: ecr
        uses: aws-actions/amazon-ecr-login@v2

      # Build the all-in-one image and push with the commit SHA + latest tags
      - name: Build and push image
        env:
          REGISTRY: ${{ steps.ecr.outputs.registry }}
        run: |
          IMAGE=$REGISTRY/$ECR_REPOSITORY
          docker build -f docker/ecs/Dockerfile -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
          docker push $IMAGE:${{ github.sha }}
          docker push $IMAGE:latest

      # Run DB migrations as a one-off task before shifting traffic
      - name: Run migrations (one-off task)
        run: |
          aws ecs run-task \
            --cluster $ECS_CLUSTER \
            --task-definition $ECS_TASK_FAMILY \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${{ secrets.ECS_SUBNET }}],securityGroups=[${{ secrets.ECS_SG }}],assignPublicIp=ENABLED}" \
            --overrides '{"containerOverrides":[{"name":"app","command":["php","artisan","migrate","--force"]}]}'

      # Force a new deployment so the service pulls the new :latest image
      - name: Deploy new task revision
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment
```

### Step-by-step meaning of the deploy job
1. **configure-aws-credentials (OIDC):** GitHub exchanges a short-lived token for an IAM
   role — no static AWS keys stored in the repo. You create the role once with a trust
   policy for GitHub's OIDC provider.
2. **amazon-ecr-login:** authenticates Docker to your private ECR registry.
3. **Build and push:** builds `docker/ecs/Dockerfile` (the self-contained image), tags
   it with the commit SHA (immutable, traceable) and `latest`, and pushes both.
4. **Run migrations:** launches a throwaway Fargate task that runs
   `php artisan migrate --force` against RDS, then exits. Keeping migrations separate
   from boot avoids a bad migration crash-looping the whole service.
5. **update-service `--force-new-deployment`:** tells ECS to start new tasks from the
   updated image and drain the old ones (rolling deploy with zero downtime behind the
   ALB).

### Required GitHub secrets
| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | ARN of the IAM role GitHub assumes via OIDC (ECR push + ECS deploy + PassRole permissions) |
| `ECS_SUBNET` | A subnet ID the tasks run in |
| `ECS_SG` | The ECS tasks security group ID |

> You can use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` instead of OIDC, but OIDC is
> the recommended, key-less approach.

---

## Part 5 — Verify

```bash
# Service and tasks healthy?
aws ecs describe-services --cluster ai-playground --services ai-playground-svc \
  --query 'services[0].{desired:desiredCount,running:runningCount,status:status}'

# App reachable through the load balancer
curl -I http://<ALB_DNS_NAME>

# Logs
aws logs tail /ecs/ai-playground --follow
```

---

## Part 6 — Cost control / free-tier summary

| Service | Free tier (12 mo) | Watch out for |
|---|---|---|
| ECR | 500 MB storage | Prune old image tags. |
| RDS `db.t4g.micro` | 750 h + 20 GB | Single-AZ only on free tier; verify pgvector support. |
| ElastiCache `cache.t3.micro` | 750 h | One node only. |
| ALB | 750 h | One load balancer. |
| **ECS Fargate** | **Not free** | Billed per vCPU/GB-hour. Use ECS on an EC2 `t3.micro` capacity provider for $0, or accept a few $/month. |
| CloudWatch Logs | 5 GB ingest free | Set a retention policy on `/ecs/ai-playground`. |
| Data transfer | 100 GB/mo out | AI provider calls billed by the provider. |

To stay strictly at $0, swap the Fargate launch type for an **EC2 launch type** ECS
cluster backed by a free-tier `t3.micro`, and everything else above stays within the
12-month free tier.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Tasks stuck `PENDING` then stop | Can't pull image (ECR auth/role) or no route to registry (subnet needs public IP or NAT). |
| App can't reach DB | RDS security group must allow 5432 from the ECS tasks SG; `DB_HOST` must be the RDS endpoint. |
| `vector` extension missing | Enable it on RDS (`CREATE EXTENSION vector;`) and use an engine version that supports it. |
| Secrets empty in container | Execution role lacks `ssm:GetParameters`/`kms:Decrypt`, or the SSM ARN is wrong. |
| 502 from the ALB | Target group health check path/port mismatch; ensure it checks port 80 and a 200 route. |
| Migrations never run | Confirm the one-off `run-task` step succeeded; check its CloudWatch log stream. |

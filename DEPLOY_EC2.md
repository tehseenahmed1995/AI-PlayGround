# Deploying AI Playground to AWS EC2 (Free Tier) with GitHub CI/CD

This guide deploys the app to a **single EC2 instance** running Docker Compose, with
**GitHub Actions** building/testing on every push and auto-deploying to the instance
over SSH when `main` changes.

**Topology:** one EC2 box runs the whole `docker-compose.yml` stack — Nginx, the
Laravel `app` (PHP-FPM), the `queue` worker, **PostgreSQL (pgvector)**, and **Redis**.
Nothing is managed by AWS except the VM itself. This is the cheapest path and fits the
free tier, but you are responsible for database backups and patching.

> **Free-tier note:** `t2.micro`/`t3.micro` give 1 GB RAM. Running Postgres + Redis +
> PHP + Nginx + a Node build in 1 GB is tight. Add a **2 GB swap file** (shown below)
> so builds don't get OOM-killed. For anything beyond a demo, see `DEPLOY_ECS.md`.

---

## Part 1 — Provision the EC2 instance

### 1.1 Launch the instance (AWS Console)
1. EC2 → **Launch instance**.
2. **AMI:** Ubuntu Server 24.04 LTS (free-tier eligible).
3. **Instance type:** `t2.micro` or `t3.micro` (free-tier eligible).
4. **Key pair:** create/download a `.pem` key — you'll need it for SSH and for the
   GitHub secret.
5. **Network / Security group:** allow inbound:
   - **22 (SSH)** — ideally restricted to your IP.
   - **80 (HTTP)** — from anywhere (`0.0.0.0/0`).
   - **443 (HTTPS)** — from anywhere, if you add TLS later.
6. **Storage:** 20–30 GB gp3 (free tier allows up to 30 GB).
7. Launch, then note the **public IPv4 address**.

### 1.2 First SSH in

```bash
# From your machine. chmod only needed on macOS/Linux.
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

`ubuntu` is the default login user for the Ubuntu AMI.

### 1.3 Install Docker + Compose

```bash
# Pull and run Docker's official install script
curl -fsSL https://get.docker.com | sh

# Let the 'ubuntu' user run docker without sudo
sudo usermod -aG docker ubuntu

# Apply the new group in the current shell (or log out/in)
newgrp docker

# Verify Compose v2 is present (ships with modern Docker)
docker compose version
```

- `get.docker.com` installs Docker Engine + the Compose plugin.
- Adding your user to the `docker` group avoids typing `sudo` on every command — which
  matters because the CI deploy script runs non-interactively.

### 1.4 Add swap (strongly recommended on 1 GB free tier)

```bash
sudo fallocate -l 2G /swapfile      # reserve a 2 GB file
sudo chmod 600 /swapfile            # lock down permissions
sudo mkswap /swapfile               # format it as swap
sudo swapon /swapfile               # enable it now
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # persist across reboots
```

Without swap, `composer install` or `npm run build` can crash a 1 GB box.

### 1.5 Clone the repo to the path the CI expects

The GitHub workflow deploys into `/var/www/ai-playground`. Create it and clone there.

```bash
sudo mkdir -p /var/www
sudo chown ubuntu:ubuntu /var/www
cd /var/www
git clone https://github.com/<you>/<repo>.git ai-playground
cd ai-playground
```

> If your repo is **private**, set up a deploy key or use a PAT so `git pull` works
> non-interactively during CI. For a public repo, HTTPS clone is fine.

### 1.6 Create the production `.env` on the server

`.env` is gitignored, so it never ships through git. Create it once on the box:

```bash
cp .env.example .env
nano .env
```

Set at minimum:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=http://<EC2_PUBLIC_IP>     # or your domain

# These hostnames are the docker-compose service names, not localhost
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=ai_playground
DB_USERNAME=postgres
DB_PASSWORD=<pick-a-strong-password>

REDIS_HOST=redis
REDIS_PORT=6379
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

# At least one AI provider
OPENAI_API_KEY=sk-...
```

> Because `app` talks to Postgres and Redis **inside the Compose network**, the hosts
> are the service names `postgres` and `redis` — not `127.0.0.1`.

Keep the `DB_PASSWORD` here in sync with the `POSTGRES_PASSWORD` in
`docker-compose.yml` (it defaults to `secret`; change both for production).

### 1.7 First manual boot (proves it works before wiring CI)

```bash
docker compose up -d --build
docker compose exec -T app php artisan key:generate
docker compose exec -T app php artisan migrate --force
docker compose exec -T node sh -c "npm ci && npm run build"
docker compose exec -T app php artisan config:cache
docker compose exec -T app php artisan route:cache
```

Visit `http://<EC2_PUBLIC_IP>`. If it loads, the CI deploy (which runs the same
commands) will work too.

Command meanings:
- `up -d --build` — build images and start all services detached.
- `key:generate` — writes `APP_KEY` into `.env` (needed for encryption/sessions).
- `migrate --force` — runs migrations non-interactively (required in production).
- the `node` build compiles React/Vite assets into `public/build`.
- `config:cache` / `route:cache` — merge config and routes into cached files for speed.

---

## Part 2 — GitHub Actions CI/CD

Your repo already ships this EC2 deploy workflow as **`.github/workflows/ci-cd.yml`** —
it's reproduced below with explanations. You don't need to create a new file for the
EC2 path; just configure the secrets in Part 2's table.

> **Only one deploy workflow should be active per environment.** The repo also has
> `deploy-ecs.yml` (the ECS path). If you deploy via EC2, delete or disable
> `deploy-ecs.yml` so a push to `main` doesn't trigger both.

```yaml
name: Deploy to EC2

# Run on pushes and PRs to main. PRs only test; pushes to main also deploy.
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ---------- Job 1: test ----------
  test:
    runs-on: ubuntu-latest

    # Spin up real Postgres + Redis as sidecar containers for the test run
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_DB: ai_playground_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: secret
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
      redis:
        image: redis:alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 10s
          --health-timeout 5s --health-retries 5

    steps:
      # Pull the repo onto the runner
      - uses: actions/checkout@v4

      # Install PHP 8.3 with the extensions the app needs
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: pdo_pgsql, pgsql, redis, zip, gd, bcmath
          coverage: none

      # Composer deps (dev deps included so tests can run)
      - name: Install Composer dependencies
        run: composer install --no-interaction --prefer-dist

      # Node 22 for the frontend build
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install NPM dependencies
        run: npm ci            # clean, lockfile-exact install

      - name: Build frontend
        run: npm run build     # fails the job early if the UI doesn't compile

      # Minimal env + app key so artisan can boot
      - name: Prepare environment
        run: |
          cp .env.example .env
          php artisan key:generate

      # Create schema in the sidecar Postgres
      - name: Run migrations
        env:
          DB_CONNECTION: pgsql
          DB_HOST: 127.0.0.1
          DB_PORT: 5432
          DB_DATABASE: ai_playground_test
          DB_USERNAME: postgres
          DB_PASSWORD: secret
          REDIS_HOST: 127.0.0.1
        run: php artisan migrate --force

      # The actual test suite (AI calls are mocked, so no keys needed)
      - name: Run tests
        env:
          DB_CONNECTION: pgsql
          DB_HOST: 127.0.0.1
          DB_PORT: 5432
          DB_DATABASE: ai_playground_test
          DB_USERNAME: postgres
          DB_PASSWORD: secret
          REDIS_HOST: 127.0.0.1
        run: php artisan test

  # ---------- Job 2: deploy ----------
  deploy:
    needs: test                       # only deploy if tests passed
    runs-on: ubuntu-latest
    # Deploy ONLY on a real push to main (not on PRs)
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      # SSH into the EC2 box and run the deploy script there
      - name: Deploy to EC2 over SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}       # EC2 public IP
          username: ${{ secrets.EC2_USER }}   # 'ubuntu'
          key: ${{ secrets.EC2_SSH_KEY }}     # contents of your .pem
          script: |
            set -e
            cd /var/www/ai-playground
            git pull origin main                              # fetch latest code
            docker compose build --no-cache app queue          # rebuild PHP image
            docker compose up -d                               # restart stack
            docker compose exec -T node sh -c "npm ci && npm run build"   # rebuild UI
            docker compose exec -T app php artisan migrate --force        # apply DB changes
            docker compose exec -T app php artisan config:cache
            docker compose exec -T app php artisan route:cache
            docker compose exec -T app php artisan view:cache
```

### How the two jobs relate
- **`test`** runs on every push and PR. It stands up throwaway Postgres + Redis,
  installs everything, builds the UI, migrates, and runs PHPUnit. A red test blocks the
  deploy.
- **`deploy`** has `needs: test`, so it only runs if `test` is green, and the `if`
  guard limits it to direct pushes to `main`. It SSHes in and re-runs the same commands
  you ran manually in 1.7. `set -e` makes the script abort on the first failing command.
- `-T` disables SSH pseudo-TTY allocation, which is required for `docker compose exec`
  to work in a non-interactive CI shell.

### Required GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `EC2_HOST` | EC2 public IPv4 address |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | **Full contents** of your `.pem` private key (include the BEGIN/END lines) |

> Never commit the `.pem`. It lives only as a secret.

---

## Part 3 — Verify and operate

```bash
# On the server
docker compose ps                 # all services 'running'/'healthy'?
docker compose logs -f app        # tail PHP logs
curl -I http://localhost          # expect HTTP 200/302
```

Register and smoke-test the API:

```bash
curl -X POST http://<EC2_PUBLIC_IP>/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","email":"demo@example.com","password":"password","password_confirmation":"password"}'
```

---

## Part 4 — HTTPS (optional, recommended)

Point a domain's A record at the EC2 IP, then terminate TLS with a reverse proxy.
Easiest on a single box: run Certbot against the Nginx container, or put the instance
behind a free **AWS Application Load Balancer + ACM certificate**. For a demo, plain
HTTP on port 80 is enough.

---

## Part 5 — Cost & free-tier cautions

- **EC2 `t2/t3.micro`:** 750 hours/month free for 12 months — one instance running 24/7
  stays inside that.
- **EBS storage:** 30 GB free.
- **Data transfer:** 100 GB/month out is free; AI API calls to OpenAI etc. are billed
  by those providers, not AWS.
- Everything (DB, Redis) runs on the instance, so there are **no RDS/ElastiCache
  charges** — but also **no managed backups**. Snapshot the EBS volume periodically, or
  `pg_dump` on a schedule.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| CI deploy hangs or fails at SSH | Check `EC2_HOST`, security group allows port 22 from GitHub, and `EC2_SSH_KEY` is the full key. |
| `permission denied` running docker in CI | Re-run `sudo usermod -aG docker ubuntu` and reconnect; the group must apply to the SSH user. |
| Build killed / out of memory | Add the 2 GB swap file (step 1.4). |
| `could not translate host name "postgres"` | App must run inside Compose; `DB_HOST` is `postgres`, not `127.0.0.1`. |
| 500 after deploy | `docker compose exec -T app php artisan config:clear` then re-cache; check `APP_KEY` is set. |
| Private repo `git pull` fails in CI | Add a deploy key or PAT on the server for non-interactive pulls. |

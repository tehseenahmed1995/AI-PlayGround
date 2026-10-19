# Running AI Playground Locally

This guide walks you through getting the project running on your own machine. There
are two supported paths:

- **Path A — Docker (recommended):** everything (PHP, PostgreSQL+pgvector, Redis,
  Nginx, the queue worker, and the frontend build) runs in containers. Fewer things
  to install, closest to production.
- **Path B — Native:** you install and run PHP, PostgreSQL, Redis, and Node directly
  on your machine. More setup, but handy if you already have these tools.

Pick one path and follow it top to bottom.

---

## What this project is

AI Playground is a full-stack demo of the **Laravel AI SDK** with a **React** frontend.
It exposes a token-authenticated REST API (Laravel Sanctum) covering chat, document
search (RAG with embeddings), image generation, audio transcription, summarization,
and a research agent.

**Stack:** Laravel 13 (PHP 8.3) · React 19 + Vite + TailwindCSS 4 · PostgreSQL 17
(pgvector) · Redis · Docker.

---

## Prerequisites

### Path A — Docker
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Git

### Path B — Native
- PHP **8.3+** with extensions: `pdo_pgsql`, `redis` (phpredis), `mbstring`, `openssl`, `fileinfo`
- [Composer](https://getcomposer.org/)
- Node.js **22+** and npm
- PostgreSQL **17** with the **pgvector** extension installed
- Redis
- Git

---

## 1. Get the code

```bash
git clone <your-repo-url> ai-playground
cd ai-playground
```

## 2. Create your environment file

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` and fill in at least one AI provider key. The app defaults to **Ollama**
(a local model runner) so it can work without any paid key, but to use OpenAI,
Anthropic, or Gemini set the matching key:

```env
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=...
# GEMINI_API_KEY=...
```

> Never commit your real `.env`. It is already listed in `.gitignore`.

### Using Ollama (no API key)
Install [Ollama](https://ollama.com/), pull a model, and keep the defaults:

```bash
ollama pull llama3.2
# .env already has:
# AI_DEFAULT_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
```

---

## Path A — Run with Docker

```bash
# 1. Build and start all services
docker compose up -d --build

# 2. Install PHP dependencies inside the app container
docker compose exec app composer install

# 3. Generate the application key
docker compose exec app php artisan key:generate

# 4. Run database migrations
docker compose exec app php artisan migrate --force

# 5. Build the frontend (the node service also does this on startup)
docker compose exec node sh -c "npm install && npm run build"
```

Open <http://localhost> in your browser. Nginx serves the app on port 80.

Useful commands:

```bash
docker compose logs -f app      # tail Laravel/PHP logs
docker compose ps               # see running services
docker compose down             # stop everything
docker compose down -v          # stop and delete the DB/Redis volumes (full reset)
```

Services started: `app` (PHP-FPM), `nginx` (:80), `postgres` (pgvector, :5432),
`redis` (:6379), `queue` (queue worker), `node` (frontend build).

---

## Path B — Run natively

### 1. Install dependencies

```bash
composer install
npm install
```

### 2. Generate the app key

```bash
php artisan key:generate
```

### 3. Set up PostgreSQL

Create the database and enable pgvector, then point `.env` at it:

```sql
CREATE DATABASE ai_playground;
\c ai_playground
CREATE EXTENSION IF NOT EXISTS vector;
```

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ai_playground
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

> **Prefer SQLite for a quick spin?** You can instead set `DB_CONNECTION=sqlite`,
> create an empty `database/database.sqlite` file, and skip PostgreSQL. Note that
> the document-search (vector) feature needs pgvector, so SQLite won't support RAG.

### 4. Make sure Redis is running

The default config uses Redis for cache, queue, and sessions:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

If you don't want to run Redis, switch these to file/database drivers in `.env`:

```env
CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=database
```

### 5. Migrate the database

```bash
php artisan migrate
```

### 6. Start everything

The `composer dev` script runs the PHP server, queue worker, log viewer, and Vite
together:

```bash
composer dev
```

Or run them in separate terminals:

```bash
php artisan serve                       # http://localhost:8000
php artisan queue:listen --tries=1      # background jobs
npm run dev                             # Vite dev server (hot reload)
```

Open <http://localhost:8000>.

---

## 3. Try the API

Register a user and call an endpoint:

```bash
# Register (returns a Bearer token)
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","email":"demo@example.com","password":"password","password_confirmation":"password"}'

# Use the token
curl -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello!"}'
```

Full endpoint list is in the main [README](README.md#api-documentation).

---

## Running tests

```bash
php artisan test
# or inside Docker:
docker compose exec app php artisan test
```

Tests mock AI responses, so no API keys or network calls are required.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `could not find driver (pgsql)` | Install/enable the `pdo_pgsql` PHP extension. |
| `Class "Redis" not found` | Install the phpredis extension, or switch cache/queue/session drivers to `database` in `.env`. |
| `vector` type errors on migrate | Enable pgvector: `CREATE EXTENSION vector;` in your database. |
| Frontend not updating | Run `npm run dev` (native) or rebuild the `node` service (Docker). |
| 419 / CSRF on API calls | Use the Bearer token from `/api/register` or `/api/login` in the `Authorization` header. |
| Port 80 already in use (Docker) | Stop the conflicting service or change the `nginx` port mapping in `docker-compose.yml`. |

---

## Before pushing to GitHub

- Confirm `.env` is **not** tracked (it's gitignored). Rotate any key that was ever
  committed or shared.
- `vendor/`, `node_modules/`, `public/build/`, logs, and the SQLite file are all
  ignored and should not be in your commits.

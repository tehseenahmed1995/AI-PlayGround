# AI Playground

A full-stack demo application showcasing all major features of the **Laravel AI SDK** with a **React** frontend, deployed via **Docker**.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  (Vite + TailwindCSS + React Query + React Router)      │
├─────────────────────────────────────────────────────────┤
│                     Nginx Reverse Proxy                  │
├─────────────────────────────────────────────────────────┤
│                   Laravel 13 API Backend                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Controllers│ │ Services │ │  Agents  │ │   DTOs    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Requests │ │Resources │ │  Models  │                │
│  └──────────┘ └──────────┘ └──────────┘                │
├──────────────────┬──────────────────────────────────────┤
│   PostgreSQL     │           Redis                      │
│   (pgvector)     │   (Cache + Queue + Sessions)         │
└──────────────────┴──────────────────────────────────────┘
```

## Features

| Module | AI SDK Feature | Endpoint |
|---|---|---|
| AI Chatbot | Text Generation + Streaming + Conversations | `POST /api/chat` |
| Document Search | Embeddings + Vector Search (RAG) | `POST /api/documents/search` |
| Image Generation | Image Generation | `POST /api/image/generate` |
| Audio Transcription | Speech-to-Text | `POST /api/audio/transcribe` |
| Summarizer | Agent Prompting | `POST /api/summarize` |
| Research Agent | Agent + Tools (WebSearch, WebFetch) | `POST /api/research` |

## Tech Stack

- **Backend:** Laravel 13, Laravel AI SDK, Sanctum
- **Frontend:** React 19, Vite, TailwindCSS 4, React Query, React Router
- **Database:** PostgreSQL 17 with pgvector
- **Cache/Queue:** Redis
- **Infrastructure:** Docker, Docker Compose, GitHub Actions CI/CD

## Local Development

Prerequisites: PHP 8.3+, Composer, Node.js 22+, and either Docker or a native
PostgreSQL (pgvector) + Redis setup.

Quick start with Docker:

```bash
git clone <your-repo-url> ai-playground
cd ai-playground
cp .env.example .env            # add at least one AI provider key
docker compose up -d --build
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --force
docker compose exec node sh -c "npm install && npm run build"
```

Then open <http://localhost>.

**Full instructions** — Docker and native paths, Ollama (no API key), troubleshooting —
are in **[RUNNING_LOCALLY.md](RUNNING_LOCALLY.md)**.

## Deployment

Three deployment paths are documented, each with a GitHub Actions CI/CD pipeline and
step-by-step command explanations:

| Path | Guide | Summary |
|---|---|---|
| **ECS on EC2 (free tier)** ⭐ active | **[DEPLOY_ECS_EC2.md](DEPLOY_ECS_EC2.md)** | Full production-shaped pipeline (ECR → ECS task revision → rolling deploy → rollback) on one free-tier `t3.micro`; RDS Postgres, Redis as a container. Workflow: `.github/workflows/deploy-ecs-ec2.yml`. |
| **AWS EC2 + Compose** | **[DEPLOY_EC2.md](DEPLOY_EC2.md)** | Simplest: one instance running the Docker Compose stack; CI deploys over SSH. Workflow: `.github/workflows/ci-cd.yml` (manual-only). |
| **AWS ECS + Fargate** | **[DEPLOY_ECS.md](DEPLOY_ECS.md)** | The Fargate version of the pipeline for when you scale (not free). Workflow: `.github/workflows/deploy-ecs.yml` (manual-only). |

> Only **one** deploy workflow is push-triggered at a time — currently
> `deploy-ecs-ec2.yml`. The others run only via manual dispatch, so a push to `main`
> triggers a single pipeline.

## API Documentation

All endpoints require `Authorization: Bearer <token>` except `/api/register` and `/api/login`.

### Authentication
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/register` | `{ name, email, password, password_confirmation }` |
| POST | `/api/login` | `{ email, password }` |
| POST | `/api/logout` | — |
| GET | `/api/user` | — |

### Chat
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/chat` | `{ message, conversation_id? }` |
| GET | `/api/chat/history` | — |
| DELETE | `/api/chat/{conversationId}` | — |

### Documents
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/documents` | `file` (multipart) |
| POST | `/api/documents/search` | `{ query, limit?, min_similarity? }` |
| GET | `/api/documents` | — |

### Image Generation
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/image/generate` | `{ prompt, size? }` |

### Audio Transcription
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/audio/transcribe` | `audio` (multipart) |

### Summarization
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/summarize` | `{ text }` |

### Research
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/research` | `{ question }` |

## Testing

```bash
# Run all tests
php artisan test

# Run specific test suite
php artisan test --filter=AuthTest
```

Tests mock AI responses using the SDK's built-in `fake()` methods.

## Project Structure

```
app/
├── Ai/
│   └── Agents/          # SupportAgent, SummarizerAgent, ResearchAgent
├── DTOs/                # Data Transfer Objects
├── Http/
│   ├── Controllers/API/ # API Controllers
│   ├── Requests/        # Form Request validation
│   └── Resources/       # API Resources
├── Models/              # Eloquent models
├── Providers/           # Service providers
└── Services/            # Business logic layer
```

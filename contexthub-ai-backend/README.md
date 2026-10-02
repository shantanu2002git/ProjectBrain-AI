# ContextHub AI Backend

Express.js and TypeScript API for the ContextHub AI MVP.

## Responsibilities

- Project creation and onboarding
- GitHub and Jira integration orchestration
- Repository parsing and artifact extraction
- Knowledge graph and embedding workflows
- Persona-aware AI chat and impact analysis
- Webhook entry points for incremental updates

## Getting Started

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The API runs on `http://localhost:4000` by default.

For local infrastructure, run:

```bash
docker compose up -d
```

This starts PostgreSQL with pgvector and Redis. The Prisma schema lives in `prisma/schema.prisma`.

## Embeddings

Set `OPENAI_API_KEY` and keep `OPENAI_EMBEDDING_MODEL=text-embedding-3-small` to generate 1536-dimension vectors during context builds.

After adding or changing the key, rebuild project context so existing chunks receive vectors.

If OpenAI returns `429 Too Many Requests`, the build keeps the text chunks and skips remaining vectors after retries. Lower `OPENAI_EMBEDDING_BATCH_SIZE` or retry later to populate vectors.

## Key Endpoints

- `GET /health`
- `GET /api/projects`
- `POST /api/projects`
- `POST /api/projects/:projectId/build-context`
- `POST /api/chat`
- `POST /api/impact-analysis`
- `POST /api/webhooks/github`
- `POST /api/webhooks/jira`

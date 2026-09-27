# PARVA (CODELESS)

**A Persian-first, multi-model AI chat platform.** PARVA brings AI conversations, model and provider management, and subscription features together in one web application.

The repository is a monorepo with independently managed frontend and backend applications. They communicate through a versioned REST API and Server-Sent Events (SSE) for streaming chat responses.

## Features

- Stream conversations with configurable AI models and providers that support the OpenAI API format.
- Continue conversations across sessions and switch models during a conversation.
- Manage users, models, providers, subscriptions, payments, and audit activity through an admin interface.
- Configure per-user preferences, quotas, and access to subscription plans.
- Use optional integrations for web search, file and avatar storage, and observability.
- Use the Persian-language interface, including right-to-left layout.

## Tech Stack

| Application | Technologies |
| --- | --- |
| Frontend | Vue 3, TypeScript, Vite, Pinia, Tailwind CSS |
| Backend | NestJS, TypeScript, TypeORM |
| Data and local services | PostgreSQL, Redis, MinIO |
| Chat streaming | Server-Sent Events (SSE) |

## Repository Layout

```text
backend/       NestJS API, database entities, migrations, and tests
frontend/      Vue application and frontend tests
docs/wiki/     Setup, architecture, API, and feature documentation
api-contract.yaml
               OpenAPI contract for the API
docker-compose.yml
               Local PostgreSQL, Redis, and MinIO services
```

## Quick Start

### Prerequisites

- Node.js 20 or later and npm 10 or later
- Docker with the Docker Compose plugin

### 1. Start local services

From the repository root:

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, and MinIO. The default PostgreSQL database is `chatbot`, with username and password `postgres`.

### 2. Configure the applications

Create local environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

In `backend/.env`, make the `DB_*` values match the local Compose database (`localhost`, port `5432`, user/password `postgres`, database `chatbot`) and replace `JWT_SECRET` with a local secret. Keep real credentials out of version control. AI provider credentials can be configured through the admin interface; without a provider configured, the backend uses its local offline response.

### 3. Run the backend

In a terminal:

```bash
cd backend
npm ci
npm run start:dev
```

The API is available at `http://localhost:3000/api/v1` by default.

### 4. Run the frontend

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The Vite development server prints its local URL when it starts. The default API URL is `http://localhost:3000/api/v1`; configure it with `VITE_API_BASE_URL` in `frontend/.env` if needed.

For admin setup, migrations, optional integrations, and additional configuration, see the [Getting Started guide](docs/wiki/getting-started.md).

## Development Checks

Run the test suites from their respective application directories:

```bash
cd backend && npm test
cd frontend && npm test
```

Build the applications with `npm run build` from either `backend/` or `frontend/`.

## Documentation

- [Getting Started](docs/wiki/getting-started.md)
- [Architecture Overview](docs/wiki/architecture.md)
- [API Reference](docs/wiki/api-reference.md)
- [Feature History](docs/wiki/features.md)
- [OpenAPI Contract](api-contract.yaml)
- [Interactive Architecture Diagram](docs/architecture.html)

## Contributing

Bug reports and pull requests are welcome. Please include the affected application, steps to reproduce, and relevant test results when reporting an issue or proposing a change.

## License

No license has been specified yet. Please contact the project maintainers before reusing or distributing this software.
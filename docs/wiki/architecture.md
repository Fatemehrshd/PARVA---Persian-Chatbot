# Architecture Overview

## Monorepo Layout
- `frontend/`: Vue 3 + Vite + TypeScript application with Vue Router 4 and Pinia.
- `backend/`: NestJS + Express + TypeScript application.
- Each service maintains its own dependencies, `package.json`, and `.env` configuration.

## Environment Variables
- **Frontend**: Vite-based variables prefixed with `VITE_` (e.g. `VITE_API_BASE_URL`). Types declared in `src/env.d.ts`.
- **Backend**: Loaded via `dotenv` from `.env` (e.g. `PORT`, `FRONTEND_URL`). CORS is configured in `main.ts` to allow requests from `FRONTEND_URL`.

# Architectural Decisions

## ADR-001: Independent Vue 3 + Vite Frontend & NestJS Backend
- **Status**: Accepted
- **Context**: Project initialization requiring Vue 3 + Vite on the frontend and NestJS on the backend.
- **Decision**:
  - Independent `frontend/` and `backend/` folders, each with dedicated `package.json`, TypeScript configuration, and dependency management.
  - TypeScript used across both frontend and backend.
  - Environment variables defined in `.env` with `.env.example` templates provided.
  - CORS configured on the backend dynamically referencing `FRONTEND_URL`.

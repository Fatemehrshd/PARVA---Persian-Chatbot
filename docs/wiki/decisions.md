# Architectural Decisions

## ADR-001: Independent Vue 3 + Vite Frontend & NestJS Backend
- **Status**: Accepted
- **Context**: Project initialization requiring Vue 3 + Vite on the frontend and NestJS on the backend.
- **Decision**:
  - Independent `frontend/` and `backend/` folders, each with dedicated `package.json`, TypeScript configuration, and dependency management.
  - TypeScript used across both frontend and backend.
  - Environment variables defined in `.env` with `.env.example` templates provided.
  - CORS configured on the backend dynamically referencing `FRONTEND_URL`.

## ADR-002: Standardized API Response Envelope `{ success, message, data }`
- **Status**: Accepted
- **Context**: The API contract originally returned raw entity objects directly (e.g. `User`, `Conversation`, `Model[]`). To establish uniform client-side parsing, error feedback, and predictable metadata, all responses need a consistent wrapper.
- **Decision**:
  - All JSON responses defined in `api-contract.yaml` now wrap payloads in `{ success: boolean, message: string, data: any }`.
  - On the backend, a global `ResponseEnvelopeInterceptor` intercepts responses and wraps them in `{ success: true, message: 'Operation successful', data: ... }`.
  - The interceptor explicitly skips Server-Sent Events (SSE `text/event-stream`) used for real-time chat streaming to prevent breaking event chunking.
  - `HttpExceptionFilter` formats all exceptions as `{ success: false, message: '...', data: null, statusCode, error }`.
  - On the frontend, `request<T>()` in `api.ts` transparently unwraps `data` when present, ensuring caller code (stores, views) remains clean and decoupled from transport metadata.

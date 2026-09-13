# Architectural Decisions

## ADR-001: Independent Vue 3 + Vite Frontend & NestJS Backend
- **Status**: Accepted
- **Context**: Project initialization requiring Vue 3 + Vite on the frontend and NestJS on the backend.
- **Decision**:
  - Independent `frontend/` and `backend/` folders, each with dedicated `package.json`, TypeScript configuration, and dependency management.
  - TypeScript used across both frontend and backend.
  - Environment variables defined in `.env` with `.env.example` templates provided.
  - CORS configured on the backend dynamically referencing `FRONTEND_URL`.

## ADR-002: No API versioning prefix; single contract-shaped error envelope
- **Status**: Accepted
- **Context**: Day-1-2 MVP must match `api-contract.yaml`. The contract places every endpoint at a natural path (`/auth/signup`, `/chat/conversations/...`, `/admin/models/...`) with no `/api/v1` versioning prefix. The contract also defines a single `Error` schema (`{statusCode, message, error}`), but NestJS's default exception responses do not include the `error` field, and earlier iterations of the controllers had hardcoded `api/v1/...` paths that would drift away from the contract as new modules were added.
- **Decision**:
  - **No `/api/v1` prefix.** Routes are exposed at their natural paths. `main.ts` does NOT call `setGlobalPrefix('api/v1')`. Each controller specifies only its relative path (`@Controller('auth')`, etc.).
  - **Contract-shaped error envelope.** A single global `HttpExceptionFilter` (in `src/shared/`) formats every error response as `{statusCode, message, error}`. This is the only place error formatting lives — controllers, guards, and services throw `HttpException` subclasses and rely on the filter to produce the wire format.
- **Consequences**:
  - Adding a new controller is one `@Controller('whatever')` decorator — no prefix to remember, no error formatting to copy.
  - An e2e test (`backend/test/error-format.spec.ts`) verifies the envelope stays aligned with the contract.
  - The OpenAPI `servers[].url` no longer ends with `/api/v1`.

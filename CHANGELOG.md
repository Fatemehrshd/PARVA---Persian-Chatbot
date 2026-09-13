# Changelog

All notable changes to this project are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/) once we start tagging releases.

## [Unreleased]

### Added
- **Backend MVP (NestJS + TypeORM + PostgreSQL).** Every endpoint defined in [`api-contract.yaml`](./api-contract.yaml):
  - `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`
  - `GET /chat/conversations`, `POST /chat/conversations`
  - `GET /chat/conversations/{id}/messages`, `POST /chat/conversations/{id}/messages` (Server-Sent Events streaming + JSON fallback)
  - `GET /admin/models`, `POST /admin/models`, `DELETE /admin/models/{id}`, `PATCH /admin/models/{id}/default`
- Contract-shaped global error envelope `{statusCode, message, error}` via `HttpExceptionFilter`.
- `JwtAuthGuard` + `AdminGuard` enforce the bearer security and admin role defined in the contract.
- Idempotent admin bootstrap CLI: `npm run seed:admin` (reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- Streaming chat response: `event: token` per chunk + `event: done` with the saved message id.

### Changed
- `@nestjs/jwt` downgraded from `^12.0.1` to `^10.2.0` — v12 is ESM-only and broke Jest under CommonJS; v10.2.x is CJS and stays within the `@nestjs/common@^10` compatibility window.
- `tsconfig.json`: `esModuleInterop` enabled so `bcryptjs` (ESM) imports correctly via `import bcrypt from 'bcryptjs'`.
- `api-contract.yaml` `servers[].url` no longer includes the `/api/v1` prefix; controllers dropped the hardcoded `api/v1/` segment.

### Security
- `/auth/logout` now requires a valid bearer token (was previously callable without auth). The refresh token in the body is no longer trusted for revocation.

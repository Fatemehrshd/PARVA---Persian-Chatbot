# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-09-14

### Changed (Architectural Breaking Change)
- **Standardized API Response Envelope**: Updated `api-contract.yaml` and the NestJS backend to return all HTTP JSON responses within a standardized contract envelope:
  ```json
  {
    "success": true,
    "message": "Operation successful",
    "data": { ... }
  }
  ```
  And for error responses:
  ```json
  {
    "success": false,
    "message": "Error description",
    "data": null,
    "statusCode": 400,
    "error": "Bad Request"
  }
  ```
- **Backend Response Transformation**: Implemented `ResponseEnvelopeInterceptor` globally in NestJS to wrap controller returns into `{ success, message, data }` while bypassing SSE streaming (`text/event-stream`) and 204 No Content responses.
- **Backend Error Handling**: Updated `HttpExceptionFilter` to format exceptions with `success: false` and `data: null` alongside HTTP status codes and error messages.
- **Frontend Base Client**: Enhanced `request<T>` in `frontend/src/services/api.ts` to unwrap the `data` payload when an enveloped response is received, providing transparent backward and forward compatibility without requiring changes in Pinia stores or Vue views.

---

## [0.1.0] - 2026-09-14

### Added
- Multi-tier API connection connecting Vue 3 frontend to NestJS backend.
- Dedicated domain services (`authService`, `chatService`, `modelsService`).
- Server-Sent Events (SSE) streaming consumer for chat message generation.
- Admin dashboard for AI model management.
- Dual-column responsive authentication page.
- Onboarding documentation and wiki under `docs/wiki/` and `docs/frontend/`.

# Architecture Overview

## Monorepo Layout
- `frontend/`: Vue 3 + Vite + TypeScript application with Vue Router 4 and Pinia.
- `backend/`: NestJS + Express + TypeScript application.
- Each service maintains its own dependencies, `package.json`, and `.env` configuration.

## Environment Variables
- **Frontend**: Vite-based variables prefixed with `VITE_` (e.g. `VITE_API_BASE_URL`). Types declared in `src/env.d.ts`.
- **Backend**: Loaded via `dotenv` from `.env` (e.g. `PORT`, `FRONTEND_URL`). CORS is configured in `main.ts` to allow requests from `FRONTEND_URL`.
- **AI credentials**: provider API keys live in the DATABASE (`ai_providers.apiKey`, managed via `/admin/providers`, masked on read). `OPENAI_API_KEY` / `OPENAI_BASE_URL` in env are only an optional global fallback for providers/models without stored credentials; with no key anywhere chat answers with the offline echo (WARN in logs).

## Backend Modules

```
backend/src/
├── main.ts                        ← bootstrap: envelope interceptor + error filter + validation pipe
├── app.module.ts                  ← TypeORM wiring (User, Conversation, Message, AiModel, AiProvider)
├── shared/                        ← JwtAuthGuard, AdminGuard, HttpExceptionFilter, ResponseEnvelopeInterceptor
└── modules/
    ├── auth/ users/               ← signup/login/logout, User entity
    ├── chat/                      ← Conversation, Message, ChatService.generate (streaming),
    │                                 ChatController (SSE + JSON), OpenAiCompatController (/v1/*, JWT-protected)
    ├── ai/                        ← OpenAiCompatForwarder: credential resolution + SSE parsing via global fetch
    └── models-admin/              ← AiModel + AiProvider entities, ModelsAdminService,
                                      ProvidersAdminService (CRUD/status/default/cascade), admin controllers,
                                      and the public ModelsController (GET /models, active only)
```

### Chat resolution chain
`conversation.modelId → platform default` (400 if the resolved model is inactive or its provider is inactive) → credential chain `model.apiKey → provider.apiKey → env` → real OpenAI-compatible streaming; echo fallback only when nothing is configured. Mid-conversation switching: `PATCH /chat/conversations/:id { modelId }`.

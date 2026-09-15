# Getting Started

## Prerequisites
- Node.js (v20+ recommended, v22 tested)
- npm (v10+ recommended)

## Installation & Setup

### 1. Frontend Setup
Navigate to the `frontend/` directory:
```bash
cd frontend
npm install
```

Configure `.env`:
Copy `.env.example` to `.env`:
```env
VITE_APP_TITLE=Codeless App
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Run in development mode:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

---

### 2. Backend Setup
Navigate to the `backend/` directory:
```bash
cd backend
npm install
```

Configure `.env`:
Copy `.env.example` to `.env`:
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
# DB_* + JWT_SECRET + ADMIN_EMAIL/ADMIN_PASSWORD also live here (see .env.example)
# Optional GLOBAL fallback for AI credentials (real keys are stored per-provider in the DB):
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
```

Run in development mode:
```bash
npm run start:dev
```

### Chatting with real AI models
1. Seed the first admin (`npm run seed:admin`), then register providers and models via the admin API (the frontend `/admin/models` panel uses the same endpoints):
   ```bash
   # create a provider with its real API key (stored in DB, masked on read)
   curl -X POST http://localhost:3000/admin/providers \
     -H "Authorization: Bearer <admin-token>" -H 'Content-Type: application/json' \
     -d '{"name":"openai","baseUrl":"https://api.openai.com/v1","apiKey":"sk-real-key"}'

   # add a model under it (providerId optional; free-text provider still accepted)
   curl -X POST http://localhost:3000/admin/models \
     -H "Authorization: Bearer <admin-token>" -H 'Content-Type: application/json' \
     -d '{"name":"GPT-4o","provider":"openai","apiIdentifier":"gpt-4o"}'

   # make it the platform default + each provider's own default
   curl -X PATCH http://localhost:3000/admin/models/<model-id>/default -H "Authorization: Bearer <admin-token>"
   curl -X PATCH http://localhost:3000/admin/providers/<provider-id>/default \
     -H "Authorization: Bearer <admin-token>" -H 'Content-Type: application/json' -d '{"modelId":"<model-id>"}'
   ```
2. Upgrade an existing database: `npm run seed:providers` backfills provider rows from the legacy free-text `provider` labels (idempotent).
3. With at least one real key configured, chat hits the actual upstream (`stream:true`, token-by-token SSE). If NOTHING is configured the server logs a WARN and answers with the offline echo so local dev still works — provider errors are never silently echoed anymore.
4. `/v1/models` and `/v1/chat/completions` (OpenAI-compatible facade) require a bearer token and forward to real models.

### Avatars (MinIO)
Avatar upload needs a reachable MinIO (or S3-compatible) server:
```env
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=codeless
PUBLIC_BASE_URL=http://localhost:3000   # used to build avatarUrl
```
Without these, `POST /users/me/avatar` honestly returns **503** (there is no disk fallback). Uploads accept png/jpeg/webp up to 2 MB; replaced/deleted avatars are removed from the bucket; files are served at `/static/avatars/{userId}/{file}`.

### Database schema changes
Dev mode (`DB_SYNC=true`) auto-applies new columns. For production/managed DBs use the migration:
```bash
cd backend
npm run migration:run       # or: migration:generate / migration:revert (uses src/data-source.ts)
```

Run backend tests:
```bash
cd backend && npm test   # 95 tests, no DB/MinIO required (fakes at service boundaries)
```

Build for production:
```bash
npm run build
```

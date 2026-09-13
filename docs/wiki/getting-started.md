# Getting Started

## Prerequisites
- Node.js (v20+ recommended, v22 tested)
- npm (v10+ recommended)
- PostgreSQL 14+ (running locally; no Docker required)

## Installation & Setup

### 1. PostgreSQL

Install PostgreSQL locally for your platform (e.g. via `brew install postgresql@16` on macOS, or your distro's package manager). Make sure:
- the server is running on `localhost:5432` (or update `DB_HOST` / `DB_PORT` in `.env`)
- a database named `codeless` exists (`createdb codeless`)
- the user in `.env` has access to it

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env       # then edit DB_* and JWT_SECRET to match your environment
npm run start:dev          # backend on http://localhost:3000
```

The first time the app starts with `DB_SYNC=true` (default), TypeORM auto-creates the tables.

### 3. Seed the first admin
The `/admin/models` endpoints require an admin user. There is no API to create one — use the seed CLI:
```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=choose-a-strong-one npm run seed:admin
```
The script is idempotent; re-running it will not duplicate or overwrite an existing admin.

### 4. Run tests
```bash
cd backend
npm test
```
Jest runs every spec under `test/` against the compiled TS sources via `ts-jest`. The suite covers the contract error envelope, signup/login duplicate handling, authenticated logout, and service-level chat + admin models behavior.

### 5. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env       # set VITE_API_BASE_URL=http://localhost:3000
npm run dev                # Vite dev server on http://localhost:5173
```

### 6. Verify the backend is up
```bash
curl http://localhost:3000
# -> "Hello from NestJS backend!"

# Try the contract error envelope directly:
curl -i -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{}'
# -> 400, { "statusCode": 400, "message": [...], "error": "Bad Request" }
```

## Build for production
```bash
# backend
cd backend
npm run build && npm run start:prod

# frontend
cd frontend
npm run build
```

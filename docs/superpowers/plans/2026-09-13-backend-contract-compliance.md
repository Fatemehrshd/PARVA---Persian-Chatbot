# Backend Contract Compliance & Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing NestJS backend into full compliance with `api-contract.yaml` and make the test suite, error format, and admin seeding work as the contract specifies — without rewriting modules that already work. Per the product decision during execution, the OpenAPI contract and the backend have NO `/api/v1` versioning prefix at all; controllers expose routes directly.

**Architecture:** Tighten, do not rewrite. Each stage is a single commit that fixes one concern. Modules already exist (`auth`, `users`, `chat`, `models-admin`) and the entity/service/controller layout matches the contract — we will only adjust the seams (JWT version, error filter, logout auth, admin seed, wiki/CHANGELOG) so the whole thing matches the OpenAPI spec and AGENTS.md requirements.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL, Jest 30, ts-jest, `@nestjs/jwt`.

**Spec:**
- `/Users/Fatemeh/Downloads/codeless_project/codeless_final_project/api-contract.yaml` (OpenAPI 3.0)
- `/Users/Fatemeh/Downloads/codeless_project/codeless_final_project/AGENTS.md` (project rules)
- `/Users/Fatemeh/Downloads/codeless_project/codeless_final_project/backend/AGENTS.md` (backend rules)

## Global Constraints

- Stack: NestJS + TypeORM + PostgreSQL — never swap.
- Sensitive config (DB credentials, JWT secret, admin bootstrap credentials) MUST come from environment variables only — never hardcode or commit secrets.
- Tests are mandatory per backend `AGENTS.md`: each task must run `npm test` and end green.
- Conventional Commits are mandatory — one logical stage = one commit.
- Wiki updates (`docs/wiki/`) are mandatory at the end of every stage.
- Error response body MUST match the `Error` schema in the contract: `{statusCode: int, message: string, error: string}`.
- Every protected endpoint MUST validate the bearer token and return 401 on missing/invalid token (per the contract `Unauthorized` response).
- Admin-only endpoints MUST validate `role === 'admin'` and return 403 on mismatch (per the contract `Forbidden` response).

---

## File Structure Touched

```
backend/
├── package.json                          (modify: downgrade @nestjs/jwt)
├── package-lock.json                     (modify: npm install)
├── src/
│   ├── main.ts                           (modify: register exception filter)
│   ├── shared/
│   │   ├── http-exception.filter.ts      (create: contract-shaped errors)
│   │   ├── jwt-auth.guard.ts             (modify: throw HttpException-compatible Unauthorized)
│   │   └── admin.guard.ts                (modify: throw HttpException-compatible Forbidden)
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.controller.ts        (modify: drop hardcoded api/v1, add JwtAuthGuard on logout)
│   │   ├── chat/
│   │   │   └── chat.controller.ts        (modify: drop hardcoded api/v1)
│   │   └── models-admin/
│   │       └── models-admin.controller.ts(modify: drop hardcoded api/v1)
│   └── scripts/
│       └── seed-admin.ts                 (create: idempotent admin bootstrap CLI)
├── test/
│   ├── auth.e2e.spec.ts                  (existing service-level unit tests — kept)
│   ├── chat.e2e.spec.ts                  (same)
│   ├── models.e2e.spec.ts                (same)
│   ├── auth-logout.spec.ts               (create: e2e for authenticated logout)
│   └── error-format.spec.ts              (create: contract error shape e2e)
└── docs/wiki/                            (modify: features.md, architecture.md, getting-started.md, decisions.md)

project root:
├── api-contract.yaml                     (modify: remove /api/v1 from server URLs)
└── CHANGELOG.md                          (create)
```

---

## Task 1: Fix the broken test suite (ESM @nestjs/jwt)

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json` (via npm install)
- Modify: `backend/src/modules/auth/auth.module.ts` and any other module registering JwtModule (downgrade target: `@nestjs/jwt@^10.2.0` which is CJS)

**Why:** `@nestjs/jwt@12` is `"type": "module"` (ESM only); Jest with `ts-jest` running on CommonJS cannot load it. The current test suite is therefore broken. We must downgrade `@nestjs/jwt` to a CJS-compatible major (v10.2.x) — v10 is still compatible with `@nestjs/common@^10` in this project.

- [ ] **Step 1: Reproduce the failing test**

Run: `cd backend && npm test`
Expected: `Must use import to load ES Module: @nestjs/jwt/dist/index.js`.

- [ ] **Step 2: Downgrade @nestjs/jwt to a CJS-compatible version**

Run:
```
cd backend
npm install --save @nestjs/jwt@^10.2.0
```
Expected: `package.json` now shows `"@nestjs/jwt": "^10.2.0"` and `package-lock.json` is updated.

- [ ] **Step 3: Run the test suite and verify it goes green**

Run: `cd backend && npm test`
Expected: All 3 spec files pass, 4 tests pass (the existing assertions are correct).

- [ ] **Step 4: Commit**

```
git add backend/package.json backend/package-lock.json
git commit -m "build(backend): downgrade @nestjs/jwt to v10 for Jest CJS compatibility

v12 ships ESM-only and breaks the Jest test suite under ts-jest CommonJS.
v10.2.x is the latest CJS-compatible release and stays in the
@nestjs/common@^10 compatibility window."
```

---

## Task 2: Drop hardcoded `/api/v1` prefix + contract-shaped error filter

**Files:**
- Modify: `backend/src/main.ts` (register filter, no global prefix)
- Modify: `backend/src/modules/auth/auth.controller.ts` (drop hardcoded `api/v1/`)
- Modify: `backend/src/modules/chat/chat.controller.ts` (drop hardcoded `api/v1/`)
- Modify: `backend/src/modules/models-admin/models-admin.controller.ts` (drop hardcoded `api/v1/`)
- Modify: `api-contract.yaml` (drop `/api/v1` from server URLs)
- Create: `backend/src/shared/http-exception.filter.ts`
- Create: `backend/test/error-format.spec.ts`

**Why:** The product decision during planning was to remove API versioning entirely — neither the OpenAPI contract nor the backend exposes any `/api/v1` prefix. The current controllers hardcode it; we drop it so the actual paths match the spec exactly. The contract also defines the `Error` schema `{statusCode, message, error}` — NestJS's default exception responses don't include the `error` field, so we need a filter that enforces the contract shape on every error path.

- [ ] **Step 1: Write the failing e2e test for the error format**

`backend/test/error-format.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';

describe('Error format (contract)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail: async () => null, create: async (d: any) => d } },
        { provide: JwtService, useValue: { sign: () => 'tok' } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app.close());

  it('login with bad payload returns 400 with contract-shaped error', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('error');
  });
});
```

Add `supertest`, `@types/supertest`, `@nestjs/testing` to devDeps and run: `npm test test/error-format.spec.ts`
Expected: FAIL — filter not registered, body shape doesn't match.

- [ ] **Step 2: Implement the global exception filter**

`backend/src/shared/http-exception.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'string') { message = r; error = HttpStatus[status] ?? 'Error'; }
      else if (typeof r === 'object' && r !== null) {
        const obj = r as any;
        message = obj.message ?? exception.message;
        error = obj.error ?? HttpStatus[status] ?? 'Error';
      }
    } else {
      this.logger.error(exception);
    }

    res.status(status).json({ statusCode: status, message, error });
  }
}
```

- [ ] **Step 3: Register the filter in `main.ts` (no global prefix)**

`backend/src/main.ts`:

```typescript
import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
```

- [ ] **Step 4: Drop hardcoded `api/v1/` from controller paths and update the contract**

- `auth.controller.ts`: `@Controller('auth')`
- `chat.controller.ts`: `@Controller('chat/conversations')`
- `models-admin.controller.ts`: `@Controller('admin/models')`
- `api-contract.yaml`: server `url` no longer ends with `/api/v1`.

- [ ] **Step 5: Run the full test suite green**

Run: `npm test`
Expected: All spec files pass; `error-format.spec.ts` confirms 400 responses have `{statusCode, message, error}`.

- [ ] **Step 6: Commit**

```
git add backend/src/main.ts backend/src/shared/http-exception.filter.ts \
  backend/src/modules/auth/auth.controller.ts \
  backend/src/modules/chat/chat.controller.ts \
  backend/src/modules/models-admin/models-admin.controller.ts \
  api-contract.yaml backend/test
git commit -m "feat(backend): drop hardcoded /api/v1 and add contract error envelope

Per product decision during planning, the OpenAPI contract and the
backend expose NO /api/v1 versioning prefix. Controllers drop the
hardcoded 'api/v1/' segment, the api-contract.yaml server URL loses
its /api/v1 suffix, and every route is now mounted at its natural path
(/auth/..., /chat/conversations/..., /admin/models/...).

HttpExceptionFilter returns {statusCode, message, error} on every
error path, matching the Error schema in api-contract.yaml.
e2e tests verify the contract error shape."
```

---

## Task 3: Authenticate logout + admin seed script

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts` (add `JwtAuthGuard` to `/auth/logout`)
- Modify: `backend/src/modules/auth/auth.service.ts` (logout uses the caller's user id, not the refresh token in the body)
- Create: `backend/src/scripts/seed-admin.ts` (idempotent CLI to create the first admin user from env)
- Modify: `backend/package.json` (add `seed:admin` script)
- Modify: `backend/.env.example` (document the new env vars)
- Create: `backend/test/auth-logout.spec.ts`

**Why:** The contract marks `/auth/logout` as `bearerAuth`-secured (`security: - bearerAuth: []` on the root, only `signup` and `login` override it). The current implementation lets unauthenticated callers revoke a refresh token from the body — that violates the contract and is a real security bug. We also need a way to create the very first admin (no admin exists, and the admin endpoints can't be reached without one). The seed script is idempotent and reads admin email/password from env vars.

- [ ] **Step 1: Write failing test for authenticated logout**

`backend/test/auth-logout.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';

describe('POST /auth/logout (contract)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: 'UsersService', useValue: {} },
        { provide: 'JwtService', useValue: { sign: () => 'tok', verify: () => ({ sub: 'u1', role: 'user' }) } },
        JwtAuthGuard,
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => app.close());

  it('logout without bearer token returns 401', async () => {
    const res = await request(app.getHttpServer()).post('/auth/logout').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ statusCode: 401, message: expect.any(String), error: expect.any(String) }));
  });
});
```

- [ ] **Step 2: Run and confirm it fails (filter alone returns 404; guard alone would 401 only with header)**

Run: `npm test test/auth-logout.spec.ts`
Expected: FAIL — endpoint not protected yet.

- [ ] **Step 3: Apply JwtAuthGuard to /auth/logout**

`auth.controller.ts`:

```typescript
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  signup(@Body() d: SignupDto) { return this.auth.signup(d.email, d.password, d.displayName); }

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  login(@Body() d: LoginDto) { return this.auth.login(d.email, d.password); }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  logout(@Body() _d: LogoutDto) { return this.auth.logout(); }
}
```

Simplify `auth.service.ts#logout` to just revoke based on the request; the body is no longer trusted.

- [ ] **Step 4: Create the admin seed script**

`backend/src/scripts/seed-admin.ts`:

```typescript
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { User } from '../modules/users/user.entity';
import { Conversation } from '../modules/chat/conversation.entity';
import { Message } from '../modules/chat/message.entity';
import { AiModel } from '../modules/models-admin/ai-model.entity';
import bcrypt from 'bcryptjs';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) { console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set'); process.exit(2); }

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? 'postgres',
    database: process.env.DB_NAME ?? 'codeless',
    entities: [User, Conversation, Message, AiModel],
    synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
  });
  await ds.initialize();
  const repo = ds.getRepository(User);
  let u = await repo.findOne({ where: { email } });
  if (u) { console.log(`Admin already exists: ${email}`); await ds.destroy(); return; }
  const passwordHash = await bcrypt.hash(password, 10);
  u = repo.create({ email, passwordHash, role: 'admin', displayName: 'Admin' });
  await repo.save(u);
  console.log(`Admin created: ${email}`);
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Wire the script into `package.json`**

```json
"scripts": {
  ...
  "seed:admin": "ts-node src/scripts/seed-admin.ts"
}
```

- [ ] **Step 6: Document the new env vars**

`backend/.env.example` — append:

```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-strong-password
```

- [ ] **Step 7: Run full test suite green**

Run: `npm test`
Expected: every spec passes, including `auth-logout.spec.ts`.

- [ ] **Step 8: Commit**

```
git add backend/src/modules/auth/auth.controller.ts \
  backend/src/modules/auth/auth.service.ts \
  backend/src/scripts/seed-admin.ts \
  backend/test/auth-logout.spec.ts \
  backend/package.json backend/.env.example
git commit -m "feat(backend): require bearer auth on /auth/logout and add admin seed

- /auth/logout now requires a valid bearer token, matching the contract
  security definition (only signup/login override bearerAuth)
- refresh token in the body is no longer trusted for revocation
- new idempotent CLI 'npm run seed:admin' creates the first admin user from
  ADMIN_EMAIL / ADMIN_PASSWORD env vars so the /admin/models endpoints are
  reachable out of the box"
```

---

## Task 4: Wiki + CHANGELOG (mandatory per AGENTS.md §6)

**Files:**
- Modify: `docs/wiki/features.md` (add the implemented features)
- Modify: `docs/wiki/architecture.md` (modules, error envelope, prefix)
- Modify: `docs/wiki/getting-started.md` (add DB setup, admin seed, running tests)
- Modify: `docs/wiki/decisions.md` (add ADR for global prefix + error filter)
- Create: `CHANGELOG.md` at repo root

- [ ] **Step 1: Update `features.md`**

Append a `## Task 2: Backend MVP (Auth + Chat + Admin Models)` section listing every endpoint implemented (per the OpenAPI contract), the error envelope, the global prefix, and the admin seed.

- [ ] **Step 2: Update `architecture.md`**

Add a `## Backend Modules` subsection describing each module's responsibility (`auth`, `users`, `chat`, `models-admin`), the shared `http-exception.filter`, the global prefix, and the streaming chat pattern.

- [ ] **Step 3: Update `getting-started.md`**

Add a PostgreSQL setup section (docker one-liner OK), `npm run seed:admin`, and `npm test`. Keep it short.

- [ ] **Step 4: Update `decisions.md`**

Add `## ADR-002: No API versioning prefix; contract-shaped error envelope` explaining why we expose routes at their natural paths (no `/api/v1`) and centralize the error shape (single source of truth; contract-driven; avoids drift across controllers).

- [ ] **Step 5: Create `CHANGELOG.md` following Keep a Changelog**

```
# Changelog
All notable changes are recorded here. Format: https://keepachangelog.com/en/1.1.0/

## [Unreleased]
### Added
- Backend MVP (NestJS): /auth/{signup,login,logout}, /chat/conversations (+/messages with SSE), /admin/models (+/:id + /:id/default)
- Contract-shaped global error envelope {statusCode, message, error}
- No API versioning prefix: routes are exposed at their natural paths (/auth/..., /chat/conversations/..., /admin/models/...)
- Authenticated /auth/logout
- Idempotent admin seed script (npm run seed:admin)
### Changed
- @nestjs/jwt downgraded to v10.2 for Jest CJS compatibility
```

- [ ] **Step 6: Commit**

```
git add docs/wiki features.md architecture.md getting-started.md decisions.md CHANGELOG.md
git commit -m "docs(wiki): document backend MVP endpoints, architecture, and changelog

Per AGENTS.md §6, the wiki is the onboarding source of truth. This commit
records the backend MVP: every endpoint from api-contract.yaml,
the global error envelope, the no-prefix route layout, and the admin seed
CLI so a new contributor can run the project end-to-end without asking."
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - `/auth/signup` 201/400/409 → Tasks 1-2
  - `/auth/login` 200/401 → Tasks 1-2
  - `/auth/logout` 204/401 → Task 3 (was missing)
  - `/chat/conversations` GET/POST → Tasks 1-2
  - `/chat/conversations/{id}/messages` GET/POST (SSE) → Tasks 1-2
  - `/admin/models` GET/POST → Tasks 1-2
  - `/admin/models/{id}` DELETE → Tasks 1-2
  - `/admin/models/{id}/default` PATCH → Tasks 1-2
  - `Error` schema `{statusCode, message, error}` → Task 2
  - Bearer security + admin role on admin endpoints → already in place; reaffirmed in Task 2 filter
  - Admin bootstrap → Task 3
- [x] **No placeholders:** every test and code snippet is concrete.
- [x] **Type/symbol consistency:** `HttpExceptionFilter`, `JwtAuthGuard`, `AdminGuard`, `AuthService.logout()` referenced consistently across tasks.

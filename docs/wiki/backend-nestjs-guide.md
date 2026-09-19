# NestJS Backend Guide — Principles, Patterns & Decisions

> Backend-focused onboarding through the lens of **NestJS framework principles**: how this project applies (and deliberately bends) them.
> Companion docs: [Onboarding Guide](./onboarding-guide.md) · [Architecture](./architecture.md) · [Decisions (ADRs)](./decisions.md)

---

## 1. How NestJS is applied here — the mental model

The backend is a classic **NestJS modular monolith**: one deployable service (`backend/`), one feature folder per business capability, dependency wiring done exclusively through the framework's DI container.

```
src/
├── main.ts                 ← bootstrap (create, prefix, pipes, filters, interceptors, CORS)
├── app.module.ts           ← root module: TypeOrmModule.forRoot + feature modules + APP_INTERCEPTOR
├── data-source.ts          ← standalone DataSource for the TypeORM CLI (migrations only)
├── modules/                ← FEATURE MODULES (the unit of work)
│   ├── auth/  users/  chat/  models-admin/  admin/  files/  storage/
│   ├── web-search/  subscriptions/  payments/  audit/
└── shared/                 ← cross-cutting building blocks (guards, interceptors, filter, decorator)
```

**Framework rules this project follows:**
- Each feature module is **self-contained** (controller + service + entity + dto in one folder) — adding a feature means adding a module, not editing neighbors. This is the codified "Golden Rule" (new features must not break old ones).
- Cross-cutting concerns (auth, admin authorization, response shaping, error formatting, quota stamping) live in **`shared/`** as guards/interceptors/filters/decorators — never duplicated inside services.
- All user-facing error messages are **Persian**, centralized in `shared/messages.fa.ts`.

---

## 2. Module system

### 2.1 Feature modules

Every module follows the same anatomy. Example — `modules/auth/auth.module.ts`:

```ts
@Module({
  imports: [forwardRef(() => UsersModule), JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret', signOptions: {} })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AdminGuard],
  exports: [JwtAuthGuard, AdminGuard, JwtModule],
})
```

| Module | Imports worth knowing | Exports |
|---|---|---|
| `AuthModule` | `forwardRef(() => UsersModule)`, `JwtModule` | `JwtAuthGuard`, `AdminGuard`, `JwtModule` |
| `UsersModule` | `TypeOrmModule.forFeature([User])`, `forwardRef(() => ChatModule)` | `UsersService` |
| `ChatModule` | users + models-admin + admin (settings) + ai + web-search, `forFeature([Conversation, Message, ChatShare])` | `ChatService`, `ActiveStreamService` |
| `AdminModule` | entities for dashboard queries, `UsersModule` | `SettingsService` |
| `PaymentsModule` / `SubscriptionsModule` | plan/payment entities, gateway providers | services + admin controllers |
| `AuditModule` | `forFeature([AuditLog])` | `AuditService` |

### 2.2 Circular dependencies — `forwardRef`

`auth ↔ users ↔ chat` form a genuine domain cycle (auth needs users to authenticate; chat needs users for ownership and settings for quotas; users' quota accounting needs chat services). NestJS resolves this with **`forwardRef(() => Module)`** on *both* sides of each cycle. When adding a new cross-module import that creates a cycle, wrap it in `forwardRef` on both ends — do not merge modules or duplicate services to avoid it.

### 2.3 Global vs local providers

- **Global interceptor** registered once via `APP_INTERCEPTOR` in `app.module.ts`: `ResponseEnvelopeInterceptor` (wraps every success response as `{ success, message, data }`).
- **Route-level interceptors** (`QuotaInterceptor`, `FileInterceptor`) are bound with `@UseInterceptors()` where they apply, and are provided in the module's `providers` array (Nest resolves constructor injection for interceptor classes listed as providers).
- Guards (`JwtAuthGuard`, `AdminGuard`) are provided per-module and applied per-controller via `@UseGuards()`. There is **no global auth guard** — public routes (`/auth/signup`, `/auth/login`, `/health`, `/static/*`, `/v1/*` facade with its own auth) stay public by simply not decorating them.

### 2.4 `JwtModule` registration pattern

`JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' })` is re-registered in every module that needs token signing/verification (auth, users, chat, models-admin, admin, files). This mirrors the same secret everywhere instead of building a shared config module — deliberate simplicity; `JWT_SECRET` env must be set in production (fallback is a dev-only placeholder).

---

## 3. Dependency Injection patterns

- **Constructor injection everywhere** — services never `new` their dependencies:

```ts
constructor(
  @InjectRepository(User) private repo: Repository<User>,   // TypeORM token from forFeature
  private users: UsersService,                              // exported from UsersModule
  private jwt: JwtService,                                  // from JwtModule
) {}
```

- **`@Optional()` for test-friendly guards** — `AdminGuard` declares `@Optional() private users?: UsersService` and guards against missing methods (`typeof this.users?.findById === 'function'`). Test fakes can omit it without crashing the guard. The same defensive `typeof` checks appear in `ChatService` for optional `settings`/`users` — an integration pattern that keeps unit fakes minimal.
- **Fakes at boundaries over mocking frameworks** — tests construct services directly with plain-object repos, or use `Test.createTestingModule` with `{ provide: X, useValue: fake }`. No `jest.mock` spaghetti.
- **Adapter interfaces for external IO** — payment gateways implement a `PaymentGatewayProvider` interface (`SandboxPaymentGateway`, `ZarinpalPaymentGateway`), and AI providers implement a `StreamAdapter` (`OpenAiCompatAdapter`). Swapping providers = swapping a DI provider, not rewriting services.

---

## 4. Controllers & routing

- Global prefix `api/v1` set in `main.ts` via `app.setGlobalPrefix('api/v1', { exclude: ['/', 'v1/(.*)', 'v1', 'static/(.*)', 'health', 'api/v1/health'] })` — so internal routes live under `/api/v1/*` while the OpenAI-compatible facade keeps its literal `/v1/*` and static avatar files are served prefix-less.
- Controllers stay thin: validate (via pipes), delegate to services, shape nothing. DTO classes own the shape; services own the logic; the envelope interceptor owns the response format.
- Route families (all under `/api/v1` unless noted):

| Family | Routes |
|---|---|
| `auth` | `POST signup`, `POST login` (`@HttpCode(200)` per contract), `POST logout` (guarded, 204) |
| `users/me` | `GET/PATCH profile`, `POST email`, `POST password`, `POST/DELETE avatar` |
| `static/avatars` | `GET :userId/:file` — public, no guard |
| `chat/conversations` | CRUD, `messages` (POST = streamed send), `stream` (SSE), `active-stream`, `stop`, `resume`, `pin`, `share`, `feedback`, `GET quota` |
| `models` / `v1/*` | public `GET /models`, OpenAI facade `POST /v1/chat/completions`, `GET /v1/models` |
| `admin/*` | users, conversations, files, models, providers, settings, dashboard, plans, subscriptions, coupons, payments, audit-logs — all `JwtAuthGuard + AdminGuard` |
| `files` | `POST upload`, `GET content` (token-guarded streaming) |
| `subscriptions` / `payments` | plans listing, subscribe, checkout, verify, coupons, my-payments |

---

## 5. Guards (authorization layers)

**`JwtAuthGuard`** (`shared/jwt-auth.guard.ts`) — custom `CanActivate`, no Passport:

1. Token extraction: `Authorization: Bearer …` header → fallback `?token=` query (exists solely for `EventSource` SSE, which cannot set headers).
2. Reject missing token → 401 `Missing or invalid access token`.
3. Reject tokens in the revocation registry (`AuthService.isTokenRevoked`, static in-memory `Set` filled by `POST /auth/logout`).
4. `jwt.verify()` → sets `req.user = payload` (`{ sub, email, role }`) and `req.token`.
5. `@CurrentUser()` decorator (`shared/current-user.decorator.ts`) exposes `req.user` to handler parameters.

**`AdminGuard`** (`shared/admin.guard.ts`) — stacked after `JwtAuthGuard` on every `/admin/*` controller. Security decision: the JWT `role` claim is **never trusted** — the guard re-reads the role from the database on every request (with `@Optional()` UsersService + `typeof` fallback for tests), so role changes apply within one request instead of waiting for token expiry.

**Ownership checks** are service-level (`ChatService.assertOwned`), not guard-level — users can only touch their own conversations; admins bypass via `AdminGuard` routes.

---

## 6. Interceptors

| Interceptor | Scope | Responsibility |
|---|---|---|
| `ResponseEnvelopeInterceptor` | global (`APP_INTERCEPTOR`) + registered in feature modules | wraps success payloads into the contract envelope `{ success, message, data }` |
| `QuotaInterceptor` | `@UseInterceptors` on chat + users/me controllers | after the handler, stamps `X-User-Quota` (base64 JSON quota snapshot) onto the response so the frontend store stays live; silently skips unauthenticated requests and never breaks the response on failure |
| `FileInterceptor` (platform-express) | avatar + file upload routes | multer `memoryStorage` + size limits before touching MinIO |

Pattern: interceptors never throw for their own failures — a telemetry/quota stamp must not break a chat response.

---

## 7. Pipes, validation & DTOs

- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `main.ts` — unknown properties are rejected outright (400), not silently dropped; payloads are transformed to DTO types.
- Per-route pipes re-declare `whitelist + transform` on auth endpoints for parity with the contract.
- DTOs use `class-validator` with **Persian messages** from `shared/messages.fa.ts` — e.g. `@IsEmail({}, { message: FA.emailInvalid })`, `@MinLength(8, { message: FA.passwordMin })`.
- Nullable numeric fields follow the `@ValidateIf((_o, v) => v !== null && v !== undefined)` idiom so explicit `null` ("remove limit") passes validation while garbage fails.

---

## 8. Exception filters & error shape

`shared/http-exception.filter.ts` catches everything and emits the contract error envelope `{ statusCode, message, error }` with Persian `message`s. Services throw Nest built-ins (`BadRequestException`, `UnauthorizedException`, `ConflictException`, `NotFoundException`, `ForbiddenException`) with Persian strings; structured machine-readable errors add a JSON payload — e.g. quota blocking throws a 400 whose body carries `error: 'QUOTA_EXCEEDED'`, `reason: 'tokens'|'messages'`, `resetAt` so the SPA can disable the composer and show the reset time.

---

## 9. Streaming with async generators

`ChatService.generate()` is an **async generator** (`AsyncGenerator<ChatChunk>`) — the NestJS-idiomatic way to keep streaming first-class:

- The controller iterates and writes SSE/chunked HTTP; the service yields `{ token | sources | search-status | … }` chunks.
- `ActiveStreamService` keeps a session registry per conversation: late subscribers replay accumulated text/sources (`GET …/stream`), `stop` aborts via `AbortController` (user-stopped messages persist with `stoppedByUser: true` and `sources: null`), a 35s watchdog arms around thinking phases.
- No `/v1` facade or storage coupling leaks into the generator — provider selection is resolved before iteration, echo-fallback exists only when no credential is configured (dev/tests).

---

## 10. TypeORM integration & schema policy

- **Runtime:** `TypeOrmModule.forRoot` in `app.module.ts` (env-driven connection; `synchronize: (process.env.DB_SYNC ?? 'true') === 'true'`), plus `TypeOrmModule.forFeature([...])` in each feature module for its repositories.
- **Migrations:** standalone `data-source.ts` (synchronize: false) exists only for the CLI (`npm run migration:generate/run -d src/data-source.ts`). 15 migrations track schema history (tokens, quotas, sources, soft deletes, model access levels, …).
- **Policy:** every schema change = update the entity **and** add a hand-written migration in the existing `ALTER TABLE … IF NOT EXISTS` style, so dev (`DB_SYNC`) and prod (migrations) never drift.
- **Soft deletes:** users, models, providers use `isDeleted` — every query filters it explicitly (`where: { isDeleted: false }`); rows are kept for audit.
- **Atomic counters:** usage increments use `createQueryBuilder().update().set({ usedTokens: () => '"usedTokens" + n' })` with a find-and-save fallback — read-modify-write races avoided at the SQL level.

---

## 11. Configuration & secrets

- `dotenv` loaded at the very top of `main.ts`/`data-source.ts` (before any Nest import reads env).
- **No ConfigModule** — deliberate: env vars are read inline (`process.env.JWT_SECRET`, `DB_*`, `MINIO_*`, `FRONTEND_URL`, `PORT`, `SERPER_API_KEY`, `OPENAI_API_KEY/BASE_URL`). Sensitive values never hardcode; missing MinIO config answers honest **503**.
- Provider API keys are **stored in the database** (per provider/model) and **masked on every read** at the service boundary (`mask-secret.ts`); the only env-level AI fallback is the OpenAI pair.
- CORS: comma-separated `FRONTEND_URL` allow-list with credentials enabled; requests with no `Origin` (curl, mobile) pass.

---

## 12. Testing (backend)

- **Jest**, specs in `backend/test/`. Two styles, both boundary-faked (no real DB):
  1. **Direct instantiation** for service logic — `new ChatService(fakeConvRepo, fakeMsgRepo, fakeModels, fakeForwarder, fakeSettings, fakeUsers)`; generators are consumed with `for await` / `gen.next()`.
  2. **`Test.createTestingModule`** for controller/HTTP behavior — controllers + `{ provide: X, useValue }` fakes + real `JwtAuthGuard` with a stub `JwtService.verify` + `ResponseEnvelopeInterceptor`, then `request(app.getHttpServer())`.
- Test **behavior, not methods**: "user over quota gets `QUOTA_EXCEEDED` with reason tokens", "stopped answers claim no sources", "admin guard re-reads role from DB".
- Green gate before any task closes: `npm run lint` (tsc `--noEmit`), `npm run test`, `npm run test:e2e` — plus frontend `npm run build` (includes `vue-tsc`) and `npm run test:unit`.

---

## 13. Conventions checklist (for any new backend work)

- [ ] New feature = new self-contained module folder (controller + service + entity + dto).
- [ ] Cross-module cycles wrapped in `forwardRef` on **both** sides.
- [ ] Guards: `JwtAuthGuard` (+ `AdminGuard` on admin-only); ownership checks in services.
- [ ] DTO validation with Persian messages from `messages.fa.ts`; `whitelist + forbidNonWhitelisted` always on.
- [ ] Errors thrown as Nest built-ins with Persian text; machine-readable codes only where the frontend must branch (e.g. `QUOTA_EXCEEDED`).
- [ ] Schema change = entity edit **and** migration file; soft delete where deletion exists.
- [ ] Secrets masked on read; env-only for infrastructure credentials.
- [ ] At least one integration test on the main path + one key error path; full suites green; wiki + `CHANGELOG.md` updated.

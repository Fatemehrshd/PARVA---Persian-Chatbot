# Frontend Guide — Vue 3, shadcn-vue & Tailwind Principles

> Complete frontend onboarding document: architecture, state management, API layer, streaming, UI conventions, and every technical decision with its rationale.
> Companion docs: [Onboarding Guide](./onboarding-guide.md) · [NestJS Backend Guide](./backend-nestjs-guide.md) · [Architecture](./architecture.md)

---

## 1. Overview & Stack

The frontend is a **Vue 3 single-page application** built with **Vite**, talking to the NestJS backend purely over its REST/SSE API.

| Concern | Choice |
|---|---|
| Framework | Vue 3 — Composition API with `<script setup>` only |
| Build tool | Vite (`npm run build` runs `vue-tsc -b` type check first) |
| State | Pinia — one store per domain |
| Routing | Vue Router 4 (`createWebHistory`), lazy-loaded route components |
| Styling | Tailwind utility classes + shadcn-vue primitives + CSS-variable design tokens |
| Language | TypeScript throughout; UI text is **Persian, strictly RTL** |
| Testing | Vitest + Vue Test Utils (user-point-of-view tests) |
| API base URL | `import.meta.env.VITE_API_BASE_URL` — **never hardcoded** anywhere |

```
frontend/src/
├── main.ts            ← createApp + Pinia + router (nothing else)
├── App.vue            ← shell (router-view, global overlays)
├── router/index.ts    ← route table + auth guards
├── views/             ← pages: ChatView, LoginView, AdminPanelView, SubscriptionView, ...
│   └── admin/         ← 13 admin sections (dashboard, users, models, plans, ...)
├── components/
│   ├── chat/          ← MessageList, MessageBubble, ChatComposer, SourcesBlock, ...
│   ├── admin/         ← AdminTable, AdminModal, modals/ (editor modals)
│   ├── ui/            ← shadcn-vue primitives (Button, Input, Label, ...)
│   ├── layout/        ← AppSidebar, ProfileMenu, theme pieces
│   ├── auth/          ← auth modals
│   └── subscription/  ← plan cards, checkout pieces
├── stores/            ← Pinia: auth, chat, models, ui, quota
├── services/          ← 12 API clients, all through services/api.ts
├── composables/       ← useFileUpload, useFormSubmit, useAsyncAction, useDisclosure, useThemeLogo
├── lib/               ← jwt, jalali/date, filename, utils
├── utils/             ← citations, textDirection, numberInput, stats, models
└── types/             ← domain DTOs mirroring api-contract.yaml
```

---

## 2. Bootstrap & Routing

`main.ts` is minimal by design: `createApp` → Pinia → router → mount. All boot-time behavior lives in two places:

**Router guards** (`router/index.ts`) — a single `beforeEach`:

1. **Proactive JWT expiry** — `lib/jwt.isTokenExpired()` decodes the stored access token on every navigation; expired tokens are purged from `localStorage` immediately (token, user, refreshToken).
2. `meta.requiresAuth` → redirect to `/login?redirect=<fullPath>` when no token.
3. `meta.requiresAdmin` → calls `authStore.refreshIdentity()` (server re-sync of the user record, mirroring the backend's AdminGuard "never trust the token role" rule), then verifies `identity.role === 'admin'`; failure keeps access conservative.
4. `meta.guestOnly` → authenticated users bounce from `/login` and `/signup` to `/`.

**Route map:** `/` (chat, eager — the product's core screen), `/chat/:id`, `/login` + `/signup` (same `LoginView`, tab-switched), `/admin/*` with **13 lazy children** (dashboard, providers, models, users, prompts, chats, files, file-settings, plans, subscriptions, payments, coupons, audit-logs), `/subscription`, `/payment-result`, `/sandbox-gateway`, and a public `/share/:shareCode` viewer (`requiresAuth: false`).

**Decision — section switching inside AdminPanelView:** the admin shell resolves the active section from the URL and renders it with a `v-if`/`v-else-if` chain (child routes are deep-linkable URLs, not a `<router-view>`). Exactly one section is mounted at a time; each section refetches on mount. Rationale: simpler state, guaranteed-fresh server-side grids, no stale cache across sections.

---

## 3. Layered architecture (the one-way dependency rule)

```
views / components        (rendering, user interaction)
      │  calls
    stores (Pinia)        (state + actions, per domain)
      │  calls
   services/*.ts          (typed API clients — the ONLY fetch users)
      │  uses
 services/api.ts          (request wrapper: base URL, JWT, envelope, error mapping)
```

- Views/components **never** call `fetch` and never import axios — they dispatch store actions or call a service function.
- Services return **unwrapped `data`** (the envelope is peeled in `api.ts`), so consumers work with domain types from `types/index.ts` (which mirror `api-contract.yaml`).
- The graph confirms the shape: `services/api.request` is the single hottest function (fan-in 85), and the biggest call clusters are exactly the feature flows: streaming (`executeMessageStream → selectConversation → ensureState → finishStream`), file uploads, admin grids, and checkout.

---

## 4. Pinia stores (one per domain)

| Store | State (essentials) | Actions / notes |
|---|---|---|
| `auth` | token, user, identity | `login`, `signup`, `logout`, `refreshIdentity()` (server re-sync used by the admin route guard) |
| `chat` | conversations, messages, per-conversation stream states (`convStreamStates` map), per-conv feature flags (`convFlags` + localStorage) | `sendMessage` (streams token-by-token), `stopStreaming`, `finishStream`, reconnect/resume; after each stream ends it refreshes the quota store |
| `models` | model list, selected model, platform default | shared between chat picker, admin models section, and dashboard — the repo's model for cross-section shared state |
| `ui` | toasts, modal flags, theme (dark/light via `document.documentElement` class + `data-theme`), sidebar, **fixed RTL direction** | `showToast` is the second-hottest function (fan-in 61) — all user feedback flows through it |
| `quota` | remaining %, remaining tokens/messages, `blocked`, `reason`, `resetAt` | updated from the `X-User-Quota` response header on every authed response + `GET /chat/quota`; drives composer gating and the profile-menu summary |

**Pattern:** stores use the Composition API style (`defineStore` with setup function). `stores/counter.ts` is scaffold leftover — ignore it.

---

## 5. API layer (`services/api.ts`)

The single `request<T>(endpoint, options)` wrapper owns every HTTP concern:

1. **Base URL** from `VITE_API_BASE_URL` (dev fallback `http://localhost:3000`).
2. **Auth**: attaches `Authorization: Bearer <token>` from `localStorage`.
3. **Envelope handling**: unwraps `{ success, message, data }` → returns `data`; throws on `success: false`.
4. **Error mapping**: collects array messages, throws typed `ApiError(statusCode, message, error)`.
5. **Global reactions**: 401 (outside the auth endpoints) → purge session + toast + hard redirect to `/login`; 500+ → error toast.
6. **Quota sync**: reads the `X-User-Quota` response header (base64 JSON stamped by the backend interceptor) and feeds it into the Pinia quota store via dynamic import — so every authed response refreshes the user's quota state without extra polling.

**SSE/streaming** bypasses the JSON path: `chat.service.ts` uses `fetch` with stream reading (`readSseStream`, `sendMessageStream`, `subscribeActiveStream`), dispatching parsed events into the chat store; the `?token=` query fallback authenticates `EventSource`-style endpoints.

---

## 6. Composables & utilities (reuse before re-write)

| Composable / util | Purpose |
|---|---|
| `useFileUpload` | the whole upload lifecycle: validation, progress, MinIO polling (`pollFileStatus`), **sessionStorage persistence per conversation** (survives refresh/switch), `waitForUploads` |
| `useFormSubmit` | shared submit wrapper: `isSubmitting` state + error propagation (used by login/signup, profile forms) |
| `useAsyncAction` / `useDisclosure` | generic loading-state and open/close primitives |
| `useThemeLogo` | returns the dark/light variant of brand assets |
| `lib/jwt` | `isTokenExpired` decode for the router guard |
| `lib/jalali` + `lib/date` | Gregorian↔Jalali conversion, Persian date display (`IranDate` components) |
| `utils/numberInput` | Persian-digit normalization — all admin numeric inputs accept **Persian digits** and emit canonical numbers |
| `utils/citations` | `linkCitationsInHtml` — turns model `[n]` markers into clickable source links |
| `utils/textDirection` | per-message RTL/LTR detection (code blocks / English text inside RTL chat) |

---

## 7. shadcn-vue + Tailwind conventions (enforced in review)

### 7.1 Design tokens over hardcoded colors

- All colors/typography resolve through **CSS variables** (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--destructive`, ...) defined per theme; Tailwind classes consume them (`bg-background`, `text-foreground`, `border-border`).
- **Dark/light** = `document.documentElement.classList.toggle('dark')` + `data-theme` attribute (managed centrally in `uiStore.applyTheme`); components never branch on theme themselves.
- No hex codes or raw `style=""` colors in components. Semantic classes like `text-emerald-500`/`text-amber-500`/`text-rose-500` are reserved for status color-coding (e.g. quota remaining: >50 % green, 20–50 % amber, <20 % rose).

### 7.2 shadcn-vue primitives

- Primitives live in `src/components/ui/` and are imported from their folder (`import { Button } from '@/components/ui/button'`).
- Composition happens in **feature components** — never modify a primitive in place to solve a local problem; extend via props/classes or build a wrapper.

### 7.3 Tailwind rules

- **Utilities only** in templates; RTL is expressed with logical utilities (`ps-*`, `pe-*`, `start-*`, `end-*`, `ms-*`) instead of physical `left/right` so the Persian RTL layout stays correct.
- **No new CSS classes in `<style scoped>`** when utilities suffice; scoped styles are accepted only for layout glue that already exists as a pattern (e.g. `.mono` for LTR font direction on numbers).
- Responsive via breakpoints (`sm:` `md:`) — modals and grids collapse to single-column on mobile (e.g. `.form-grid { grid-template-columns: 1fr }` under 600 px).

### 7.4 Reusable building blocks (do not re-invent)

| Block | Contract |
|---|---|
| `AdminTable.vue` | DataGrid: `columns` (`key`, `label`, `width`, `sortable`, `align`) + `#row` slot with `<td data-label>` cells; server-side pagination/search/sort/column-filters via events; **headers centered per-column (`align`), first column stays start-aligned** |
| `AdminModal.vue` | modal shell: `eyebrow`, `title`, `@close`; responsive by default |
| `BaseButton.vue` | `variant` (primary/ghost), `size`, `loading`, `disabled` |
| `BaseToggle.vue` | switch for status fields |
| Editor modals (`UserEditorModal`, `RoleTokenLimitModal`, `TaskMultiplierModal`, `ModelEditorModal`, ...) | props in (`open`, entity, `tokenRatePer1000`, `isSaving`), events out (`close`, `save`); **dual $/token inputs** kept in sync via the token rate; Persian labels; grids collapse on mobile |

### 7.5 Data-display conventions

- **Persian digits everywhere** in tables and counters (`toLocaleString('fa-IR')` or `numberInput` utils); raw Latin digits only inside `font-mono` LTR spans where they represent technical values.
- Admin grids are **server-side**: search/filter/sort/pagination emit events → service call → fresh data; the frontend never filters large arrays locally.
- Empty/loading/error states follow one visual language: branded logo loader, `error-banner` (destructive tint), dashed-border empty state.

---

## 8. Key UX flows (where to read what)

| Flow | Entry points |
|---|---|
| **Login / Register** | `LoginView.vue` — one form, tab-switched (`isSignup`), split layout (artwork half + form half), client validation with backend as source of truth |
| **Chat streaming** | `ChatView.vue` → `chat` store `sendMessage` → SSE chunks append per conversation; `MessageList` renders the live bubble; auto-scroll with user-scroll override; stop button → `stopStreaming` (stopped answers show no sources) |
| **Web search** | per-conversation toggle (`convFlags`) → `SourcesBlock` under completed answers only |
| **File uploads** | `ChatComposer` → `useFileUpload` → validated, polled to `ready`, persisted per conversation in sessionStorage, dispatched with the message |
| **Quota blocking** | quota store (header-synced) → composer + new-chat disabled, banner "تا ساعت HH:mm امکان ارسال پیام ندارید", profile-menu remaining-% chip (non-clickable, color-coded) |
| **Admin panel** | `AdminPanelView.vue` → section components; edit modals save via `updateSettings`/`updateUser`; optimistic updates with rollback (pattern: `AdminModelsSection.setPlatformDefault`) |
| **Subscription & payment** | `SubscriptionView` → checkout → gateway (Zarinpal/sandbox) → `PaymentResultView`; `/share/:code` → `SharedChatView` public viewer |

---

## 9. Technical decisions & rationale

| # | Decision | Why |
|---|---|---|
| 1 | Composition API + `<script setup>` only | Vue 3's recommended API; less boilerplate, better TS inference, one style across the codebase |
| 2 | Pinia, one store per domain | The officially recommended state library; domain stores map 1:1 to backend modules making the API surface discoverable |
| 3 | Single `request()` wrapper (no axios) | One place for base URL, JWT injection, envelope unwrapping, error mapping, global 401/500 reactions, and quota-header sync |
| 4 | API base URL only from env | Contract requirement — never hardcoded; enables per-environment deploys without rebuilds of logic |
| 5 | Streaming rendered token-by-token via per-conversation state map | Requirement: incremental rendering; `convStreamStates` lets background conversations keep streaming while the user browses others (sidebar indicators) |
| 6 | Router guards with proactive token-expiry check | Expired sessions are cleaned before a request 401s; admin routes re-sync identity server-side (defense in depth with backend `AdminGuard`) |
| 7 | Admin sections switch via `v-if` + URL sync (not nested router-view) | Simplicity: each section is a self-fetching server-side grid; deep links still work; no stale cross-section caches |
| 8 | shadcn-vue primitives + Tailwind utilities + CSS-variable theming | Consistent design system with dark mode and RTL for free; primitives are vendored (owned code) not black-box deps |
| 9 | Logical (ps/pe/start/end) utilities everywhere | The UI is strictly RTL — physical direction utilities would break mirroring |
| 10 | Persian-digit normalization at the input layer | Persian users type Persian digits; inputs normalize via `numberInput` utils so the backend always receives canonical numbers |
| 11 | sessionStorage persistence for drafts/uploads/errors per conversation | Refresh and conversation switching must not lose composer drafts, ready files, or dismissed errors (show-once errors) |
| 12 | Optimistic updates with rollback in admin (pattern from `setPlatformDefault`) | Instant UI on slow networks; rollback + toast on failure keeps admin actions honest |
| 13 | Vitest user-POV tests (mount → interact → assert visible text) | Tests stay meaningful through refactors; matches the project's behavior-level testing philosophy |
| 14 | `vue-tsc` gate inside the build | Type errors fail the build, not just the IDE |

---

## 10. Testing & verification gates

- **Vitest + Vue Test Utils**, specs in `frontend/tests/` — mount the component, simulate clicks/typing, assert what the user sees (not internals).
- Minimum per feature: one happy path + one important error case.
- **Before closing any task:** `npm run build` (runs `vue-tsc -b`), `npm run test:unit` — green; backend suites green too (golden rule); `docs/wiki/features.md` + `CHANGELOG.md` updated.

---

## 11. First-week checklist (frontend)

1. Read `AGENTS.md` (root) + `frontend/AGENTS.md`.
2. Run the stack (see [Getting Started](./getting-started.md)); log in and send one streaming chat message with DevTools open — watch the SSE chunks and the store updates.
3. Trace `services/api.ts` once — the envelope, error, and quota-header logic explain most of the "magic".
4. Open `AdminPanelView.vue` and one admin section; notice the AdminTable/modal/optimistic-update trio — you will reuse all three.
5. Skim `types/index.ts` next to `api-contract.yaml` — every service response is one of those types.
6. Before your first change: re-read the Tailwind/shadcn rules in §7 — utilities only, logical RTL utilities, primitives over patches.

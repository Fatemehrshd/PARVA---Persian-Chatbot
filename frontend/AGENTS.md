# AGENTS.md — Frontend

This file is specific to working inside `frontend/`. Project-wide rules live in [`../AGENTS.md`](../AGENTS.md) — always consider both files together.

## Stack

- **Vue 3** (Composition API) + **Vite**
- Suggested: **Pinia** for state management, **vue-router** for routing
- Talks to the backend only through the API. The API base URL is read from an environment variable (`VITE_API_BASE_URL`), never hardcoded.

## Suggested Folder Structure

```
frontend/
├── src/
│   ├── views/         ← pages (Login, Chat, AdminModels, ...)
│   ├── components/    ← reusable components
│   ├── stores/         ← one Pinia store per domain (auth, chat, models)
│   ├── services/       ← API clients (axios/fetch wrapper)
│   ├── router/
│   └── main.ts
├── tests/
└── package.json
```

Each new feature should preferably add a new view/store/service rather than making risky changes inside previous features' files.

## Conventions

- The chat's streaming response must render incrementally in the UI (token by token), not wait for the full response.
- Forms (sign-up/login) have client-side validation, but the backend remains the source of truth for validation.
- The UI is in Persian and right-to-left (RTL); new components must be RTL-compatible.

## Testing

- Framework: **Vitest + Vue Test Utils**.
- Write tests from the user's point of view (render a component, simulate clicks/typing, check what appears on screen) rather than testing a component's internal implementation details.
- Every new feature needs at least: one happy-path test + one test for the most important error case.
- Commands:
  - `npm run test:unit`
  - `npm run test:e2e` (once Cypress/Playwright is added)

## Checklist Before Closing a Task

- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` passes with no errors
- [ ] `npm run test:unit` is green
- [ ] Manual check: previous features (login, chat, model panel) still work correctly
- [ ] `docs/wiki/features.md` (and `getting-started.md` if needed) has been updated

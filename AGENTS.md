# AGENTS.md

This file holds the **project-wide** rules. For folder-specific detail, read this file together with the file inside that folder:

- Backend details → [`backend/AGENTS.md`](./backend/AGENTS.md)
- Frontend details → [`frontend/AGENTS.md`](./frontend/AGENTS.md)

---

## 1. Project Overview

This project is a multi-model AI chat platform.

- The codebase is built from scratch.
- **Golden rule of the project:** a new feature must never break a previous one.

## 2. Overall Project Structure (Monorepo)

```
/
├── AGENTS.md              ← this file (project-wide rules)
├── CHANGELOG.md           ← version history
├── docs/
│   └── wiki/              ← onboarding wiki (see section 6)
├── backend/               ← Backend service — fully independent (its own package.json)
│   └── AGENTS.md          ← Backend-specific rules
└── frontend/              ← Frontend app — fully independent (its own package.json)
    └── AGENTS.md          ← Frontend-specific rules
```

`backend/` and `frontend/` are two fully separate projects: each has its own dependencies, scripts, and tests, and each builds/runs independently. The only connection point between them is the **API** (REST for regular operations + a streaming response for chat, via SSE or chunked HTTP). The API base URL is never hardcoded in the frontend code — it always comes from an environment variable.

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS |
| Frontend | Vue 3 + Vite |
| Database | PostgreSQL + TypeORM |


Kubernetes, clustering, and complex production infrastructure are **not** requirements of this project. The focus is on the product, not the infrastructure.

## 4. Workflow for Each Task

Every new task goes through this cycle:

1. **Analyze** — read the new requirement, review the current state of the code, and figure out where the new feature fits into the existing architecture (with the smallest possible change to existing code).
2. **Plan** — write a short checklist of the work needed.
3. **Implement** — build the feature in its own module/files.
4. **Test (mandatory, at the end of the stage)** — per section 5 below.
5. **Update the wiki (mandatory)** — per section 6 below.

## 5. Testing Philosophy

- Writing and running tests is **mandatory at the end of each stage/feature**, not alongside every line of code.
- Tests **must not be overly granular**. Instead of testing every function or every internal method, focus on observable behavior and the task's acceptance criteria:
  - Good example: "a user signs up with valid data and receives a token"; "a sent message returns a streaming response."
  - Bad example (overly granular): a separate test for every private method or every internal getter/setter.
  - Every new feature includes at minimum: one happy-path test + one test for the most important error case.
- The goal is not 100% code coverage; the goal is confidence that the feature works correctly and that nothing previous was broken.
- Before closing any task, the full test suite (backend + frontend) must be green.

## 6. Project Wiki (for Onboarding New Team Members)

The project must have a wiki that lets a new team member get the project running and understand what's been built so far, just by reading it — without needing to ask anyone.

- **Location:** `docs/wiki/` — Markdown files inside the repo itself (not a separate external tool), so both humans and coding agents can read and edit it directly.
- **Minimum pages:**
  - `docs/wiki/README.md` — wiki map + a very short project introduction
  - `docs/wiki/getting-started.md` — how to run the project locally (env vars, docker-compose, migrations, running backend and frontend)
  - `docs/wiki/architecture.md` — overall architecture, modules, how backend/frontend connect
  - `docs/wiki/features.md` — list of implemented features, each noting which task/version added it
  - `docs/wiki/decisions.md` — important architectural decisions and their reasoning (especially when a new feature changes previous behavior)
- **Mandatory: the wiki must be updated at the end of every task, alongside testing and versioning** — at minimum `features.md`, and `getting-started.md` or `architecture.md` when the run process or architecture has changed.
- The wiki is not a copy of code documentation; it should be exactly what a newcomer needs to become productive as quickly as possible.

## 7. Golden Rule (Repeated on Purpose)

If implementing a new requirement requires changing the behavior of a previous feature, that decision and its reasoning must be stated explicitly in the commit message and in `CHANGELOG.md` — silent, undocumented changes are not allowed.

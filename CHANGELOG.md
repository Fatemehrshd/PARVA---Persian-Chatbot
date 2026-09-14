# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-14

### Added
- **OpenAI-Compatible Inbound API**:
  - `GET /v1/models`: Standard OpenAI format listing all active models.
  - `POST /v1/chat/completions`: Standard OpenAI chat completion endpoint supporting standard JSON response as well as real-time Server-Sent Events (SSE) streaming (`stream: true`).
- **OpenAI-Compatible Outbound LLM Integration**:
  - Enhanced `AiModel` entity with `apiKey` and `baseUrl` columns.
  - `ChatService` dynamically connects to any custom OpenAI-compatible endpoint (Ollama, vLLM, OpenRouter, Azure, OpenAI) when configured.
  - API keys are securely stored and masked in admin API responses (`sk-...${last4}`).
- **Conversation Deletion Endpoint**:
  - Added `DELETE /chat/conversations/:id` to remove conversations and related messages with user ownership enforcement.
- **Conversation Rename Endpoint**:
  - Added `PATCH /chat/conversations/:id` to update conversation title with user ownership enforcement and non-empty title validation.
- **Conversation Action Modals**:
  - Added `DeleteConversationModal.vue`: Dedicated confirmation dialog preventing accidental deletion.
  - Added `EditConversationModal.vue`: Dedicated structured component modal with autofocus and save actions for renaming conversation titles.
- **Right-Aligned & Theme-Adaptive Toasts**:
  - Positioned toast alerts firmly to the right edge (`top-4 right-4 items-end`).
  - Adapted toast styling dynamically to the active theme (light background in light theme, obsidian dark in dark theme).
- **Model Status Toggle**:
  - Added `PATCH /admin/models/:modelId/status` to activate or deactivate models.
  - Inactive models are prevented from chat execution with 400 Bad Request.
- **Light / Dark Theme Engine**:
  - Added centralized theme switcher in `SettingsModal.vue` with visual selection cards.
  - State managed reactively in `uiStore` and persisted across sessions in `localStorage`.
- **Grok Cosmic Fluid Aurora Background**:
  - Built `<GrokAurora />` featuring fluid animated color blobs with GPU-accelerated keyframe transforms.
  - Active ambient animation on `/login` with pulse effect during login.
  - Entrance animation in `ChatView.vue` for both dark and light modes.

- **Logout Confirmation Modal**:
  - Added `LogoutModal.vue`: Dedicated confirmation modal dialog with warning illustration, cancel, and destructive confirm action with loading spinner.
- **RTL/LTR Left-Right Modal Button Standard**:
  - Arranged action buttons across all modals (`LogoutModal.vue`, `DeleteConversationModal.vue`, `EditConversationModal.vue`, `ModelsModal.vue`) to occupy both the left and right edges (`justify-between`), automatically aligning primary/confirm action to the right and cancel to the left in RTL, and cancel to the left and primary/confirm action to the right in LTR.

### Changed
- **Admin Panel Redesign & Decluttering**:
  - Replaced bulky cards in `/admin/models` with sleek, compact status badges.
  - Simplified registration form with collapsible/optional endpoint configuration (`baseUrl`, `apiKey`).
  - Added instant toggle switch for active/inactive status in the data table.
  - Removed Admin Panel section from the navigation sidebar (`AppSidebar.vue`) to keep the interface clean; accessible via the role-gated Header button and Settings modal.
- **Sidebar Logout Action Relocation**:
  - Removed direct logout button from `AppHeader.vue` and separated it from the user card in `AppSidebar.vue`.
  - Positioned a dedicated logout button sticking to the bottom of the sidebar footer with clear icon and text label.

---

## [0.3.0] - 2026-09-14

### Added
- **Universal Form Composable (`useFormSubmit`)**: Centralized composable for managing form submission, double-submit prevention, loading state, error banners, granular `class-validator` field error mapping, and toast integration.
- **Global Network & Auth Interceptors**: Auto-handling of 401 session expiry (clears tokens, displays warning toast, redirects to `/login`) and 500 server error notifications in `api.ts`.
- **Navigation Route Guards (`router.beforeEach`)**: Protection for `/` and `/chat/:id` (`requiresAuth`), `/admin/models` (`requiresAuth` and `requiresAdmin`), and `/login` / `/signup` (`guestOnly`).
- **Reactive Toast Notification System**: Floating, animated notifications (`ToastContainer.vue`) managed via `uiStore.toasts`.
- **Admin UI Gating**: Admin button in `AppHeader.vue` guarded by `v-if="authStore.isAdmin"`.
- **Unit Test Suite**: Added `tests/useFormSubmit.spec.ts` (6 new unit tests), bringing total frontend tests to 45.

### Changed
- **Model Registration Security**: Removed silent offline fallbacks from `models.ts` and `auth.ts` that previously swallowed 403 Forbidden responses. Real backend errors are now truthfully propagated and displayed in the UI.

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


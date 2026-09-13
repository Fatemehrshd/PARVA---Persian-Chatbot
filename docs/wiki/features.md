# Features

## Task 1: Full-Stack Project Initialization
- Initialized Vue 3 + Vite + TypeScript frontend with Vue Router 4 and Pinia state management.
- Initialized NestJS + TypeScript backend with Express platform adapter and CORS enabled.
- Added environment variable support (`.env` and `.env.example`) for both frontend and backend.
- Added `.gitignore` to prevent secret and build artifact leakage.

## Task 2: UI Overhaul & Responsiveness
- Installed and configured **Tailwind CSS** and **shadcn-vue** for the frontend.
- Added **Vazirmatn** font face to the project, ensuring proper Persian (RTL) typography.
- Made the frontend fully responsive.

## Task 3: Auth Page & Shadcn UI Integration
- Replaced modal authentication with dedicated `/login` and `/signup` routes using shadcn-vue components (`Card`, `Button`, `Input`, `Label`).
- Fixed ESM compatibility for `tailwind.config.js` and PostCSS bundling in `vite.config.ts`.
- Configured CSS variables and opacity tokens for shadcn-vue.
- Added comprehensive unit tests for `LoginView.vue`.

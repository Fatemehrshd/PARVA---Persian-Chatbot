# Project Initialization: Vue 3 + Vite Frontend & NestJS Backend

## 1. Overview
Initialize a modern full-stack web application structure in `D:/codeless_final` featuring:
- **Frontend**: Vue 3 + Vite + TypeScript with Vue Router and Pinia state management.
- **Backend**: NestJS + TypeScript backend with standard Express platform adapter.
- **Package Manager**: `npm`.

---

## 2. Frontend Specification (`frontend/`)

### 2.1 Dependencies
- **Dependencies (`dependencies`)**:
  - `vue`: `^3.5.0`
  - `vue-router`: `^4.4.0`
  - `pinia`: `^2.2.0`
- **Development Dependencies (`devDependencies`)**:
  - `@vitejs/plugin-vue`: `^5.1.0`
  - `vite`: `^5.4.0`
  - `vue-tsc`: `^2.1.0`
  - `typescript`: `^5.5.0`
  - `@types/node`: `^22.0.0`

### 2.2 Directory Structure
```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── App.vue
    ├── main.ts
    ├── router/
    │   └── index.ts
    ├── stores/
    │   └── counter.ts
    └── views/
        ├── AboutView.vue
        └── HomeView.vue
```

### 2.3 Key Configurations
- `vite.config.ts`:
  - Registers `@vitejs/plugin-vue`.
  - Configures path alias `@` -> `./src`.
- `tsconfig.json`:
  - References `tsconfig.app.json` and `tsconfig.node.json`.
- `package.json` scripts:
  - `dev`: `vite`
  - `build`: `vue-tsc -b && vite build`
  - `preview`: `vite preview`

---

## 3. Backend Specification (`backend/`)

### 3.1 Dependencies
- **Dependencies (`dependencies`)**:
  - `@nestjs/common`: `^10.4.0`
  - `@nestjs/core`: `^10.4.0`
  - `@nestjs/platform-express`: `^10.4.0`
  - `reflect-metadata`: `^0.2.0`
  - `rxjs`: `^7.8.0`
- **Development Dependencies (`devDependencies`)**:
  - `@nestjs/cli`: `^10.4.0`
  - `@nestjs/schematics`: `^10.1.0`
  - `@types/express`: `^5.0.0`
  - `@types/node`: `^22.0.0`
  - `typescript`: `^5.5.0`
  - `ts-node`: `^10.9.0`
  - `tsconfig-paths`: `^4.2.0`

### 3.2 Directory Structure
```
backend/
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── app.controller.ts
    ├── app.module.ts
    ├── app.service.ts
    └── main.ts
```

### 3.3 Key Configurations
- `nest-cli.json`: Standard configuration for NestJS compilation.
- `tsconfig.json`:
  - `experimentalDecorators: true`
  - `emitDecoratorMetadata: true`
  - `target: ES2021`
  - `module: commonjs`
- `package.json` scripts:
  - `build`: `nest build`
  - `start`: `nest start`
  - `start:dev`: `nest start --watch`

---

## 4. Verification and Acceptance Criteria
1. **Frontend**:
   - Running `npm install` inside `frontend/` succeeds without unresolved dependencies.
   - Running `npm run build` inside `frontend/` executes `vue-tsc` and `vite build` without errors, generating production assets in `frontend/dist/`.
2. **Backend**:
   - Running `npm install` inside `backend/` succeeds without unresolved dependencies.
   - Running `npm run build` inside `backend/` compiles TypeScript files via Nest CLI without errors, generating output in `backend/dist/`.

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
VITE_API_BASE_URL=http://localhost:3000
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
```

Run in development mode:
```bash
npm run start:dev
```

Build for production:
```bash
npm run build
```

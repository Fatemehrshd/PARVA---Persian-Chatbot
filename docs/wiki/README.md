# Project Documentation Wiki

Welcome to the project documentation wiki.

## Navigation
- [Onboarding Guide — Full Backend & Frontend Conventions](onboarding-guide.md)
- [NestJS Backend Guide — Principles, Patterns & Decisions](backend-nestjs-guide.md)
- [Frontend Guide — Vue 3, shadcn-vue & Tailwind Principles](frontend-guide.md)
- [Getting Started](getting-started.md)
- [Architecture Overview](architecture.md)
- [API Architecture & Technical Reference](api-reference.md)
- [Chat System & Streaming Architecture](chat-system.md)
- [Chat Resilience: Offline, Refresh & Interrupted Streaming](chat-resilience.md)
- [Streaming Comprehensive Guide (README)](../STREAMING_README.md)
- [Features History](features.md)
- [Admin Panel Guide (راهنمای پنل مدیریت)](admin.md)
- [SigNoz APM & Telemetry Guide (راهنمای سیگنوز)](signoz.md)
- [Architectural Decisions (ADRs)](decisions.md)

## Development Workflow & Testing

Before delivering any output, you **MUST** ensure the overall application tests are passing. 
1. **Write tests** for new features.
2. **Run tests** (`npm run build` and `npm run test:unit`) to confirm no regressions.
3. Once tests are successful and the build completes without errors, you may confidently deliver the output.

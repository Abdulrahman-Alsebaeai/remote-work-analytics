# Remote Work Analytics

**Production-oriented remote-work analytics platform with a manager dashboard, secure REST API, and Windows employee agent.**

The system is organized as a monorepo with three independently deployable components and shared public contracts. Runtime communication occurs through authenticated REST APIs; clients do not access MySQL directly or import another component's internal code.

## Components

- **`apps/api`** — NestJS REST API, Prisma/MySQL persistence, authentication, analytics, reporting, observability, settings, tasks, notifications, and isolated AI processing.
- **`apps/web`** — Next.js manager web application with dashboard, performance analytics, screenshots, tasks, users, settings, insights, and public marketing pages.
- **`apps/agent`** — Tauri 2 / Rust + web UI employee agent with activity collection and offline synchronization.
- **`packages/contracts`** — public REST-boundary contracts shared between components.
- **`packages/design-tokens`** — shared design-system tokens.

## Architecture

```text
Windows Agent  ── authenticated REST ──►  NestJS API  ──► MySQL
Manager Web    ── authenticated REST ──►      │
                                             ├─ analytics & reports
                                             ├─ tasks & notifications
                                             └─ isolated AI adapter
```

## Requirements

- Node.js 22 LTS (Node.js 20+ is supported by the workspace engine constraint)
- MySQL 8.4 or a compatible managed MySQL service
- Rust toolchain + Visual Studio C++ Build Tools when building the Windows agent

Docker is not required.

## Local setup

Create an empty MySQL database and copy `.env.example` to `.env`, then replace every placeholder secret.

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

API base URL: `http://127.0.0.1:4000/api/v1`

Health endpoints: `/api/v1/health/live` and `/api/v1/health/ready`

## Verification

```powershell
npm test
npm run lint
npm run build
```

The test suite includes unit and HTTP E2E hardening checks. See [`docs/operations.md`](docs/operations.md) for deployment, monitoring, backup, and restore guidance.

## Windows agent

The Rust toolchain is pinned under `apps/agent/src-tauri/`. Build the desktop agent with:

```powershell
npm run build -w @remote-work/agent
npm run tauri -w @remote-work/agent -- build
```

## Security and privacy

Real environment files, runtime logs, private captured screenshots, local database dumps, and generated installers are deliberately excluded from the public repository. Only sanitized environment examples and reproducible migration/seed sources are version controlled. See [`docs/LOCAL_ARTIFACTS.md`](docs/LOCAL_ARTIFACTS.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/operations.md`](docs/operations.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/system-summary-ar.md`](docs/system-summary-ar.md)
- [`docs/move-project-to-new-laptop-ar.md`](docs/move-project-to-new-laptop-ar.md)

## Status

Academic / portfolio implementation. Validate employee-consent, monitoring, privacy, retention, labor-law, and security requirements before production deployment.

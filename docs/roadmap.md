# Incremental roadmap

1. **Foundation and authentication** — complete: schema, login, refresh rotation, logout, current user, roles, health, validation.
2. **Organization-aware user and employee management** — complete: tenant-scoped APIs, role enforcement, append-only audit events, secure web session proxy, and Arabic/English manager shell.
3. **Task management** — complete: organization-scoped lifecycle, manager/employee permission split, notes, notifications, audit events, and localized manager UI.
4. **Desktop agent foundation** — complete: Tauri/Rust session lifecycle, AES-GCM encrypted SQLite outbox, credential-safe authentication, retry/refresh, idempotent REST synchronization, and signed-ready MSI/NSIS packaging.
5. **Activity collection** — complete: privacy-aware Windows collectors, encrypted offline screenshot outbox, deduplicated replaceable storage, secure synchronization, and manager review.
6. **Analytics and reports** — complete: UTC daily aggregation, explainable deterministic scoring, organization-scoped dashboards, rankings, usage and trend statistics, and audited CSV/XLSX/PDF exports.
7. **AI insights** — complete: replaceable weighted classification and statistical trend adapters, persisted recoverable jobs, explainable evidence, audited outcomes, completion notifications, and localized manager recommendations.
8. **Hardening and operations** — complete: HTTP E2E coverage, structured logs and correlation IDs, protected Prometheus metrics, liveness/readiness, rate limiting, verified fresh-database migrations, integrity-checked backup/restore, and lightweight systemd deployment without Docker.

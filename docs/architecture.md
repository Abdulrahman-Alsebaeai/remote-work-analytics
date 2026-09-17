# Architecture decisions

## Fixed system boundaries

These decisions are project constraints and must remain stable unless a documented, unavoidable technical reason requires a change:

- The manager interface is a browser-based web application only.
- Employees use a lightweight Windows desktop agent only.
- Only the desktop agent collects screenshots, active applications, website activity where technically available, idle time, keyboard activity level, mouse activity level, and work-session data.
- The manager web application never collects or attempts to collect desktop activity.
- The backend owns authentication, authorization, business logic, AI processing, reporting, notifications, and persistent data storage.
- Clients communicate with the backend through versioned contracts and never access MySQL directly.
- The manager web application, backend API, and desktop agent are independently deployable components. Runtime communication is exclusively through authenticated, encrypted, versioned REST APIs; no component imports another component's internal code or accesses its database.
- New technologies require a clear operational or maintainability benefit; the default is to extend the existing stack.
- Modules must preserve separation of concerns and may depend on other modules only through explicit public interfaces.
- The domain model is organization-aware from the start and must accommodate organizations, departments, teams, and additional roles without redesigning existing modules.

## Stack

NestJS provides a modular, testable API on Node.js LTS. Next.js will provide the browser portal. The Windows agent will use Tauri 2 with React when the Rust toolchain is introduced; Tauri's native shell keeps resource usage substantially below an Electron bundle. Prisma targets the required MySQL database and parameterizes all normal queries.

The Windows agent technology is approved and fixed as Tauri 2 with a Rust core, React/TypeScript UI, and an encrypted SQLite outbox. Native monitoring, credentials, synchronization, and update verification remain in Rust; the WebView receives only narrowly scoped IPC capabilities. Windows packages will be signed MSI/NSIS installers, with signed Tauri updates added when release infrastructure is available.

## Boundaries

Each backend feature owns its domain, application services, and infrastructure adapters. Controllers depend on services, and persistence stays behind repositories. Shared packages contain contracts only—not business logic or database entities.

REST contracts are the only integration boundary between deployable applications. Any shared contract definitions describe that public boundary only and must not expose implementation types. Generated OpenAPI clients may be used to keep clients type-safe without coupling their internals.

Monitoring is explicit-session only and runs exclusively in the Windows desktop agent. The future collector will be controlled by a single session state machine; ending or pausing a session cancels all collector jobs immediately. URL collection will require a separately disclosed browser integration because Windows cannot reliably expose browser URLs from window titles. The web application is a management and analytics client and has no monitoring capability.

## Offline synchronization

The desktop agent writes collected events to an encrypted local outbox before attempting upload. Synchronization uses bounded batches, retry with backoff, stable event identifiers, and idempotent REST endpoints. Temporary loss of connectivity must not stop an active work session or lose already collected data. Successfully acknowledged items are removed according to the local retention policy.

## Auditability

Important operations produce append-only audit events, including authentication attempts and token lifecycle, task changes, administrative actions, AI jobs and outcomes, and employee activity synchronization. Audit records include organization, actor, action, target, timestamp, result, and safe contextual metadata. Secrets, passwords, raw tokens, and sensitive captured content are never written to audit logs.

## Screenshot storage

Screenshot bytes are stored behind a storage-provider interface rather than in MySQL. The initial provider uses protected local storage; a cloud object-storage provider can replace it without changing application services. Images are compressed to an agreed format and quality, addressed by a cryptographic content hash to prevent duplicates, and referenced by metadata records with retention status. Downloads require authorization and short-lived access.

## AI isolation

AI classification and insight generation implement application-owned interfaces and run outside core domain rules. Core scoring inputs and outputs use stable contracts, jobs are asynchronous and auditable, and deterministic business behavior does not depend on a particular model or vendor. Models can therefore be upgraded or replaced without changing monitoring, task, reporting, or identity modules.

## Modularity rule

Modules are highly cohesive and loosely coupled. Cross-module work goes through explicit application interfaces or domain events; infrastructure adapters remain replaceable. A separate service, broker, or additional datastore is introduced only when measured requirements justify its operational cost.

## Privacy and security

The product must display monitoring status, obtain organizational/employee consent, enforce retention, encrypt transport and storage, redact sensitive windows, and record audit events. Screenshots belong in private object storage using short-lived signed URLs, never in MySQL or a public directory.

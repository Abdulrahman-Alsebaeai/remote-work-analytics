# Production operations

## Lightweight deployment

Docker is not required. Deploy the API and manager web application as separate Node.js services and use a managed or existing MySQL 8.4 server.

1. Install Node.js 22 LTS and MySQL client tools on the application host.
2. Create an unprivileged `remote-work` service account and place a versioned release in `/opt/remote-work-analytics`.
3. Run `npm ci`, `npm run db:generate`, `npm test`, `npm run lint`, and `npm run build`. Then run `npm prune --omit=dev` on the production release.
4. Copy the example systemd units from `deploy/systemd`, copy `deploy/api.env.example` and `deploy/web.env.example` to protected files under `/etc/remote-work`, replace all example values, then enable both services.
5. Terminate TLS at an existing trusted reverse proxy or load balancer. Bind Node services to private interfaces and expose only HTTPS publicly.
6. Verify readiness, manager login, report export, and an employee-agent synchronization after every release.

The API service applies committed Prisma migrations before it starts. API and web remain independent processes and communicate only through REST.

For a database previously created with `prisma db push`, back it up and mark only migrations already represented in that database using `prisma migrate resolve --applied <migration-name>`. Never mark an unapplied migration as applied.

## Monitoring

- Liveness: `GET /api/v1/health/live`
- Readiness: `GET /api/v1/health/ready`
- Prometheus metrics: `GET /api/v1/metrics` with `Authorization: Bearer $METRICS_TOKEN`
- Logs are JSON lines and every HTTP response includes `X-Request-Id`.

Alert on readiness failures, repeated 5xx responses, latency, AI job failures, storage capacity, and failed backups. Never log tokens, passwords, screenshot content, or raw activity payloads.

The built-in limiter is intentionally process-local and suitable for the single lightweight API service. If multiple API instances are introduced later, place a shared limiter at the existing reverse proxy or provide a distributed throttler storage adapter.

## Backup and restore

Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `SCREENSHOT_STORAGE_PATH`, then run:

```powershell
.\scripts\backup.ps1 -BackupRoot D:\ProtectedBackups -RetentionCount 14
```

Each backup contains a transactional SQL dump, screenshot archive, sizes, and a SHA-256 manifest. Store a copy in encrypted off-site storage and test restoration regularly in an isolated environment.

Restoration overwrites database contents. Stop API workers, verify the target, and explicitly authorize it:

```powershell
.\scripts\restore.ps1 -BackupPath D:\ProtectedBackups\20260803T010000Z -ConfirmRestore
```

The previous screenshot directory remains under a `.before-restore-*` name. Run readiness and authorized sample-download checks before restoring traffic.

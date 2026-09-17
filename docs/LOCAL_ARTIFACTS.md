# Local-only artifacts

The transfer package contained local runtime data and generated deliverables that are intentionally excluded from the public source repository: real `.env` files, runtime logs, private screenshot storage, database backups/dumps, and prebuilt Windows installer executables.

Use `.env.example` / `.env.production.example`, Prisma migrations, seed scripts, and the documented build commands to reproduce a clean environment.

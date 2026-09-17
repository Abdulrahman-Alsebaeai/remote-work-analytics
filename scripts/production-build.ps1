$ErrorActionPreference = 'Stop'
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
npm run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma generation failed.' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
Write-Output 'Verified production build completed. Deploy the repository release and run npm prune --omit=dev on the target host.'

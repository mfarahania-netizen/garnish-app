Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$env:REVIEW_SEED = "1"
pnpm.cmd exec prisma db seed

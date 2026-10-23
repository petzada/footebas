# Creates the Cloudflare Hyperdrive config that connects the API Worker to
# Supabase Postgres (session pooler). The password is read masked and never
# written to disk. Usage: & .\scripts\create-hyperdrive.ps1
$ErrorActionPreference = 'Stop'
$projectRef = 'wjisqiiwsuykfbmqglfb'
$poolerHost = 'aws-0-us-east-1.pooler.supabase.com'

$secure = Read-Host -AsSecureString 'Senha do banco do projeto footebas (Supabase)'
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$encoded = [Uri]::EscapeDataString($plain)
$connection = "postgresql://postgres.${projectRef}:${encoded}@${poolerHost}:5432/postgres"

Push-Location (Join-Path $PSScriptRoot '..\apps\api')
try {
  pnpm exec wrangler hyperdrive create footebas-db --connection-string="$connection"
} finally {
  Pop-Location
  $plain = $null
  $connection = $null
}

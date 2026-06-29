param(
  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [Parameter(Mandatory = $true)]
  [string]$ExportDir,

  [string]$PostgresUser = "clinic_user",

  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$manifestPath = Join-Path $ExportDir "manifest.json"
if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found in $ExportDir"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.tenantId -ne $TenantId) {
  throw "Manifest tenantId $($manifest.tenantId) does not match $TenantId"
}

foreach ($entry in $manifest.files) {
  $csvPath = $entry.path
  if (-not (Test-Path $csvPath)) {
    Write-Warning "Missing export file: $csvPath"
    continue
  }

  $container = switch ($entry.database) {
    "clinic_db" { "postgres_clinic" }
    "user_db" { "postgres_user" }
    "appointment_db" { "postgres_appointment" }
    "scheduling_db" { "postgres_scheduling" }
    "notification_db" { "postgres_notification" }
    "reminder_db" { "postgres_reminder" }
    "emr_db" { "postgres_emr" }
    "ai_db" { "postgres_ai" }
    default { throw "Unknown database $($entry.database)" }
  }

  $table = $entry.table
  Write-Host "$(if ($DryRun) { '[dry-run] ' })Restoring $table into $($entry.database)..."

  if ($DryRun) { continue }

  $deleteSql = if ($table -eq "tenants") {
    "DELETE FROM `"$table`" WHERE id = '$TenantId';"
  } else {
    "DELETE FROM `"$table`" WHERE tenant_id = '$TenantId';"
  }
  docker exec -i $container psql -U $PostgresUser -d $entry.database -c $deleteSql | Out-Null

  Get-Content $csvPath -Raw | docker exec -i $container psql -U $PostgresUser -d $entry.database -c "\copy `"$table`" FROM STDIN WITH CSV HEADER"
}

Write-Host "Tenant restore complete for $TenantId"

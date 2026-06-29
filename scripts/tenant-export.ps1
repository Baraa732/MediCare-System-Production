param(
  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [string]$OutputDir = ".\tenant-exports\$TenantId",

  [string]$PostgresUser = "clinic_user"
)

$ErrorActionPreference = "Stop"

$databases = @(
  @{ Container = "postgres_clinic"; Db = "clinic_db"; Tables = @(
      @{ Name = "tenants"; Filter = "id = '$TenantId'" },
      @{ Name = "tenant_staff_assignments"; Filter = "tenant_id = '$TenantId'" }
    ) },
  @{ Container = "postgres_user"; Db = "user_db"; Tables = @(
      @{ Name = "users"; Filter = "tenant_id = '$TenantId'" }
    ) },
  @{ Container = "postgres_appointment"; Db = "appointment_db"; Tables = @(
      @{ Name = "appointments"; Filter = "tenant_id = '$TenantId'" }
    ) },
  @{ Container = "postgres_scheduling"; Db = "scheduling_db"; Tables = @(
      @{ Name = "doctor_schedules"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "schedule_exceptions"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "schedule_slots"; Filter = "tenant_id = '$TenantId'" }
    ) },
  @{ Container = "postgres_notification"; Db = "notification_db"; Tables = @(
      @{ Name = "notification_logs"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "staff_inbox_notifications"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "push_device_tokens"; Filter = "tenant_id = '$TenantId'" }
    ) },
  @{ Container = "postgres_reminder"; Db = "reminder_db"; Tables = @(
      @{ Name = "scheduled_reminders"; Filter = "tenant_id = '$TenantId'" }
    ) },
  @{ Container = "postgres_emr"; Db = "emr_db"; Tables = @(
      @{ Name = "patient_emr_links"; Filter = "tenant_id = '$TenantId'" }
    ) },
  @{ Container = "postgres_ai"; Db = "ai_db"; Tables = @(
      @{ Name = "ai_conversation_threads"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "ai_conversation_messages"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "ai_conversation_summaries"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "ai_patient_consents"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "ai_memory_audit_log"; Filter = "tenant_id = '$TenantId'" },
      @{ Name = "ai_requests"; Filter = "tenant_id = '$TenantId'" }
    ) }
)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$manifest = @{
  tenantId = $TenantId
  exportedAt = (Get-Date).ToUniversalTime().ToString("o")
  files = @()
}

foreach ($db in $databases) {
  $dbDir = Join-Path $OutputDir $db.Db
  New-Item -ItemType Directory -Force -Path $dbDir | Out-Null

  foreach ($table in $db.Tables) {
    $tableName = $table.Name
    $filter = $table.Filter
    $outFile = Join-Path $dbDir "$tableName.csv"
    $sql = "COPY (SELECT * FROM `"$tableName`" WHERE $filter) TO STDOUT WITH CSV HEADER"

    docker exec -i $db.Container psql -U $PostgresUser -d $db.Db -c $sql | Set-Content -Encoding utf8 $outFile

    $manifest.files += @{
      database = $db.Db
      table = $tableName
      path = (Resolve-Path $outFile).Path
    }
  }
}

$manifestPath = Join-Path $OutputDir "manifest.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $manifestPath
Write-Host "Tenant export complete: $OutputDir"

import PlaceholderPage from './PlaceholderPage'

export { default as InfrastructurePage } from './InfrastructurePage'
export { default as TracingPage } from './TracingPage'
export { default as DatabasesPage } from './DatabasesPage'
export { default as QueuesPage } from './QueuesPage'
export { default as SystemHealthPage } from './SystemHealthPage'
export { default as PerformancePage } from './PerformancePage'
export { default as NetworkPage } from './NetworkPage'
export { default as SecurityPage } from './SecurityPage'

export function BackupsPage() {
  return <PlaceholderPage title="Backups" description="Backup jobs and restore points shell." />
}

export function AuditPage() {
  return <PlaceholderPage title="Audit Logs" description="Compliance and audit trail shell." />
}

export function BillingPage() {
  return <PlaceholderPage title="Billing" description="Plan and usage shell." />
}

export function ConfigurationPage() {
  return <PlaceholderPage title="Configuration" description="Platform configuration shell." />
}

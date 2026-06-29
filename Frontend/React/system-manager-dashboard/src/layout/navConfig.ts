import {
  LayoutDashboard, KeyRound, Building2, Users, ShieldCheck,
  Activity, FileText, Cpu, Radio, Settings, BookOpen, Layers, Bell, BarChart3, Network,
} from 'lucide-react'

export interface NavItem {
  label: string
  icon: typeof LayoutDashboard
  path: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'Business Intelligence', icon: BarChart3, path: '/bi' },
    ],
  },
  {
    label: 'Observability',
    items: [
      { label: 'Logs', icon: FileText, path: '/logs' },
      { label: 'Metrics', icon: Activity, path: '/metrics' },
      { label: 'Services', icon: Cpu, path: '/apm' },
      { label: 'Service Map', icon: Network, path: '/observability/service-map' },
    ],
  },
  {
    label: 'Incidents',
    items: [
      { label: 'Alerts', icon: Bell, path: '/alerts' },
      { label: 'Monitors', icon: Radio, path: '/monitors' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Clinics',          icon: Building2,   path: '/clinics' },
      { label: 'Platform Users',   icon: Users,       path: '/users' },
      { label: 'Activation Codes', icon: KeyRound,    path: '/activation-codes' },
      { label: 'Administrators',   icon: ShieldCheck, path: '/administrators' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Integrations', icon: Layers,   path: '/integrations' },
      { label: 'Settings',     icon: Settings, path: '/settings' },
    ],
  },
  {
    label: 'Developer',
    items: [
      { label: 'Docs', icon: BookOpen, path: '/docs' },
    ],
  },
]

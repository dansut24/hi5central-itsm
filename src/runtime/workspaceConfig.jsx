import {
  AlertCircle,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Database,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'

export const statusOptions = [
  'New', 'Assigned', 'Draft', 'Pending Approval', 'Approved', 'CAB Review',
  'Scheduled', 'Under Investigation', 'Known Error', 'In Progress',
  'Fix in Progress', 'Pending', 'Review', 'Completed', 'Resolved', 'Failed',
  'Closed', 'Monitoring',
]

export const viewMeta = {
  home: { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  newtab: { id: 'newtab', label: 'New Tab', icon: Plus },
  newrecord: { id: 'newrecord', label: 'New Record', icon: Plus },
  tickets: { id: 'tickets', label: 'All Records', icon: Inbox },
  incidents: { id: 'incidents', label: 'Incidents', icon: AlertCircle },
  requests: { id: 'requests', label: 'Service Requests', icon: BriefcaseBusiness },
  problems: { id: 'problems', label: 'Problems', icon: ShieldCheck },
  portal: { id: 'portal', label: 'Self-Service', icon: LifeBuoy },
  changes: { id: 'changes', label: 'Changes', icon: ClipboardCheck },
  calendar: { id: 'calendar', label: 'Calendar', icon: CalendarRange },
  projects: { id: 'projects', label: 'Projects', icon: FolderKanban },
  rota: { id: 'rota', label: 'Rota & Availability', icon: CalendarDays },
  people: { id: 'people', label: 'People', icon: Users },
  cmdb: { id: 'cmdb', label: 'CMDB', icon: Database },
  knowledge: { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  livechat: { id: 'livechat', label: 'Live Chat', icon: MessageCircle },
  reports: { id: 'reports', label: 'Reports', icon: BarChart3 },
  settings: { id: 'settings', label: 'Settings', icon: Settings },
  profile: { id: 'profile', label: 'Profile', icon: Users },
}

export const serviceDeskModules = {
  incidents: { id: 'incidents', type: 'Incident', label: 'Incidents', singular: 'Incident', queueTitle: 'Incident Queue', createTitle: 'New Incident', createLabel: 'Create Incident', searchPlaceholder: 'Incident, requester, service' },
  requests: { id: 'requests', type: 'Service Request', label: 'Service Requests', singular: 'Service Request', queueTitle: 'Service Request Queue', createTitle: 'New Service Request', createLabel: 'Create Request', searchPlaceholder: 'Request, requester, service' },
  problems: { id: 'problems', type: 'Problem', label: 'Problems', singular: 'Problem', queueTitle: 'Problem Queue', createTitle: 'New Problem', createLabel: 'Create Problem', searchPlaceholder: 'Problem, requester, service' },
}

export const analystNavGroups = [
  { id: 'workspace', items: ['home'] },
  { id: 'service-desk', label: 'Service Desk', items: ['incidents', 'requests', 'problems', 'changes'] },
  { id: 'planning', label: 'Planning', items: ['calendar', 'projects', 'rota'] },
  { id: 'organisation', label: 'Organisation', items: ['people'] },
  { id: 'knowledge-data', label: 'Knowledge & Data', items: ['knowledge', 'cmdb'] },
  { id: 'insights', label: 'Insights', items: ['reports'] },
  { id: 'administration', items: ['settings'], separated: true },
]

export const analystNavIds = analystNavGroups.flatMap((group) => group.items)
export const accentOptions = [
  { id: 'amber', label: 'Amber', value: '#f4b13d' },
  { id: 'cyan', label: 'Cyan', value: '#15bfe8' },
  { id: 'blue', label: 'Blue', value: '#4b7ff5' },
  { id: 'violet', label: 'Violet', value: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', value: '#2eb67d' },
  { id: 'rose', label: 'Rose', value: '#ef6a8a' },
]

// UI metadata only. Authentication identities always come from the tenant API.
export const workspaceLoginProfiles = {
  analyst: { label: 'Agent Workspace', role: 'analyst', username: '', password: '', helper: 'Sign in with an account assigned to this tenant.' },
  requester: { label: 'Self-Service Portal', role: 'requester', username: '', password: '', helper: 'Sign in with your organisation account.' },
  rmm: { label: 'RMM Console', role: 'rmm', username: '', password: '', helper: 'Sign in with an account assigned to this tenant.' },
}

export const workspaceUsers = []
export const incidentServices = [
  { name: 'Collaboration', categories: ['Email & Messaging', 'Microsoft Teams', 'SharePoint & OneDrive'] },
  { name: 'Identity', categories: ['Sign-in & MFA', 'User Account', 'Permissions'] },
  { name: 'Hardware', categories: ['Laptop or Desktop', 'Peripheral', 'Printer'] },
  { name: 'Network Security', categories: ['VPN', 'Firewall', 'Secure Connectivity'] },
  { name: 'Wireless', categories: ['Corporate Wi-Fi', 'Guest Wi-Fi', 'Roaming'] },
  { name: 'Access', categories: ['Application Access', 'Shared Resource', 'Privileged Access'] },
]
export const priorities = ['Critical', 'High', 'Medium', 'Low']
export const types = ['Incident', 'Service Request', 'Change', 'Problem']

// Runtime collections start empty and are hydrated from tenant APIs/caches.
export const assets = []
export const knowledgeArticles = []
export const serviceCatalog = []
export const teams = []

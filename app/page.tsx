'use client'

import React, { useState, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { useScheduler, cronToHuman, getScheduleLogs, pauseSchedule, resumeSchedule, triggerScheduleNow } from '@/lib/scheduler'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2, Send, Search, ClipboardList, BarChart3, Bell, Calendar, Clock,
  CheckCircle2, XCircle, AlertTriangle, Info, DollarSign,
  Users, FileText, TrendingUp, RefreshCw, Play, Pause, ChevronRight,
  Building2, Package, Zap, Shield, Mail, User
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────
const AGENT_ID = '699f2236d19ec1f1c4d3e715'
const SCHEDULE_ID = '699f223e399dfadeac398cdf'

// ── Theme ──────────────────────────────────────────────────────────────────────
const THEME_VARS = {
  '--background': '222 47% 6%',
  '--foreground': '210 40% 98%',
  '--card': '222 47% 9%',
  '--card-foreground': '210 40% 98%',
  '--primary': '225 75% 57%',
  '--primary-foreground': '210 40% 98%',
  '--secondary': '217 33% 17%',
  '--secondary-foreground': '210 40% 98%',
  '--muted': '217 33% 17%',
  '--muted-foreground': '215 20% 65%',
  '--accent': '217 33% 17%',
  '--accent-foreground': '210 40% 98%',
  '--destructive': '0 63% 50%',
  '--destructive-foreground': '210 40% 98%',
  '--border': '217 33% 20%',
  '--input': '217 33% 20%',
  '--ring': '225 75% 57%',
  '--radius': '0.5rem',
} as React.CSSProperties

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface PODetails {
  po_number?: string
  requester?: string
  department?: string
  amount?: number
  vendor?: string
  vendor_status?: string
  description?: string
  priority?: string
  category?: string
  submission_date?: string
  estimated_completion?: string
}

interface ApprovalStep {
  step?: number
  approver_name?: string
  approver_role?: string
  status?: string
  notes?: string
}

interface AlertItem {
  type?: string
  message?: string
}

interface PendingApprover {
  name?: string
  role?: string
  email?: string
  days_pending?: number
  reminder_sent?: boolean
}

interface ReminderDetails {
  pending_approvers?: PendingApprover[]
  reminder_message?: string
}

interface DepartmentBreakdown {
  department?: string
  count?: number
  total_amount?: number
}

interface DashboardSummary {
  total_pos?: number
  pending_approval?: number
  approved?: number
  rejected?: number
  total_amount?: number
  average_approval_time?: string
  urgent_pos?: number
  department_breakdown?: DepartmentBreakdown[]
}

interface POApprovalResponse {
  action_type?: string
  po_details?: PODetails
  approval_chain?: ApprovalStep[]
  current_status?: string
  approval_progress?: number
  alerts?: AlertItem[]
  reminder_details?: ReminderDetails
  dashboard_summary?: DashboardSummary
  message?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

function getStatusColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'approved': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'pending': case 'pending_approval': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'rejected': return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'escalated': return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    case 'on_hold': return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
    case 'draft': return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    case 'skipped': return 'bg-gray-500/15 text-gray-400 border-gray-500/30'
    default: return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  }
}

function getAlertVariant(type?: string) {
  switch (type?.toLowerCase()) {
    case 'error': return { icon: <XCircle className="h-4 w-4 text-red-400" />, cls: 'border-red-500/30 bg-red-500/10' }
    case 'warning': return { icon: <AlertTriangle className="h-4 w-4 text-amber-400" />, cls: 'border-amber-500/30 bg-amber-500/10' }
    case 'reminder': return { icon: <Bell className="h-4 w-4 text-blue-400" />, cls: 'border-blue-500/30 bg-blue-500/10' }
    default: return { icon: <Info className="h-4 w-4 text-sky-400" />, cls: 'border-sky-500/30 bg-sky-500/10' }
  }
}

function getPriorityColor(priority?: string): string {
  switch (priority?.toLowerCase()) {
    case 'urgent': return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'high': return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    case 'medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'low': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }
}

function formatCurrency(amount?: number): string {
  if (amount == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// ── Sample Data ────────────────────────────────────────────────────────────────
const SAMPLE_SUBMIT_RESPONSE: POApprovalResponse = {
  action_type: 'submit_po',
  po_details: {
    po_number: 'PO-2026-00847',
    requester: 'Sarah Chen',
    department: 'IT',
    amount: 24500,
    vendor: 'Dell Technologies',
    vendor_status: 'preferred',
    description: 'Procurement of 10 Dell Latitude 7450 laptops for new engineering team members',
    priority: 'high',
    category: 'hardware',
    submission_date: '2026-02-25',
    estimated_completion: '2026-03-03',
  },
  approval_chain: [
    { step: 1, approver_name: 'Michael Torres', approver_role: 'IT Manager', status: 'approved', notes: 'Approved - within quarterly budget allocation' },
    { step: 2, approver_name: 'Jennifer Walsh', approver_role: 'Finance Director', status: 'pending', notes: '' },
    { step: 3, approver_name: 'David Kim', approver_role: 'VP of Operations', status: 'pending', notes: '' },
  ],
  current_status: 'pending_approval',
  approval_progress: 33,
  alerts: [
    { type: 'info', message: 'PO-2026-00847 has been submitted and is now in the approval queue.' },
    { type: 'warning', message: 'Amount exceeds $20,000 threshold - requires VP-level approval.' },
  ],
  message: 'Purchase Order PO-2026-00847 has been submitted successfully. It requires 3-level approval due to the amount exceeding $20,000. Currently pending Finance Director review.',
}

const SAMPLE_STATUS_RESPONSE: POApprovalResponse = {
  action_type: 'check_status',
  po_details: {
    po_number: 'PO-2026-00612',
    requester: 'Alex Rivera',
    department: 'Marketing',
    amount: 8750,
    vendor: 'Adobe Systems',
    vendor_status: 'preferred',
    description: 'Annual renewal of Adobe Creative Cloud Enterprise licenses (25 seats)',
    priority: 'medium',
    category: 'software',
    submission_date: '2026-02-20',
    estimated_completion: '2026-02-27',
  },
  approval_chain: [
    { step: 1, approver_name: 'Lisa Park', approver_role: 'Marketing Manager', status: 'approved', notes: 'Approved - standard renewal' },
    { step: 2, approver_name: 'Robert Chen', approver_role: 'Finance Manager', status: 'approved', notes: 'Within budget. Approved.' },
  ],
  current_status: 'approved',
  approval_progress: 100,
  alerts: [
    { type: 'info', message: 'PO-2026-00612 has been fully approved and is ready for processing.' },
  ],
  message: 'Purchase Order PO-2026-00612 has been fully approved. All approvers have signed off. The order is ready for vendor processing.',
}

const SAMPLE_DASHBOARD_RESPONSE: POApprovalResponse = {
  action_type: 'dashboard',
  dashboard_summary: {
    total_pos: 156,
    pending_approval: 23,
    approved: 118,
    rejected: 15,
    total_amount: 1842650.75,
    average_approval_time: '2.4 business days',
    urgent_pos: 4,
    department_breakdown: [
      { department: 'IT', count: 42, total_amount: 567300 },
      { department: 'Marketing', count: 28, total_amount: 234100 },
      { department: 'Operations', count: 35, total_amount: 412500 },
      { department: 'R&D', count: 22, total_amount: 389200 },
      { department: 'Finance', count: 14, total_amount: 128750 },
      { department: 'HR', count: 15, total_amount: 110800 },
    ],
  },
  alerts: [
    { type: 'warning', message: '4 urgent POs require immediate attention.' },
    { type: 'reminder', message: '7 POs have been pending for more than 3 business days.' },
  ],
  message: 'Dashboard summary as of February 25, 2026. 23 POs are currently pending approval with a total value of $1,842,650.75.',
}

const SAMPLE_REMINDER_RESPONSE: POApprovalResponse = {
  action_type: 'send_reminder',
  reminder_details: {
    pending_approvers: [
      { name: 'Jennifer Walsh', role: 'Finance Director', email: 'j.walsh@company.com', days_pending: 3, reminder_sent: true },
      { name: 'David Kim', role: 'VP of Operations', email: 'd.kim@company.com', days_pending: 2, reminder_sent: true },
      { name: 'Maria Santos', role: 'HR Director', email: 'm.santos@company.com', days_pending: 5, reminder_sent: false },
      { name: 'James Liu', role: 'CTO', email: 'j.liu@company.com', days_pending: 1, reminder_sent: true },
    ],
    reminder_message: 'Reminder notifications have been sent to 3 out of 4 pending approvers. Maria Santos could not be reached - please follow up manually.',
  },
  alerts: [
    { type: 'warning', message: 'Maria Santos has not responded for 5 business days. Consider escalation.' },
    { type: 'info', message: 'Reminders successfully sent to 3 approvers.' },
  ],
  message: 'Reminder check complete. 4 approvers have pending POs. Automated reminders sent to 3 approvers. 1 requires manual follow-up.',
}

// ── Sub-Components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const label = (status ?? 'unknown').replace(/_/g, ' ')
  return (
    <Badge variant="outline" className={`${getStatusColor(status)} capitalize text-xs`}>
      {label}
    </Badge>
  )
}

function PriorityBadge({ priority }: { priority?: string }) {
  return (
    <Badge variant="outline" className={`${getPriorityColor(priority)} capitalize text-xs`}>
      {priority ?? 'unknown'}
    </Badge>
  )
}

function PODetailsCard({ po }: { po?: PODetails }) {
  if (!po) return null
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-lg">{po.po_number ?? 'N/A'}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={po.priority} />
            <Badge variant="outline" className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-xs capitalize">
              {po.category ?? 'other'}
            </Badge>
          </div>
        </div>
        {po.description && <CardDescription className="mt-1 text-sm">{po.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Requester</span>
            <p className="font-medium">{po.requester ?? 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Department</span>
            <p className="font-medium">{po.department ?? 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Amount</span>
            <p className="font-bold text-emerald-400">{formatCurrency(po.amount)}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Vendor</span>
            <p className="font-medium">{po.vendor ?? 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Vendor Status</span>
            <Badge variant="outline" className={`text-xs capitalize ${po.vendor_status === 'preferred' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
              {po.vendor_status ?? 'N/A'}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Submitted</span>
            <p className="font-medium">{po.submission_date ?? 'N/A'}</p>
          </div>
          {po.estimated_completion && (
            <div>
              <span className="text-muted-foreground text-xs">Est. Completion</span>
              <p className="font-medium">{po.estimated_completion}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ApprovalTimeline({ chain, progress, status }: { chain?: ApprovalStep[], progress?: number, status?: string }) {
  const steps = Array.isArray(chain) ? chain : []
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            Approval Chain
          </CardTitle>
          {status && <StatusBadge status={status} />}
        </div>
        {progress != null && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-muted-foreground text-sm">No approval steps available.</p>
        ) : (
          <div className="relative">
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1
              const stepStatus = step.status?.toLowerCase()
              const isApproved = stepStatus === 'approved'
              const isRejected = stepStatus === 'rejected'
              const isSkipped = stepStatus === 'skipped'

              let iconNode: React.ReactNode
              let lineColor: string
              if (isApproved) {
                iconNode = <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                lineColor = 'bg-emerald-500/40'
              } else if (isRejected) {
                iconNode = <XCircle className="h-5 w-5 text-red-400" />
                lineColor = 'bg-red-500/40'
              } else if (isSkipped) {
                iconNode = <ChevronRight className="h-5 w-5 text-gray-400" />
                lineColor = 'bg-gray-500/40'
              } else {
                iconNode = <Clock className="h-5 w-5 text-amber-400" />
                lineColor = 'bg-border'
              }

              return (
                <div key={idx} className="relative flex gap-3 pb-6 last:pb-0">
                  {!isLast && (
                    <div className={`absolute left-[9px] top-7 w-0.5 h-[calc(100%-20px)] ${lineColor}`} />
                  )}
                  <div className="flex-shrink-0 mt-0.5 z-10">{iconNode}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{step.approver_name ?? 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">Step {step.step ?? idx + 1}</span>
                      <StatusBadge status={step.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.approver_role ?? ''}</p>
                    {step.notes && step.notes.trim() !== '' && (
                      <p className="text-xs mt-1 text-muted-foreground italic border-l-2 border-border pl-2">{step.notes}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AlertsDisplay({ alerts }: { alerts?: AlertItem[] }) {
  const items = Array.isArray(alerts) ? alerts : []
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.map((alert, idx) => {
        const v = getAlertVariant(alert.type)
        return (
          <Alert key={idx} className={`${v.cls} border`}>
            <div className="flex items-start gap-2">
              {v.icon}
              <AlertDescription className="text-sm">{alert.message ?? ''}</AlertDescription>
            </div>
          </Alert>
        )
      })}
    </div>
  )
}

function SummaryCard({ icon, label, value, sub, color }: { icon: React.ReactNode, label: string, value: string | number, sub?: string, color?: string }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-secondary/60">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function InlineMessage({ type, message }: { type: 'success' | 'error' | 'info', message: string }) {
  const cls = type === 'success'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
    : type === 'error'
    ? 'border-red-500/30 bg-red-500/10 text-red-400'
    : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  const icon = type === 'success'
    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
    : type === 'error'
    ? <XCircle className="h-4 w-4 flex-shrink-0" />
    : <Info className="h-4 w-4 flex-shrink-0" />
  return (
    <div className={`flex items-center gap-2 text-sm border rounded-lg p-3 ${cls}`}>
      {icon}
      <span>{message}</span>
    </div>
  )
}

// ── ErrorBoundary ──────────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Page Component ─────────────────────────────────────────────────────────────

export default function Page() {
  // ── State ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('submit')
  const [showSample, setShowSample] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Submit PO
  const [submitForm, setSubmitForm] = useState({
    requester: '', department: '', amount: '', vendor: '',
    vendorStatus: '', description: '', priority: '', category: '',
  })
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitResult, setSubmitResult] = useState<POApprovalResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Track Status
  const [searchQuery, setSearchQuery] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusResult, setStatusResult] = useState<POApprovalResponse | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Dashboard
  const [dashLoading, setDashLoading] = useState(false)
  const [dashResult, setDashResult] = useState<POApprovalResponse | null>(null)
  const [dashError, setDashError] = useState<string | null>(null)

  // Reminders
  const [reminderLoading, setReminderLoading] = useState(false)
  const [reminderResult, setReminderResult] = useState<POApprovalResponse | null>(null)
  const [reminderError, setReminderError] = useState<string | null>(null)

  // Schedule
  const [scheduleId] = useState(SCHEDULE_ID)
  const { schedules, loading: schedLoading, fetchSchedules } = useScheduler()
  const [schedLogs, setSchedLogs] = useState<any[]>([])
  const [schedLogsLoading, setSchedLogsLoading] = useState(false)
  const [schedActionLoading, setSchedActionLoading] = useState(false)
  const [schedMessage, setSchedMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [triggerLoading, setTriggerLoading] = useState(false)

  // ── Computed ─────────────────────────────────────────────────────────────────
  const currentSchedule = schedules.find((s: any) => s.id === scheduleId)

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSchedules()
  }, [])

  useEffect(() => {
    if (showSample) {
      setSubmitResult(SAMPLE_SUBMIT_RESPONSE)
      setStatusResult(SAMPLE_STATUS_RESPONSE)
      setDashResult(SAMPLE_DASHBOARD_RESPONSE)
      setReminderResult(SAMPLE_REMINDER_RESPONSE)
      setSubmitForm({
        requester: 'Sarah Chen', department: 'IT', amount: '24500', vendor: 'Dell Technologies',
        vendorStatus: 'preferred', description: 'Procurement of 10 Dell Latitude 7450 laptops for new engineering team members',
        priority: 'high', category: 'hardware',
      })
      setSearchQuery('PO-2026-00612')
    } else {
      setSubmitResult(null)
      setStatusResult(null)
      setDashResult(null)
      setReminderResult(null)
    }
    setSubmitError(null)
    setStatusError(null)
    setDashError(null)
    setReminderError(null)
  }, [showSample])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSubmitPO = async () => {
    if (!submitForm.requester || !submitForm.department || !submitForm.amount) return
    setSubmitLoading(true)
    setSubmitError(null)
    setSubmitResult(null)
    setActiveAgentId(AGENT_ID)

    const message = `Submit a new Purchase Order with the following details:
Requester: ${submitForm.requester}
Department: ${submitForm.department}
Amount: $${submitForm.amount}
Vendor: ${submitForm.vendor}
Vendor Status: ${submitForm.vendorStatus}
Description: ${submitForm.description}
Priority: ${submitForm.priority}
Category: ${submitForm.category}`

    try {
      const result = await callAIAgent(message, AGENT_ID)
      if (result.success && result.response?.status === 'success') {
        setSubmitResult(result.response.result as POApprovalResponse)
      } else {
        setSubmitError(result.response?.message || result.error || 'Failed to submit PO')
      }
    } catch (err: any) {
      setSubmitError(err?.message ?? 'An unexpected error occurred')
    }
    setActiveAgentId(null)
    setSubmitLoading(false)
  }

  const handleCheckStatus = async () => {
    if (!searchQuery.trim()) return
    setStatusLoading(true)
    setStatusError(null)
    setStatusResult(null)
    setActiveAgentId(AGENT_ID)

    const message = `Check the status of Purchase Order: ${searchQuery.trim()}`

    try {
      const result = await callAIAgent(message, AGENT_ID)
      if (result.success && result.response?.status === 'success') {
        setStatusResult(result.response.result as POApprovalResponse)
      } else {
        setStatusError(result.response?.message || result.error || 'Failed to check status')
      }
    } catch (err: any) {
      setStatusError(err?.message ?? 'An unexpected error occurred')
    }
    setActiveAgentId(null)
    setStatusLoading(false)
  }

  const handleDashboard = async () => {
    setDashLoading(true)
    setDashError(null)
    setDashResult(null)
    setActiveAgentId(AGENT_ID)

    const message = 'Show the dashboard summary of all purchase orders including department breakdown, pending counts, and total amounts.'

    try {
      const result = await callAIAgent(message, AGENT_ID)
      if (result.success && result.response?.status === 'success') {
        setDashResult(result.response.result as POApprovalResponse)
      } else {
        setDashError(result.response?.message || result.error || 'Failed to load dashboard')
      }
    } catch (err: any) {
      setDashError(err?.message ?? 'An unexpected error occurred')
    }
    setActiveAgentId(null)
    setDashLoading(false)
  }

  const handleReminders = async () => {
    setReminderLoading(true)
    setReminderError(null)
    setReminderResult(null)
    setActiveAgentId(AGENT_ID)

    const message = 'Review all pending purchase orders and send reminder notifications to approvers who have POs pending for more than 24 hours. List all pending POs with their current approval status, pending approver details, and days waiting.'

    try {
      const result = await callAIAgent(message, AGENT_ID)
      if (result.success && result.response?.status === 'success') {
        setReminderResult(result.response.result as POApprovalResponse)
      } else {
        setReminderError(result.response?.message || result.error || 'Failed to check reminders')
      }
    } catch (err: any) {
      setReminderError(err?.message ?? 'An unexpected error occurred')
    }
    setActiveAgentId(null)
    setReminderLoading(false)
  }

  const handleLoadLogs = async () => {
    setSchedLogsLoading(true)
    try {
      const logs = await getScheduleLogs(scheduleId)
      setSchedLogs(Array.isArray(logs) ? logs : [])
    } catch {
      setSchedLogs([])
    }
    setSchedLogsLoading(false)
  }

  const handleToggleSchedule = async () => {
    if (!currentSchedule) return
    setSchedActionLoading(true)
    setSchedMessage(null)

    try {
      if (currentSchedule.is_active) {
        await pauseSchedule(scheduleId)
        setSchedMessage({ type: 'success', text: 'Schedule paused successfully.' })
      } else {
        await resumeSchedule(scheduleId)
        setSchedMessage({ type: 'success', text: 'Schedule activated successfully.' })
      }
      await fetchSchedules()
    } catch (err: any) {
      setSchedMessage({ type: 'error', text: err?.message ?? 'Failed to update schedule' })
      await fetchSchedules()
    }
    setSchedActionLoading(false)
  }

  const handleTriggerNow = async () => {
    setTriggerLoading(true)
    setSchedMessage(null)
    try {
      await triggerScheduleNow(scheduleId)
      setSchedMessage({ type: 'success', text: 'Schedule triggered manually. Check logs for results.' })
      await handleLoadLogs()
    } catch (err: any) {
      setSchedMessage({ type: 'error', text: err?.message ?? 'Failed to trigger schedule' })
    }
    setTriggerLoading(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div style={THEME_VARS} className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">PO Approval Workflow Manager</h1>
                  <p className="text-xs text-muted-foreground">Multi-level purchase order approval system</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
                <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-secondary/50 mb-6 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="submit" className="gap-1.5 text-xs sm:text-sm">
                <Send className="h-3.5 w-3.5" /> Submit PO
              </TabsTrigger>
              <TabsTrigger value="status" className="gap-1.5 text-xs sm:text-sm">
                <Search className="h-3.5 w-3.5" /> Track Status
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm">
                <BarChart3 className="h-3.5 w-3.5" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="reminders" className="gap-1.5 text-xs sm:text-sm">
                <Bell className="h-3.5 w-3.5" /> Reminders
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1.5 text-xs sm:text-sm">
                <Calendar className="h-3.5 w-3.5" /> Schedule
              </TabsTrigger>
            </TabsList>

            {/* ── Submit PO Tab ──────────────────────────────────────────── */}
            <TabsContent value="submit" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-blue-400" />
                    New Purchase Order
                  </CardTitle>
                  <CardDescription>Fill in the details below to submit a new purchase order for approval.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="requester">Requester Name *</Label>
                      <Input id="requester" placeholder="e.g. Sarah Chen" value={submitForm.requester} onChange={(e) => setSubmitForm(prev => ({ ...prev, requester: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="department">Department *</Label>
                      <Select value={submitForm.department} onValueChange={(v) => setSubmitForm(prev => ({ ...prev, department: v }))}>
                        <SelectTrigger id="department"><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>
                          {['IT', 'Marketing', 'Finance', 'R&D', 'Operations', 'HR', 'Legal', 'Sales'].map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Amount (USD) *</Label>
                      <Input id="amount" type="number" placeholder="e.g. 15000" value={submitForm.amount} onChange={(e) => setSubmitForm(prev => ({ ...prev, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vendor">Vendor Name</Label>
                      <Input id="vendor" placeholder="e.g. Dell Technologies" value={submitForm.vendor} onChange={(e) => setSubmitForm(prev => ({ ...prev, vendor: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vendorStatus">Vendor Status</Label>
                      <Select value={submitForm.vendorStatus} onValueChange={(v) => setSubmitForm(prev => ({ ...prev, vendorStatus: v }))}>
                        <SelectTrigger id="vendorStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New Vendor</SelectItem>
                          <SelectItem value="preferred">Preferred Vendor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={submitForm.priority} onValueChange={(v) => setSubmitForm(prev => ({ ...prev, priority: v }))}>
                        <SelectTrigger id="priority"><SelectValue placeholder="Select priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="category">Category</Label>
                      <Select value={submitForm.category} onValueChange={(v) => setSubmitForm(prev => ({ ...prev, category: v }))}>
                        <SelectTrigger id="category"><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hardware">Hardware</SelectItem>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="services">Services</SelectItem>
                          <SelectItem value="supplies">Supplies</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" placeholder="Describe the purchase order..." rows={3} value={submitForm.description} onChange={(e) => setSubmitForm(prev => ({ ...prev, description: e.target.value }))} />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSubmitPO} disabled={submitLoading || !submitForm.requester || !submitForm.department || !submitForm.amount} className="gap-2">
                    {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitLoading ? 'Submitting...' : 'Submit Purchase Order'}
                  </Button>
                </CardFooter>
              </Card>

              {submitError && <InlineMessage type="error" message={submitError} />}

              {submitResult && (
                <div className="space-y-4">
                  {submitResult.message && (
                    <Card className="border-border bg-card">
                      <CardContent className="pt-5">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">{renderMarkdown(submitResult.message)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <PODetailsCard po={submitResult.po_details} />
                  <ApprovalTimeline chain={submitResult.approval_chain} progress={submitResult.approval_progress} status={submitResult.current_status} />
                  <AlertsDisplay alerts={submitResult.alerts} />
                </div>
              )}
            </TabsContent>

            {/* ── Track Status Tab ───────────────────────────────────────── */}
            <TabsContent value="status" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="h-5 w-5 text-blue-400" />
                    Track Purchase Order
                  </CardTitle>
                  <CardDescription>Enter a PO number or search query to check the current approval status.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Input placeholder="e.g. PO-2026-00847 or search by vendor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCheckStatus() }} className="flex-1" />
                    <Button onClick={handleCheckStatus} disabled={statusLoading || !searchQuery.trim()} className="gap-2">
                      {statusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      {statusLoading ? 'Searching...' : 'Check Status'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {statusError && <InlineMessage type="error" message={statusError} />}

              {!statusResult && !statusLoading && !statusError && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Enter a PO number above to view its approval status and chain.</p>
                </div>
              )}

              {statusResult && (
                <div className="space-y-4">
                  {statusResult.message && (
                    <Card className="border-border bg-card">
                      <CardContent className="pt-5">
                        <div className="text-sm">{renderMarkdown(statusResult.message)}</div>
                      </CardContent>
                    </Card>
                  )}
                  <PODetailsCard po={statusResult.po_details} />
                  <ApprovalTimeline chain={statusResult.approval_chain} progress={statusResult.approval_progress} status={statusResult.current_status} />
                  <AlertsDisplay alerts={statusResult.alerts} />
                </div>
              )}
            </TabsContent>

            {/* ── Dashboard Tab ──────────────────────────────────────────── */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Approval Dashboard</h2>
                  <p className="text-xs text-muted-foreground">Overview of all purchase order activity and metrics.</p>
                </div>
                <Button onClick={handleDashboard} disabled={dashLoading} className="gap-2">
                  {dashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {dashLoading ? 'Loading...' : 'Load Dashboard'}
                </Button>
              </div>

              {dashError && <InlineMessage type="error" message={dashError} />}

              {!dashResult && !dashLoading && !dashError && (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Click "Load Dashboard" to fetch the latest PO approval metrics.</p>
                </div>
              )}

              {dashResult && (
                <div className="space-y-6">
                  {dashResult.message && (
                    <Card className="border-border bg-card">
                      <CardContent className="pt-5">
                        <div className="text-sm">{renderMarkdown(dashResult.message)}</div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <SummaryCard icon={<FileText className="h-5 w-5 text-blue-400" />} label="Total POs" value={dashResult.dashboard_summary?.total_pos ?? 0} />
                    <SummaryCard icon={<Clock className="h-5 w-5 text-amber-400" />} label="Pending Approval" value={dashResult.dashboard_summary?.pending_approval ?? 0} color="text-amber-400" />
                    <SummaryCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} label="Approved" value={dashResult.dashboard_summary?.approved ?? 0} color="text-emerald-400" />
                    <SummaryCard icon={<XCircle className="h-5 w-5 text-red-400" />} label="Rejected" value={dashResult.dashboard_summary?.rejected ?? 0} color="text-red-400" />
                    <SummaryCard icon={<DollarSign className="h-5 w-5 text-emerald-400" />} label="Total Amount" value={formatCurrency(dashResult.dashboard_summary?.total_amount)} />
                    <SummaryCard icon={<Zap className="h-5 w-5 text-orange-400" />} label="Urgent POs" value={dashResult.dashboard_summary?.urgent_pos ?? 0} color="text-orange-400" />
                    <SummaryCard icon={<TrendingUp className="h-5 w-5 text-indigo-400" />} label="Avg. Approval Time" value={dashResult.dashboard_summary?.average_approval_time ?? 'N/A'} />
                  </div>

                  {/* Department Breakdown */}
                  {Array.isArray(dashResult.dashboard_summary?.department_breakdown) && (dashResult.dashboard_summary?.department_breakdown?.length ?? 0) > 0 && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-400" />
                          Department Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="w-full">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Department</TableHead>
                                <TableHead className="text-muted-foreground text-right">PO Count</TableHead>
                                <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dashResult.dashboard_summary!.department_breakdown!.map((dept, idx) => (
                                <TableRow key={idx} className="border-border">
                                  <TableCell className="font-medium">{dept.department ?? 'N/A'}</TableCell>
                                  <TableCell className="text-right">{dept.count ?? 0}</TableCell>
                                  <TableCell className="text-right font-medium text-emerald-400">{formatCurrency(dept.total_amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  <AlertsDisplay alerts={dashResult.alerts} />
                </div>
              )}
            </TabsContent>

            {/* ── Reminders Tab ──────────────────────────────────────────── */}
            <TabsContent value="reminders" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Pending Reminders</h2>
                  <p className="text-xs text-muted-foreground">Review pending approvals and send reminder notifications to approvers.</p>
                </div>
                <Button onClick={handleReminders} disabled={reminderLoading} className="gap-2">
                  {reminderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  {reminderLoading ? 'Checking...' : 'Check Pending Reminders'}
                </Button>
              </div>

              {reminderError && <InlineMessage type="error" message={reminderError} />}

              {!reminderResult && !reminderLoading && !reminderError && (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Click "Check Pending Reminders" to see approvers with pending POs.</p>
                </div>
              )}

              {reminderResult && (
                <div className="space-y-4">
                  {reminderResult.message && (
                    <Card className="border-border bg-card">
                      <CardContent className="pt-5">
                        <div className="text-sm">{renderMarkdown(reminderResult.message)}</div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pending Approvers Table */}
                  {Array.isArray(reminderResult.reminder_details?.pending_approvers) && (reminderResult.reminder_details?.pending_approvers?.length ?? 0) > 0 && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4 text-amber-400" />
                          Pending Approvers ({reminderResult.reminder_details!.pending_approvers!.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="w-full">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Name</TableHead>
                                <TableHead className="text-muted-foreground">Role</TableHead>
                                <TableHead className="text-muted-foreground">Email</TableHead>
                                <TableHead className="text-muted-foreground text-right">Days Pending</TableHead>
                                <TableHead className="text-muted-foreground text-center">Reminder Sent</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reminderResult.reminder_details!.pending_approvers!.map((approver, idx) => (
                                <TableRow key={idx} className="border-border">
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                                      {approver.name ?? 'N/A'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{approver.role ?? 'N/A'}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-sm">
                                      <Mail className="h-3 w-3 text-muted-foreground" />
                                      {approver.email ?? 'N/A'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant="outline" className={`text-xs ${(approver.days_pending ?? 0) >= 3 ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                                      {approver.days_pending ?? 0} {(approver.days_pending ?? 0) === 1 ? 'day' : 'days'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {approver.reminder_sent ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-400 inline-block" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-400 inline-block" />
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reminder Message */}
                  {reminderResult.reminder_details?.reminder_message && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-400" />
                          Reminder Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">{renderMarkdown(reminderResult.reminder_details.reminder_message)}</div>
                      </CardContent>
                    </Card>
                  )}

                  <AlertsDisplay alerts={reminderResult.alerts} />
                </div>
              )}
            </TabsContent>

            {/* ── Schedule Tab ───────────────────────────────────────────── */}
            <TabsContent value="schedule" className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Schedule Management</h2>
                <p className="text-xs text-muted-foreground">Manage the automated reminder schedule for pending PO approvals.</p>
              </div>

              {/* Schedule Status Card */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-400" />
                      Automated Reminder Schedule
                    </CardTitle>
                    {currentSchedule ? (
                      <Badge variant="outline" className={currentSchedule.is_active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}>
                        {currentSchedule.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    ) : schedLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {schedLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading schedule...
                    </div>
                  ) : currentSchedule ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">Schedule</span>
                          <p className="font-medium">{cronToHuman('0 9 * * 1-5')}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">Timezone</span>
                          <p className="font-medium">America/New_York (ET)</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">Cron Expression</span>
                          <p className="font-mono text-xs bg-secondary/60 p-1.5 rounded inline-block">0 9 * * 1-5</p>
                        </div>
                      </div>

                      <Separator className="bg-border" />

                      <div className="flex items-center gap-3 flex-wrap">
                        <Button onClick={handleToggleSchedule} disabled={schedActionLoading} variant={currentSchedule.is_active ? 'destructive' : 'default'} className="gap-2">
                          {schedActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : currentSchedule.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          {schedActionLoading ? 'Updating...' : currentSchedule.is_active ? 'Pause Schedule' : 'Activate Schedule'}
                        </Button>

                        <Button onClick={handleTriggerNow} disabled={triggerLoading} variant="outline" className="gap-2">
                          {triggerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                          {triggerLoading ? 'Triggering...' : 'Run Now'}
                        </Button>

                        <Button onClick={() => { fetchSchedules(); handleLoadLogs() }} variant="outline" size="icon" title="Refresh">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Schedule not found. It may not be configured yet or the schedule ID may have changed.
                    </div>
                  )}

                  {schedMessage && <InlineMessage type={schedMessage.type} message={schedMessage.text} />}
                </CardContent>
              </Card>

              {/* Run History */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-400" />
                      Execution History
                    </CardTitle>
                    <Button onClick={handleLoadLogs} disabled={schedLogsLoading} variant="outline" size="sm" className="gap-2">
                      {schedLogsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Load Logs
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {schedLogsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading execution logs...
                    </div>
                  ) : schedLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No execution logs yet. Click "Load Logs" to fetch history.</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-muted-foreground">Executed At</TableHead>
                            <TableHead className="text-muted-foreground">Status</TableHead>
                            <TableHead className="text-muted-foreground">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schedLogs.map((log: any, idx: number) => (
                            <TableRow key={log?.id ?? idx} className="border-border">
                              <TableCell className="text-sm">{log?.executed_at ? new Date(log.executed_at).toLocaleString() : 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${log?.status === 'success' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : log?.status === 'error' || log?.status === 'failed' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30'}`}>
                                  {log?.status ?? 'unknown'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log?.error ?? (typeof log?.response === 'string' ? log.response.slice(0, 100) : 'Completed')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ── Agent Info Footer ──────────────────────────────────────────── */}
          <div className="mt-10 mb-6">
            <Separator className="bg-border mb-6" />
            <Card className="border-border bg-card/50">
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-secondary/60">
                      <Shield className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">PO Approval Manager</p>
                      <p className="text-xs text-muted-foreground">Purchase Order Approval Workflow Processor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeAgentId === AGENT_ID ? (
                      <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Processing
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

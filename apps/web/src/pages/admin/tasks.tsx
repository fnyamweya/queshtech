import { useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDays, CheckCircle2, ChevronRight, Flame, MoreHorizontal, Rocket, ShieldCheck } from 'lucide-react'

type Task = {
  title: string
  due: string
  owner: string
  priority: 'critical' | 'high' | 'medium'
  tag: string
  description: string
  status: 'open' | 'done' | 'snoozed'
}

const initialTasks: Task[] = [
  {
    title: 'Reconcile pending refunds',
    due: 'Today, 2:00 PM',
    owner: 'LM',
    priority: 'critical',
    tag: 'Finance',
    description: 'Verify refunds for orders ORD-1278, ORD-1291, and sync with M-Pesa logs.',
    status: 'open',
  },
  {
    title: 'Launch accessories campaign',
    due: 'Tomorrow, 9:00 AM',
    owner: 'JT',
    priority: 'high',
    tag: 'Growth',
    description: 'Approve creative, schedule push + email, update pricing bundles.',
    status: 'open',
  },
  {
    title: 'QA checkout on mobile',
    due: 'Oct 12, 4:30 PM',
    owner: 'AK',
    priority: 'medium',
    tag: 'Quality',
    description: 'Validate guest + authenticated checkout flows on iOS/Android.',
    status: 'open',
  },
  {
    title: 'Review low-stock SKUs',
    due: 'Oct 13, 11:00 AM',
    owner: 'SN',
    priority: 'medium',
    tag: 'Inventory',
    description: 'Confirm replenishment for AirPods Pro 2 and Galaxy S24 Ultra.',
    status: 'open',
  },
]

const priorityStyles: Record<string, string> = {
  critical: 'bg-vivid-red/10 text-vivid-red border-vivid-red/30',
  high: 'bg-vibrant-orange/10 text-vibrant-orange border-vibrant-orange/30',
  medium: 'bg-electric-blue/10 text-electric-blue border-electric-blue/30',
}

const ownerColors = ['bg-primary/10 text-primary', 'bg-cyber-cyan/10 text-cyber-cyan', 'bg-vivid-red/10 text-vivid-red', 'bg-electric-blue/10 text-electric-blue']

export function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Task['priority']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Task['status']>('all')

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      const term = search.toLowerCase()
      const matchesSearch =
        task.title.toLowerCase().includes(term) ||
        task.description.toLowerCase().includes(term) ||
        task.tag.toLowerCase().includes(term)
      return matchesPriority && matchesStatus && matchesSearch
    })
  }, [tasks, search, priorityFilter, statusFilter])

  const updateTaskStatus = (title: string, status: Task['status']) => {
    setTasks((prev) => prev.map((t) => (t.title === title ? { ...t, status } : t)))
  }

  return (
    <AdminLayout
      title="Tasks"
      description="Curated, high-impact actions to keep operations sharp. Assign, complete, and triage without leaving Axis."
    >
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Action board</CardTitle>
                <CardDescription>Critical and upcoming items for the team.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Clear blockers
                </Button>
                <Button size="sm" className="gap-2">
                  <Rocket className="h-4 w-4" />
                  New task
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Search tasks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="snoozed">Snoozed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredTasks.map((task, idx) => (
              <div
                key={task.title}
                className="group rounded-xl border bg-card/70 px-4 py-3 shadow-[0_6px_20px_-12px_rgba(0,0,0,0.35)] hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.45)] transition-all"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={task.status === 'done'}
                    onCheckedChange={(checked) => updateTaskStatus(task.title, checked ? 'done' : 'open')}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold leading-tight">{task.title}</p>
                      <Badge variant="outline" className={priorityStyles[task.priority]}>
                        {task.priority}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">{task.tag}</Badge>
                      {task.status === 'done' && <Badge variant="outline" className="border-neon-green/40 text-neon-green">Done</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" /> {task.due}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Avatar className="h-6 w-6 border">
                          <AvatarFallback className={`${ownerColors[idx % ownerColors.length]} text-[11px] font-semibold`}>
                            {task.owner}
                          </AvatarFallback>
                        </Avatar>
                        Owner
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => updateTaskStatus(task.title, 'done')}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => updateTaskStatus(task.title, 'snoozed')}>
                      <Flame className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Signals</CardTitle>
              <CardDescription>Smart nudges to keep momentum.</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Flame className="h-4 w-4" />
              Live
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-card/70 p-4">
              <p className="text-sm font-semibold">Escalate delayed orders</p>
              <p className="text-sm text-muted-foreground mt-1">
                6 orders past SLA. Tag fulfillment to prioritize courier handoff.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm">Open queue</Button>
                <Button size="sm" variant="outline">Notify team</Button>
              </div>
            </div>
            <div className="rounded-lg border bg-card/70 p-4">
              <p className="text-sm font-semibold">Capture churn signals</p>
              <p className="text-sm text-muted-foreground mt-1">
                12 high-intent carts abandoned in the last hour—route to support for rescue.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm">View carts</Button>
                <Button size="sm" variant="outline">Schedule outreach</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

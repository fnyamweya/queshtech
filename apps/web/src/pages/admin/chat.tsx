import { useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { MessageCircle, Sparkles, Paperclip, Send, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const threads = [
  {
    id: 'TH-204',
    customer: 'Sarah W.',
    lastMessage: 'Could you confirm delivery window for ORD-1301?',
    status: 'Open',
    priority: 'High',
    time: '5m ago',
  },
  {
    id: 'TH-203',
    customer: 'David O.',
    lastMessage: 'Requesting invoice for business account.',
    status: 'Snoozed',
    priority: 'Medium',
    time: '18m ago',
  },
  {
    id: 'TH-202',
    customer: 'Grace N.',
    lastMessage: 'Received wrong color—need exchange.',
    status: 'Open',
    priority: 'High',
    time: '27m ago',
  },
  {
    id: 'TH-201',
    customer: 'Peter M.',
    lastMessage: 'Following up on refund timeline.',
    status: 'Open',
    priority: 'Critical',
    time: '1h ago',
  },
]

const messages = [
  { author: 'Customer', initials: 'SW', time: '5m ago', body: 'Hi—could you confirm delivery window for ORD-1301?', tone: 'customer' },
  { author: 'Axis Support', initials: 'AX', time: '2m ago', body: 'Absolutely. I can see it is out for delivery and should arrive today between 3-5 PM. Would you like SMS updates?', tone: 'agent' },
]

export function AdminChatPage() {
  const [reply, setReply] = useState('')

  return (
    <AdminLayout
      title="Support Chat"
      description="Next-gen customer desk to triage, automate, and delight shoppers in real time."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            Escalate
          </Button>
          <Button size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Smart reply
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Live threads</CardTitle>
              <CardDescription>High-signal conversations surfaced first.</CardDescription>
            </div>
            <Badge variant="outline">4 active</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-xl border bg-card/70 p-3 hover:bg-accent/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{thread.customer}</p>
                    <p className="text-xs text-muted-foreground">{thread.lastMessage}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">{thread.time}</p>
                    <Badge variant="outline" className="mt-1 capitalize">
                      {thread.priority}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <Badge variant="secondary" className="capitalize">{thread.status}</Badge>
                  <span className="text-muted-foreground">{thread.id}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border">
                <AvatarFallback className="bg-primary/10 text-primary">SW</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="leading-tight">Sarah Wambui</CardTitle>
                <CardDescription>ORD-1301 • Returning customer • Nairobi</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              Open
            </Badge>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.time}
                  className={cn(
                    'max-w-2xl rounded-xl border px-4 py-3',
                    msg.tone === 'agent' ? 'ml-auto bg-primary/5 border-primary/20' : 'bg-card'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                    <span className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 border">
                        <AvatarFallback className={msg.tone === 'agent' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'}>
                          {msg.initials}
                        </AvatarFallback>
                      </Avatar>
                      {msg.author}
                    </span>
                    <span>{msg.time}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
              <Textarea
                placeholder="Compose a thoughtful reply with shipping ETA, exchange options, or a direct resolution."
                className="min-h-[120px]"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="gap-1">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="gap-2">
                  <Send className="h-4 w-4" />
                  Send reply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

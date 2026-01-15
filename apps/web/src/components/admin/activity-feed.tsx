import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type ActivityItem = {
  actor: string
  action: string
  time: string
  badge?: string
  avatar?: string
  type?: 'text' | 'comment' | 'success'
  body?: string
}

type ActivityFeedProps = {
  title?: string
  description?: string
  events: ActivityItem[]
  showAddButton?: boolean
}

export function ActivityFeed({ title = 'Activity feed', description = 'Recent edits and governance events.', events, showAddButton }: ActivityFeedProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul role="list" className="space-y-4">
          {events.map((item, idx) => (
            <li key={`${item.actor}-${idx}`} className="relative flex gap-x-4">
              <div className="absolute left-0 top-0 -bottom-6 flex w-6 justify-center">
                <div className="w-px bg-border" />
              </div>
              <div className="relative flex size-6 flex-none items-center justify-center bg-card">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt={item.actor}
                    className="size-6 rounded-full bg-gray-100 outline outline-1 -outline-offset-1 outline-border object-cover"
                  />
                ) : (
                  <div className="size-2 rounded-full bg-muted-foreground/40 ring-2 ring-background" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.actor}</span> {item.action}
                  </p>
                  <div className="flex items-center gap-2">
                    {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                    <time className="text-[11px] text-muted-foreground">{item.time}</time>
                  </div>
                </div>
                {item.type === 'comment' && item.body && (
                  <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                    {item.body}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {showAddButton && (
          <div className="space-y-2">
            <Textarea placeholder="Add your comment..." className="min-h-[90px]" />
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Attach</Badge>
                <Badge variant="outline">Mood</Badge>
              </div>
              <Button size="sm">Comment</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

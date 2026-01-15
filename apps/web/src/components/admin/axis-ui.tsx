import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type AxisSectionProps = {
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function AxisSection({
  title,
  description,
  icon,
  actions,
  children,
  className,
  contentClassName,
}: AxisSectionProps) {
  return (
    <Card className={cn('border-muted/60 bg-card/80 shadow-sm', className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {actions}
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn('space-y-6', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

type AxisFieldProps = {
  label: string
  description?: string
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}

export function AxisField({ label, description, error, required, htmlFor, className, children }: AxisFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {required ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
            Required
          </Badge>
        ) : null}
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

type AxisStatProps = {
  label: string
  value: ReactNode
  description?: string
  icon?: ReactNode
  className?: string
}

export function AxisStat({ label, value, description, icon, className }: AxisStatProps) {
  return (
    <div className={cn('rounded-lg border bg-muted/20 px-3 py-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AuthSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className
      )}
      aria-hidden="true"
    />
  )
}

type NoticeTone = 'muted' | 'primary' | 'destructive'

export function AuthNotice({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode
  tone?: NoticeTone
  className?: string
}) {
  const toneClassName =
    tone === 'primary'
      ? 'border-primary/15 bg-primary/5 text-foreground'
      : tone === 'destructive'
        ? 'border-destructive/20 bg-destructive/5 text-foreground'
        : 'border-border bg-muted/30 text-foreground'

  return (
    <div className={cn('rounded-xl border p-4 text-sm leading-relaxed', toneClassName, className)}>
      {children}
    </div>
  )
}


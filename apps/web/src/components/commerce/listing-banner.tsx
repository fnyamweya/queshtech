import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ListingBanner({
  title,
  description,
  eyebrow,
  icon,
  imageUrl,
  actions,
  footer,
  children,
  className,
}: {
  title: string
  description?: string | null
  eyebrow?: string | null
  icon?: ReactNode
  imageUrl?: string | null
  actions?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-border/60 bg-background/70 backdrop-blur-xl',
        'p-4 sm:p-6',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(900px circle at 10% 0%, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 55%), radial-gradient(900px circle at 100% 20%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 60%)',
        }}
      />

      {imageUrl ? (
        <div className="pointer-events-none absolute -right-10 bottom-0 hidden h-full w-[340px] sm:block">
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/55 to-background" />
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover opacity-55"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          </div>

          {description ? <p className="text-sm text-muted-foreground max-w-2xl">{description}</p> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>

      {children ? <div className="relative mt-5">{children}</div> : null}
      {footer ? <div className="relative mt-4 flex items-center justify-between gap-3">{footer}</div> : null}
    </div>
  )
}


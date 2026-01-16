import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight } from '@phosphor-icons/react'

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: { label: string; href: string }
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-6', className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h2>
        {description ? <p className="text-muted-foreground max-w-2xl">{description}</p> : null}
      </div>
      {action ? (
        <Button variant="outline" asChild className="hidden sm:inline-flex">
          <Link href={action.href}>
            {action.label}
            <ArrowRight size={14} weight="bold" className="ml-2" />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}


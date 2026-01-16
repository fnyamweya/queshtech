import { Link } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Banner } from '@/types/catalog'
import { ArrowRight } from '@phosphor-icons/react'

export function BannerCard({
  banner,
  className,
  align = 'left',
}: {
  banner: Banner
  className?: string
  align?: 'left' | 'center'
}) {
  const href = banner.href || '/'
  const title = banner.title || 'Featured'
  const subtitle = banner.subtitle || banner.landingSection
  const description = banner.description
  const cta = banner.ctaLabel || 'Shop now'

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background via-background/70 to-muted shadow-sm',
        'transition-shadow hover:shadow-lg',
        className
      )}
    >
      <div className="absolute inset-0">
        {banner.imageUrl ? (
          <img src={banner.imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/75 to-background/30" />
        <div
          className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity"
          style={{
            background:
              'radial-gradient(900px circle at 20% 10%, color-mix(in oklab, var(--color-primary) 22%, transparent), transparent 55%)',
          }}
        />
      </div>

      <div
        className={cn(
          'relative p-6 sm:p-7 space-y-3',
          align === 'center' ? 'text-center flex flex-col items-center' : 'text-left'
        )}
      >
        {subtitle ? (
          <Badge variant="secondary" className="uppercase text-[11px] tracking-wide">
            {subtitle}
          </Badge>
        ) : null}
        <h3 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        {description ? <p className="text-sm text-muted-foreground max-w-xl">{description}</p> : null}
        <Button asChild size="sm" variant="secondary" className="gap-2">
          <Link href={href}>
            {cta}
            <ArrowRight size={14} weight="bold" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

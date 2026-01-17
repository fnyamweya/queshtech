import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProductCardAppearance, ProductCardA11yConfig } from './types'

function cardShellClasses(preset: NonNullable<ProductCardAppearance['preset']>) {
  switch (preset) {
    case 'glass':
      return 'bg-background/60 backdrop-blur-xl border-border/60 shadow-sm hover:shadow-lg'
    case 'elevated':
      return 'bg-card border-border/60 shadow-md hover:shadow-xl'
    case 'minimal':
      return 'bg-transparent border-transparent shadow-none'
    case 'outline':
      return 'bg-card border-border shadow-none hover:border-primary/30'
    case 'premium':
      return 'bg-card border-border/60 shadow-sm hover:shadow-lg'
    case 'dark':
      return 'bg-card/60 border-border/60 shadow-sm hover:shadow-lg'
    case 'soft':
    case 'default':
    default:
      return 'bg-card border-border/60 shadow-sm hover:shadow-lg'
  }
}

export function ProductCardShell({
  href,
  ariaLabel,
  appearance,
  a11y,
  onLinkClick,
  className,
  children,
}: {
  href: string
  ariaLabel?: string
  appearance: Required<ProductCardAppearance>
  a11y: ProductCardA11yConfig
  onLinkClick?: () => void
  className?: string
  children: ReactNode
}) {
  const linkStrategy = a11y.linkStrategy ?? 'wrap'
  const focusRingMode = a11y.focusRing ?? 'auto'
  const focusRing =
    focusRingMode === 'none'
      ? ''
      : focusRingMode === 'always'
        ? 'focus:outline-none focus:ring-2 focus:ring-ring/50'
        : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <Card
      className={cn(
        'group relative overflow-hidden rounded-2xl border transition-all duration-300',
        'p-0 gap-0',
        cardShellClasses(appearance.preset),
        className
      )}
    >
      {linkStrategy === 'wrap' ? (
        <Link
          href={href}
          aria-label={ariaLabel}
          className={cn('absolute inset-0 z-10 rounded-2xl', focusRing)}
          onClick={() => onLinkClick?.()}
        />
      ) : null}
      <div className="relative">{children}</div>
    </Card>
  )
}

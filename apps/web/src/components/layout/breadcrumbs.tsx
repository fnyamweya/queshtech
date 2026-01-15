import { Link } from 'wouter'
import { CaretRight, House } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm py-3 sm:py-4 overflow-x-auto scrollbar-hide">
      <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <House size={14} className="sm:w-4 sm:h-4" weight="fill" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={index} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <CaretRight size={10} className="text-muted-foreground sm:w-3 sm:h-3" weight="bold" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(
                isLast ? 'text-foreground font-medium' : 'text-muted-foreground',
                'whitespace-nowrap truncate max-w-[120px] sm:max-w-none'
              )}>
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}

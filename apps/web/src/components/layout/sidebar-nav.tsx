import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DeviceMobile,
  Lightning,
  Fire,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { resolvePhosphorIcon } from '@/lib/phosphor'

interface SidebarNavProps {
  className?: string
}

export function SidebarNav({ className }: SidebarNavProps) {
  const [location] = useLocation()
  const { categories } = usePublicCategories({ isActive: true })

  return (
    <aside className={cn('w-[280px] border-r bg-card', className)}>
      <ScrollArea className="h-full py-6 px-4">
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </h3>
            <nav className="space-y-1">
              {categories.map((category) => {
                const Icon = resolvePhosphorIcon(category.icon) || DeviceMobile
                const isActive = location.includes(category.slug)

                return (
                  <Link key={category.id} href={`/category/${category.slug}`}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3 h-10',
                        isActive && 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                      )}
                    >
                      <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                      <span className="truncate">{category.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {category.productCount}
                      </span>
                    </Button>
                  </Link>
                )
              })}
            </nav>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Featured
            </h3>
            <nav className="space-y-1">
              <Link href="/deals">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-amber-600 dark:text-amber-500"
                >
                  <Lightning size={18} weight="fill" />
                  <span>Flash Deals</span>
                </Button>
              </Link>
              <Link href="/trending">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-orange-600 dark:text-orange-500"
                >
                  <Fire size={18} weight="fill" />
                  <span>Trending Now</span>
                </Button>
              </Link>
            </nav>
          </div>

          <Separator />

          <div className="px-3">
            <div className="rounded-lg bg-gradient-to-br from-primary/10 via-accent/10 to-cyber-cyan/10 p-4 space-y-2 border border-primary/20">
              <p className="text-sm font-semibold">Need Help?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Chat with our experts Monday-Friday, 8am-6pm EAT
              </p>
              <Button size="sm" className="w-full mt-2">
                Start Chat
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}

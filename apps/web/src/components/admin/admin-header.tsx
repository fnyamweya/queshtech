import type { ReactNode } from 'react'
import { Palette } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AdminSearch } from './admin-search'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useAdminThemeFlavor } from '@/hooks/use-admin-theme-flavor'
import { axisBreadcrumbsForPath } from './nav.config'

interface AdminHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function AdminHeader({ title, description, actions }: AdminHeaderProps) {
  const { adminUser, logout } = useAdminAuth()
  const { flavor, setFlavor, flavors } = useAdminThemeFlavor()
  const [location] = useLocation()
  const initials = `${adminUser?.firstName?.[0] ?? 'A'}${adminUser?.lastName?.[0] ?? 'X'}`.toUpperCase()
  const quickActions = actions ?? null

  const crumbs = axisBreadcrumbsForPath(location, title)

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-col gap-4 px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-muted-foreground" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">Axis Admin</p>
              <Breadcrumb className="mt-1">
                <BreadcrumbList>
                  {crumbs.map((c, idx) => {
                    const isLast = idx === crumbs.length - 1
                    return (
                      <Fragment key={`${c.label}-${idx}`}>
                        <BreadcrumbItem>
                          {isLast || !c.href ? (
                            <BreadcrumbPage>{c.label}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link href={c.href}>{c.label}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!isLast ? <BreadcrumbSeparator /> : null}
                      </Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold leading-none">{title}</h1>
              </div>
              {description && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{description}</p>}
            </div>
          </div>

        <div className="hidden md:flex items-center gap-2">
            <AdminSearch />
            {quickActions}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-10 w-10 cursor-pointer ring-1 ring-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">
                    {adminUser?.firstName} {adminUser?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{adminUser?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/axis/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/axis/customers">Customers</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Theme flavor
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={flavor} onValueChange={(v) => setFlavor(v as any)}>
                  {flavors.map((f) => (
                    <DropdownMenuRadioItem key={f.value} value={f.value}>
                      {f.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="shrink-0 text-muted-foreground" />
            <AdminSearch />
          </div>
          <div className="flex flex-wrap items-center gap-2">{quickActions}</div>
        </div>
      </div>
    </header>
  )
}

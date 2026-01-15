import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link, useLocation } from 'wouter'
import { ChevronDown, ChevronRight, LogOut, ShoppingBag } from 'lucide-react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { AXIS_NAV, isAxisNavActive } from './nav.config'
import { useStorage } from '@/hooks/use-storage'

export function AdminSidebar() {
  const [location, setLocation] = useLocation()
  const { adminUser, logout } = useAdminAuth()
  const { setOpenMobile } = useSidebar()
  const initials = `${adminUser?.firstName?.[0] ?? 'A'}${adminUser?.lastName?.[0] ?? 'X'}`.toUpperCase()

  const handleLogout = () => {
    logout()
    setLocation(`/axis/login?redirect=${encodeURIComponent(location)}`)
  }

  const isActive = (href: string) => isAxisNavActive(location, href)

  const [openSections, setOpenSections] = useStorage<Record<string, boolean>>('axis-nav-open-sections', {})
  const isSectionOpen = (key: string) => Boolean(openSections?.[key])
  const setSectionOpen = (key: string, open: boolean) => setOpenSections((prev) => ({ ...(prev || {}), [key]: open }))

  useEffect(() => {
    // Ensure the active subnav is visible.
    for (const group of AXIS_NAV) {
      for (const item of group.items) {
        if (!item.children?.length) continue
        const isChildActive = item.children.some((c) => isActive(c.href))
        if (isActive(item.href) || isChildActive) setSectionOpen(item.id, true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const CollapsibleNavItem = (props: {
    id: string
    title: string
    icon: ComponentType<{ className?: string }>
    active: boolean
    items: { title: string; href: string }[]
  }) => {
    const Icon = props.icon
    const open = isSectionOpen(props.id)

    return (
      <SidebarMenuItem>
        <Collapsible open={open} onOpenChange={(v) => setSectionOpen(props.id, v)}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              type="button"
              isActive={props.active}
              tooltip={props.title}
              data-state={open ? 'open' : 'closed'}
              className="justify-between relative data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1 data-[active=true]:before:bottom-1 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r data-[active=true]:before:bg-sidebar-primary"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4" />
                <span className="truncate">{props.title}</span>
              </span>
              {open ? (
                <ChevronDown className="h-4 w-4 opacity-70" />
              ) : (
                <ChevronRight className="h-4 w-4 opacity-70" />
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>
              {props.items.map((item) => (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(item.href)}
                    className="relative data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1 data-[active=true]:before:bottom-1 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r data-[active=true]:before:bg-sidebar-primary"
                  >
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border/80 pb-3">
        <Link href="/axis/dashboard" className="flex items-center gap-3 px-2 py-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/10 text-sidebar-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-base font-semibold leading-none">Axis</p>
            <p className="text-xs text-sidebar-foreground/70">Admin Control Center</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {AXIS_NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                if (item.children?.length) {
                  return CollapsibleNavItem({
                    id: item.id,
                    title: item.title,
                    icon: item.icon,
                    active: isActive(item.href) || item.children.some((c) => isActive(c.href)),
                    items: item.children.map((c) => ({ title: c.title, href: c.href })),
                  })
                }

                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                      className="relative data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1 data-[active=true]:before:bottom-1 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r data-[active=true]:before:bg-sidebar-primary"
                    >
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/80">
        <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/60 p-3">
          <Avatar className="h-10 w-10 border border-sidebar-border/80">
            <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {adminUser?.firstName} {adminUser?.lastName}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">{adminUser?.email}</p>
          </div>
        </div>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

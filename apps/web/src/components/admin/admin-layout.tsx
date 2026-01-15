import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AdminHeader } from './admin-header'
import { AdminSidebar } from './admin-sidebar'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useEffect, useMemo } from 'react'
import { useLocation } from 'wouter'
import { useAdminThemeFlavor } from '@/hooks/use-admin-theme-flavor'

interface AdminLayoutProps {
  children: ReactNode
  title: string
  description?: string
  actions?: ReactNode
}

export function AdminLayout({ children, title, description, actions }: AdminLayoutProps) {
  const { isReady, isAuthenticated } = useAdminAuth()
  const [location, setLocation] = useLocation()
  const { flavor } = useAdminThemeFlavor()

  const sidebarDefaultOpen = useMemo(() => {
    if (typeof document === 'undefined') return true
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]+)/)
    if (!match) return true
    return match[1] === 'true'
  }, [])

  useEffect(() => {
    if (!isReady) return
    if (isAuthenticated) return
    if (location.startsWith('/axis/login')) return
    setLocation(`/axis/login?redirect=${encodeURIComponent(location)}`)
  }, [isAuthenticated, isReady, location, setLocation])

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading admin session…
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Redirecting to admin login…
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <div className="admin-shell flex min-h-screen w-full bg-muted/10" data-admin-flavor={flavor}>
        <AdminSidebar />

        <SidebarInset className="flex flex-1 flex-col">
          <AdminHeader title={title} description={description} actions={actions} />
          <main className="p-6 lg:p-8 space-y-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

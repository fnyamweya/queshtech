import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import { toast } from 'sonner'
import {
  CaretRight,
  Gear,
  Heart,
  MapPin,
  Package,
  Plus,
  SignOut,
  SlidersHorizontal,
  Trash,
  User,
} from '@phosphor-icons/react'

import type { Address, Order, Product, WishlistItem } from '@/types'
import type { NewsletterFrequency, ThemeMode, UserProfilePreferences } from '@/types/profilePreferences'
import { DEFAULT_PROFILE_PREFERENCES } from '@/types/profilePreferences'

import { ConfirmDialog } from '@/components/commerce/confirm-dialog'
import { OrderDetailModal } from '@/components/commerce/order-detail-modal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { useCart } from '@/hooks/use-cart'
import { useStorage } from '@/hooks/use-storage'
import { useTheme } from '@/hooks/use-theme'
import { useWishlist } from '@/hooks/use-wishlist'

type ProfileSection = 'overview' | 'orders' | 'addresses' | 'wishlist' | 'settings'

const sections: Array<{
  id: ProfileSection
  label: string
  description: string
  href: string
  icon: ComponentType<{ size?: number; weight?: any }>
}> = [
  { id: 'overview', label: 'Overview', description: 'Profile and quick actions', href: '/profile', icon: User },
  { id: 'orders', label: 'Orders', description: 'Track and manage orders', href: '/profile/orders', icon: Package },
  { id: 'addresses', label: 'Addresses', description: 'Delivery and billing details', href: '/profile/addresses', icon: MapPin },
  { id: 'wishlist', label: 'Wishlist', description: 'Saved items to buy later', href: '/profile/wishlist', icon: Heart },
  { id: 'settings', label: 'Settings', description: 'Notifications and privacy', href: '/profile/settings', icon: Gear },
]

const statusBadgeVariant: Record<Order['status'], 'outline' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  processing: 'secondary',
  shipped: 'secondary',
  delivered: 'success',
  cancelled: 'destructive',
}

const statusLabel = (status: Order['status']) => status.charAt(0).toUpperCase() + status.slice(1)

const normalizeSection = (raw: string | undefined): ProfileSection => {
  const s = (raw || 'overview').trim().toLowerCase()
  if (s === '' || s === 'overview') return 'overview'
  if (s === 'orders') return 'orders'
  if (s === 'addresses') return 'addresses'
  if (s === 'wishlist') return 'wishlist'
  if (s === 'settings') return 'settings'
  return 'overview'
}

const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'QT-2024-001',
    date: '2024-01-15',
    status: 'delivered',
    items: [],
    shippingAddress: {
      firstName: 'Felix',
      lastName: 'Customer',
      address1: 'Kimathi Street',
      city: 'Nairobi',
      state: 'Nairobi',
      postalCode: '00100',
      country: 'Kenya',
      phone: '+254 712 345 678',
      isDefault: true,
    },
    billingAddress: {
      firstName: 'Felix',
      lastName: 'Customer',
      address1: 'Kimathi Street',
      city: 'Nairobi',
      state: 'Nairobi',
      postalCode: '00100',
      country: 'Kenya',
      phone: '+254 712 345 678',
    },
    shippingMethod: { id: 'express', name: 'Express', description: 'Same-day Nairobi', price: 0, estimatedDays: '0-1' },
    paymentMethod: { id: 'mpesa', type: 'card', label: 'M-Pesa • Paid' },
    subtotal: 119999,
    tax: 19200,
    shipping: 0,
    discount: 0,
    total: 139199,
  },
  {
    id: '2',
    orderNumber: 'QT-2024-002',
    date: '2024-01-20',
    status: 'shipped',
    items: [],
    shippingAddress: {
      firstName: 'Felix',
      lastName: 'Customer',
      address1: 'Brookside Grove',
      city: 'Nairobi',
      state: 'Nairobi',
      postalCode: '00100',
      country: 'Kenya',
      phone: '+254 712 345 678',
    },
    billingAddress: {
      firstName: 'Felix',
      lastName: 'Customer',
      address1: 'Brookside Grove',
      city: 'Nairobi',
      state: 'Nairobi',
      postalCode: '00100',
      country: 'Kenya',
      phone: '+254 712 345 678',
    },
    shippingMethod: { id: 'standard', name: 'Standard', description: 'Nationwide shipping', price: 500, estimatedDays: '2-4' },
    paymentMethod: { id: 'card', type: 'card', label: 'Card • Authorized' },
    subtotal: 34999,
    tax: 5600,
    shipping: 500,
    discount: 0,
    total: 41099,
  },
]

type StoredAddresses = { items: Address[] }

function useAddresses() {
  const [store, setStore] = useStorage<StoredAddresses>('user-addresses', { items: [] })
  const items = store?.items || []

  const add = (address: Address) => {
    const id = address.id || `addr-${Date.now()}`
    setStore((prev) => {
      const current = prev?.items || []
      const next = [{ ...address, id, isDefault: current.length === 0 }, ...current]
      return { items: next }
    })
  }

  const update = (id: string, address: Address) => {
    setStore((prev) => {
      const current = prev?.items || []
      return { items: current.map((a) => (a.id === id ? { ...a, ...address, id } : a)) }
    })
  }

  const remove = (id: string) => {
    setStore((prev) => {
      const current = prev?.items || []
      const next = current.filter((a) => a.id !== id)
      if (!next.some((a) => a.isDefault) && next.length > 0) next[0] = { ...next[0], isDefault: true }
      return { items: next }
    })
  }

  const setDefault = (id: string) => {
    setStore((prev) => {
      const current = prev?.items || []
      return { items: current.map((a) => ({ ...a, isDefault: a.id === id })) }
    })
  }

  return { items, add, update, remove, setDefault }
}

const allTogglesOff = (base: UserProfilePreferences): UserProfilePreferences => ({
  ...base,
  notifications: {
    sms: { enabled: false, orderUpdates: false, promotions: false, securityAlerts: false },
    email: { enabled: false, orderUpdates: false, promotions: false, securityAlerts: false, newsletters: false },
  },
  newsletters: { enabled: false, frequency: 'never' },
  ui: { reduceMotion: false, highContrast: false },
  privacy: { showEmail: false, showPhone: false, showProfileImage: false },
})

const normalizeProfilePreferences = (raw: unknown): UserProfilePreferences => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return allTogglesOff(DEFAULT_PROFILE_PREFERENCES)
  }

  const r = raw as any
  const d = DEFAULT_PROFILE_PREFERENCES

  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  const asThemeMode = (v: unknown, fallback: ThemeMode): ThemeMode => (v === 'system' || v === 'light' || v === 'dark' ? v : fallback)
  const asNewsletterFrequency = (v: unknown, fallback: NewsletterFrequency): NewsletterFrequency =>
    v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'never' ? v : fallback
  const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

  return {
    notifications: {
      sms: {
        enabled: bool(r?.notifications?.sms?.enabled, d.notifications.sms.enabled),
        orderUpdates: bool(r?.notifications?.sms?.orderUpdates, d.notifications.sms.orderUpdates),
        promotions: bool(r?.notifications?.sms?.promotions, d.notifications.sms.promotions),
        securityAlerts: bool(r?.notifications?.sms?.securityAlerts, d.notifications.sms.securityAlerts),
      },
      email: {
        enabled: bool(r?.notifications?.email?.enabled, d.notifications.email.enabled),
        orderUpdates: bool(r?.notifications?.email?.orderUpdates, d.notifications.email.orderUpdates),
        promotions: bool(r?.notifications?.email?.promotions, d.notifications.email.promotions),
        securityAlerts: bool(r?.notifications?.email?.securityAlerts, d.notifications.email.securityAlerts),
        newsletters: bool(r?.notifications?.email?.newsletters, d.notifications.email.newsletters),
      },
    },
    newsletters: {
      enabled: bool(r?.newsletters?.enabled, d.newsletters.enabled),
      frequency: asNewsletterFrequency(r?.newsletters?.frequency, d.newsletters.frequency),
    },
    theme: {
      mode: asThemeMode(r?.theme?.mode, d.theme.mode),
    },
    locale: {
      language: str(r?.locale?.language, d.locale.language),
      currency: str(r?.locale?.currency, d.locale.currency),
      timezone: typeof r?.locale?.timezone === 'string' ? r.locale.timezone : d.locale.timezone,
    },
    ui: {
      reduceMotion: bool(r?.ui?.reduceMotion, d.ui.reduceMotion),
      highContrast: bool(r?.ui?.highContrast, d.ui.highContrast),
    },
    privacy: {
      showEmail: bool(r?.privacy?.showEmail, d.privacy.showEmail),
      showPhone: bool(r?.privacy?.showPhone, d.privacy.showPhone),
      showProfileImage: bool(r?.privacy?.showProfileImage, d.privacy.showProfileImage),
    },
  }
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function ProfilePage() {
  const [path, setLocation] = useLocation()
  const [, params] = useRoute('/profile/:tab?')
  const rawSection = params?.tab
  const section = normalizeSection(rawSection)

  const { user, isAuthenticated, isReady, logout, getProfile, updateProfile } = useAuth()
  const { setTheme } = useTheme()
  const { addToCart } = useCart()
  const wishlist = useWishlist()
  const addresses = useAddresses()

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [hasLoadedRemoteProfile, setHasLoadedRemoteProfile] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)

  useEffect(() => {
    if (!isReady) return
    if (isAuthenticated) return
    setLocation(`/login?redirect=${encodeURIComponent(path)}`)
  }, [isAuthenticated, isReady, path, setLocation])

  useEffect(() => {
    if (!rawSection) return
    if (rawSection === 'overview') {
      setLocation('/profile')
      return
    }
    if (normalizeSection(rawSection) === 'overview' && rawSection !== 'overview') {
      setLocation('/profile')
    }
  }, [rawSection, setLocation])

  const [profileDraft, setProfileDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    setProfileDraft({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phoneNumber || '',
    })
  }, [user?.email, user?.firstName, user?.lastName, user?.phoneNumber])

  const [preferences, setPreferences] = useStorage<UserProfilePreferences>('user-preferences', allTogglesOff(DEFAULT_PROFILE_PREFERENCES))

  const profileInitials = useMemo(() => {
    const a = user?.firstName?.[0] || ''
    const b = user?.lastName?.[0] || ''
    return `${a}${b}`.toUpperCase()
  }, [user?.firstName, user?.lastName])

  useEffect(() => {
    if (!isAuthenticated) return
    if (hasLoadedRemoteProfile) return

    let isMounted = true
    ;(async () => {
      try {
        const payload = await getProfile()
        if (!isMounted) return
        setPreferences(normalizeProfilePreferences(payload?.profilePreferences))
        setHasLoadedRemoteProfile(true)
      } catch {
        toast.error('Failed to load profile')
      }
    })()

    return () => {
      isMounted = false
    }
  }, [getProfile, hasLoadedRemoteProfile, isAuthenticated, setPreferences])

  const persistPreferences = async (next: UserProfilePreferences) => {
    const normalized = normalizeProfilePreferences(next)
    const prev = preferences

    setPreferences(normalized)
    setIsSavingPreferences(true)
    try {
      await updateProfile({ profilePreferences: normalized })
    } catch (error: any) {
      setPreferences(prev)
      toast.error('Failed to update settings', { description: error?.message || 'Please try again.' })
    } finally {
      setIsSavingPreferences(false)
    }
  }

  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({})

  const handleChangePassword = async () => {
    const nextErrors: { newPassword?: string; confirmPassword?: string } = {}
    if (!passwordForm.newPassword) nextErrors.newPassword = 'New password is required'
    else if (passwordForm.newPassword.length < 8) nextErrors.newPassword = 'Password must be at least 8 characters'
    if (!passwordForm.confirmPassword) nextErrors.confirmPassword = 'Please confirm your new password'
    else if (passwordForm.newPassword !== passwordForm.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match'
    setPasswordErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsChangingPassword(true)
    try {
      await updateProfile({ password: passwordForm.newPassword })
      toast.success('Password updated')
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setPasswordErrors({})
    } catch (error: any) {
      toast.error('Failed to update password', { description: error?.message || 'Please try again.' })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsOrderModalOpen(true)
  }

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        firstName: profileDraft.firstName || undefined,
        lastName: profileDraft.lastName || undefined,
        email: profileDraft.email || undefined,
        phone: profileDraft.phone || undefined,
        profileImage: profileImageFile,
      })
      toast.success('Profile updated', { description: 'Your details were saved successfully.' })
      setIsProfileDialogOpen(false)
      setProfileImageFile(null)
    } catch (error: any) {
      toast.error('Update failed', { description: error?.message || 'Please try again.' })
    }
  }

  const active = sections.find((s) => s.id === section) || sections[0]

  const onMobileSectionChange = (next: ProfileSection) => {
    const found = sections.find((s) => s.id === next)
    if (!found) return
    setLocation(found.href)
  }

  return (
    <div className="min-h-[70vh] bg-background">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              My Account
            </h1>
            <p className="text-muted-foreground mt-1">Manage orders, addresses, and preferences.</p>
          </div>
          <div className="flex items-center gap-2 sm:pt-2">
            <Button variant="secondary" className="gap-2" onClick={() => setIsProfileDialogOpen(true)}>
              <User size={18} weight="bold" />
              Edit profile
            </Button>
            <Button variant="ghost" className="gap-2" onClick={logout}>
              <SignOut size={18} weight="bold" />
              Sign out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-8">
          <aside className="lg:sticky lg:top-24 h-fit">
            <Card className="py-0 gap-4">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user?.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{profileInitials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {user?.firstName || 'Customer'} {user?.lastName || ''}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user?.email || 'Signed in'}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="lg:hidden mb-4">
                  <Select value={section} onValueChange={(v) => onMobileSectionChange(v as ProfileSection)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <nav className="hidden lg:block space-y-1">
                  {sections.map((s) => {
                    const Icon = s.icon
                    const isActive = section === s.id
                    return (
                      <Link key={s.id} href={s.href}>
                        <Button variant={isActive ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                          <Icon size={18} weight="bold" />
                          <span className="flex-1 text-left">{s.label}</span>
                          <CaretRight size={16} className={isActive ? 'opacity-100' : 'opacity-0'} />
                        </Button>
                      </Link>
                    )
                  })}
                </nav>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{active.label}</div>
                <div className="text-sm text-muted-foreground">{active.description}</div>
              </div>
              {section === 'orders' && (
                <Badge variant="secondary" className="gap-2">
                  <SlidersHorizontal size={14} />
                  Filters
                </Badge>
              )}
            </div>

            {section === 'overview' && (
              <OverviewPanel
                orders={mockOrders}
                wishlistCount={wishlist.items.length}
                addressCount={addresses.items.length}
                onViewOrder={handleViewOrder}
              />
            )}

            {section === 'orders' && <OrdersPanel orders={mockOrders} onViewOrder={handleViewOrder} />}

            {section === 'addresses' && <AddressesPanel store={addresses} />}

            {section === 'wishlist' && (
              <WishlistPanel
                items={wishlist.items}
                onRemove={(productId) => wishlist.remove(productId)}
                onAddToCart={(product) => addToCart(product, {})}
              />
            )}

            {section === 'settings' && (
              <SettingsPanel
                preferences={preferences}
                isSavingPreferences={isSavingPreferences}
                persistPreferences={persistPreferences}
                setTheme={setTheme}
                passwordForm={passwordForm}
                passwordErrors={passwordErrors}
                isChangingPassword={isChangingPassword}
                onPasswordFormChange={setPasswordForm}
                onChangePassword={handleChangePassword}
              />
            )}
          </section>
        </div>
      </div>

      <OrderDetailModal order={selectedOrder} isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} />

      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Keep your account details up to date for faster checkout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user?.avatarUrl || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{profileInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="profile-image">Profile photo</Label>
                <Input id="profile-image" type="file" accept="image/*" onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)} />
                <div className="text-xs text-muted-foreground mt-1">PNG/JPG up to ~5MB recommended.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name" id="profile-first-name">
                <Input
                  id="profile-first-name"
                  value={profileDraft.firstName}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, firstName: e.target.value }))}
                />
              </Field>
              <Field label="Last name" id="profile-last-name">
                <Input
                  id="profile-last-name"
                  value={profileDraft.lastName}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, lastName: e.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email" id="profile-email">
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileDraft.email}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, email: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Phone" id="profile-phone">
                  <Input
                    id="profile-phone"
                    value={profileDraft.phone}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))}
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setIsProfileDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OverviewPanel({
  orders,
  wishlistCount,
  addressCount,
  onViewOrder,
}: {
  orders: Order[]
  wishlistCount: number
  addressCount: number
  onViewOrder: (order: Order) => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="py-0 gap-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Orders</CardTitle>
            <CardDescription>Track deliveries</CardDescription>
          </CardHeader>
          <CardContent className="pb-5 flex items-end justify-between">
            <div className="text-2xl font-bold">{orders.length}</div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/profile/orders">View</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="py-0 gap-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Wishlist</CardTitle>
            <CardDescription>Saved items</CardDescription>
          </CardHeader>
          <CardContent className="pb-5 flex items-end justify-between">
            <div className="text-2xl font-bold">{wishlistCount}</div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/profile/wishlist">Open</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="py-0 gap-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Addresses</CardTitle>
            <CardDescription>Delivery details</CardDescription>
          </CardHeader>
          <CardContent className="pb-5 flex items-end justify-between">
            <div className="text-2xl font-bold">{addressCount}</div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/profile/addresses">Manage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Recent orders</CardTitle>
          <CardDescription>Quickly jump back into tracking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {orders.slice(0, 3).map((order) => (
            <div key={order.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{order.orderNumber}</div>
                  <Badge variant={statusBadgeVariant[order.status]} className="capitalize">
                    {statusLabel(order.status)}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {new Date(order.date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })} •{' '}
                  {formatPrice(order.total)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => onViewOrder(order)}>
                  View details
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`}>Track</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function OrdersPanel({ orders, onViewOrder }: { orders: Order[]; onViewOrder: (order: Order) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | Order['status']>('all')
  const [dateRange, setDateRange] = useState<'all' | '30d' | '3m' | '6m' | '1y'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'total-desc' | 'total-asc'>('newest')

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoff = (() => {
      if (dateRange === '30d') return now - 30 * 24 * 60 * 60 * 1000
      if (dateRange === '3m') return now - 90 * 24 * 60 * 60 * 1000
      if (dateRange === '6m') return now - 180 * 24 * 60 * 60 * 1000
      if (dateRange === '1y') return now - 365 * 24 * 60 * 60 * 1000
      return 0
    })()

    const q = query.trim().toLowerCase()
    const base = orders.filter((o) => {
      const matchesQuery = !q || o.orderNumber.toLowerCase().includes(q) || String(o.total).includes(q) || o.status.toLowerCase().includes(q)
      const matchesStatus = status === 'all' || o.status === status
      const matchesDate = cutoff === 0 || new Date(o.date).getTime() >= cutoff
      return matchesQuery && matchesStatus && matchesDate
    })

    const sorted = [...base].sort((a, b) => {
      if (sort === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime()
      if (sort === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime()
      if (sort === 'total-asc') return a.total - b.total
      if (sort === 'total-desc') return b.total - a.total
      return 0
    })

    return sorted
  }, [dateRange, orders, query, sort, status])

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Order history</CardTitle>
        <CardDescription>Search, filter, and view details for your orders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_180px] gap-2">
            <Input placeholder="Search by order number, status, amount…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="3m">Last 3 months</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="1y">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="total-desc">Total: high → low</SelectItem>
                <SelectItem value="total-asc">Total: low → high</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> order(s)
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border p-10 text-center">
              <div className="text-sm font-semibold">No orders found</div>
              <div className="text-sm text-muted-foreground mt-1">Try adjusting filters or searching by order number.</div>
            </div>
          ) : (
            filtered.map((order) => (
              <div key={order.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{order.orderNumber}</div>
                      <Badge variant={statusBadgeVariant[order.status]} className="capitalize">
                        {statusLabel(order.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(order.date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })} •{' '}
                      {formatPrice(order.total)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => onViewOrder(order)}>
                      View details
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`}>Track</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AddressesPanel({ store }: { store: ReturnType<typeof useAddresses> }) {
  const { items, add, update, remove, setDefault } = store
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id?: string }>({ open: false })

  const defaultForm: Address = {
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Kenya',
    phone: '',
  }

  const [form, setForm] = useState<Address>(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const openAdd = () => {
    setEditing(null)
    setForm(defaultForm)
    setErrors({})
    setIsDialogOpen(true)
  }

  const openEdit = (address: Address) => {
    setEditing(address)
    setForm(address)
    setErrors({})
    setIsDialogOpen(true)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    const required: Array<keyof Address> = ['firstName', 'lastName', 'address1', 'city', 'state', 'postalCode', 'country', 'phone']
    for (const key of required) {
      const value = String((form as any)[key] || '').trim()
      if (!value) next[String(key)] = 'Required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSave = () => {
    if (!validate()) return
    if (editing?.id) {
      update(editing.id, form)
      toast.success('Address updated')
    } else {
      add(form)
      toast.success('Address added')
    }
    setIsDialogOpen(false)
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Saved addresses</CardTitle>
              <CardDescription>Use a default address for faster checkout.</CardDescription>
            </div>
            <Button className="gap-2" onClick={openAdd}>
              <Plus size={16} weight="bold" />
              Add address
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border p-10 text-center">
              <div className="text-sm font-semibold">No saved addresses</div>
              <div className="text-sm text-muted-foreground mt-1">Add one now to speed up checkout.</div>
              <Button className="mt-4" onClick={openAdd}>
                Add your first address
              </Button>
            </div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">
                        {a.firstName} {a.lastName}
                      </div>
                      {a.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <div>{a.address1}</div>
                      {a.address2 ? <div>{a.address2}</div> : null}
                      <div>
                        {a.city}, {a.state} {a.postalCode}
                      </div>
                      <div>{a.country}</div>
                      <div className="mt-1">{a.phone}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!a.isDefault && (
                      <Button variant="secondary" size="sm" onClick={() => setDefault(String(a.id))}>
                        Set default
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete({ open: true, id: String(a.id) })}
                    >
                      <Trash size={16} />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit address' : 'Add address'}</DialogTitle>
            <DialogDescription>Used for delivery updates and checkout autofill.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First name" id="addr-firstName" error={errors.firstName}>
              <Input id="addr-firstName" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
            </Field>
            <Field label="Last name" id="addr-lastName" error={errors.lastName}>
              <Input id="addr-lastName" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address line 1" id="addr-address1" error={errors.address1}>
                <Input id="addr-address1" value={form.address1} onChange={(e) => setForm((p) => ({ ...p, address1: e.target.value }))} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Address line 2 (optional)" id="addr-address2">
                <Input id="addr-address2" value={form.address2 || ''} onChange={(e) => setForm((p) => ({ ...p, address2: e.target.value }))} />
              </Field>
            </div>
            <Field label="City" id="addr-city" error={errors.city}>
              <Input id="addr-city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
            </Field>
            <Field label="State / County" id="addr-state" error={errors.state}>
              <Input id="addr-state" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
            </Field>
            <Field label="Postal code" id="addr-postal" error={errors.postalCode}>
              <Input id="addr-postal" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} />
            </Field>
            <Field label="Country" id="addr-country" error={errors.country}>
              <Input id="addr-country" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Phone" id="addr-phone" error={errors.phone}>
                <Input id="addr-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>{editing ? 'Save changes' : 'Add address'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete((p) => ({ ...p, open }))}
        title="Delete address?"
        description="This action can’t be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete.id) remove(confirmDelete.id)
          setConfirmDelete({ open: false })
          toast.success('Address removed')
        }}
      />
    </>
  )
}

function WishlistPanel({
  items,
  onRemove,
  onAddToCart,
}: {
  items: WishlistItem[]
  onRemove: (productId: string) => void
  onAddToCart: (product: Product) => void
}) {
  const [sort, setSort] = useState<'newest' | 'oldest' | 'price-asc' | 'price-desc'>('newest')

  const sorted = useMemo(() => {
    const next = [...items]
    next.sort((a, b) => {
      if (sort === 'newest') return new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()
      if (sort === 'oldest') return new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime()
      if (sort === 'price-asc') return a.product.price - b.product.price
      if (sort === 'price-desc') return b.product.price - a.product.price
      return 0
    })
    return next
  }, [items, sort])

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Wishlist</CardTitle>
            <CardDescription>Saved items you can add to cart anytime.</CardDescription>
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="price-asc">Price: low → high</SelectItem>
              <SelectItem value="price-desc">Price: high → low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <div className="rounded-xl border p-10 text-center">
            <div className="text-sm font-semibold">Your wishlist is empty</div>
            <div className="text-sm text-muted-foreground mt-1">Browse products and tap the heart to save them.</div>
            <Button asChild className="mt-4">
              <Link href="/">Browse products</Link>
            </Button>
          </div>
        ) : (
          sorted.map((item) => {
            const p = item.product
            const img = p.images?.[0]
            return (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <Link href={`/product/${p.slug}`}>
                    <div className="w-full sm:w-28 sm:h-28 aspect-square rounded-lg overflow-hidden bg-muted">
                      {img ? <img src={img.url} alt={img.alt || p.name} className="w-full h-full object-cover" /> : null}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/product/${p.slug}`}>
                          <div className="font-semibold line-clamp-2">{p.name}</div>
                        </Link>
                        <div className="text-sm text-muted-foreground mt-1">
                          {p.brand} • {p.inStock ? <span className="text-success">In stock</span> : <span className="text-destructive">Out of stock</span>}
                        </div>
                      </div>
                      <div className="text-right font-semibold whitespace-nowrap">
                        {new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency || 'KES', maximumFractionDigits: 0 }).format(p.price)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Button variant="secondary" onClick={() => onAddToCart(p)} disabled={!p.inStock}>
                        Add to cart
                      </Button>
                      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onRemove(p.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function SettingsPanel({
  preferences,
  isSavingPreferences,
  persistPreferences,
  setTheme,
  passwordForm,
  passwordErrors,
  isChangingPassword,
  onPasswordFormChange,
  onChangePassword,
}: {
  preferences: UserProfilePreferences
  isSavingPreferences: boolean
  persistPreferences: (next: UserProfilePreferences) => Promise<void>
  setTheme: (t: any) => void
  passwordForm: { newPassword: string; confirmPassword: string }
  passwordErrors: { newPassword?: string; confirmPassword?: string }
  isChangingPassword: boolean
  onPasswordFormChange: React.Dispatch<React.SetStateAction<{ newPassword: string; confirmPassword: string }>>
  onChangePassword: () => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Theme & display</CardTitle>
          <CardDescription>Customize the UI to your preference.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <RadioGroup
              value={preferences.theme.mode}
              onValueChange={(value: ThemeMode) => {
                persistPreferences({ ...preferences, theme: { mode: value } })
                setTheme(value === 'system' ? 'system' : value)
              }}
              className="grid grid-cols-3 gap-3"
            >
              <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                <RadioGroupItem value="light" id="pref-theme-light" />
                <Label htmlFor="pref-theme-light">Light</Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                <RadioGroupItem value="dark" id="pref-theme-dark" />
                <Label htmlFor="pref-theme-dark">Dark</Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                <RadioGroupItem value="system" id="pref-theme-system" />
                <Label htmlFor="pref-theme-system">System</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={preferences.locale.language} onValueChange={(value) => persistPreferences({ ...preferences, locale: { ...preferences.locale, language: value } })}>
                <SelectTrigger>
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sw">Swahili</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={preferences.locale.currency} onValueChange={(value) => persistPreferences({ ...preferences, locale: { ...preferences.locale, currency: value } })}>
                <SelectTrigger>
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ToggleRow
            label="Reduce motion"
            description="Minimize animations and transitions"
            checked={preferences.ui.reduceMotion}
            disabled={isSavingPreferences}
            onCheckedChange={(checked) => persistPreferences({ ...preferences, ui: { ...preferences.ui, reduceMotion: checked } })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Control how we contact you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="SMS notifications"
            description="Order updates and security alerts"
            checked={preferences.notifications.sms.enabled}
            disabled={isSavingPreferences}
            onCheckedChange={(checked) =>
              persistPreferences({
                ...preferences,
                notifications: {
                  ...preferences.notifications,
                  sms: {
                    ...preferences.notifications.sms,
                    enabled: checked,
                    ...(checked ? {} : { orderUpdates: false, promotions: false, securityAlerts: false }),
                  },
                },
              })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ToggleRow
              label="Order updates"
              checked={preferences.notifications.sms.orderUpdates}
              disabled={isSavingPreferences || !preferences.notifications.sms.enabled}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, sms: { ...preferences.notifications.sms, orderUpdates: checked } },
                })
              }
            />
            <ToggleRow
              label="Promotions"
              checked={preferences.notifications.sms.promotions}
              disabled={isSavingPreferences || !preferences.notifications.sms.enabled}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, sms: { ...preferences.notifications.sms, promotions: checked } },
                })
              }
            />
            <ToggleRow
              label="Security"
              checked={preferences.notifications.sms.securityAlerts}
              disabled={isSavingPreferences || !preferences.notifications.sms.enabled}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, sms: { ...preferences.notifications.sms, securityAlerts: checked } },
                })
              }
            />
          </div>

          <Separator />

          <ToggleRow
            label="Email notifications"
            description="Promotions, newsletters, and receipts"
            checked={preferences.notifications.email.enabled}
            disabled={isSavingPreferences}
            onCheckedChange={(checked) =>
              persistPreferences({
                ...preferences,
                notifications: {
                  ...preferences.notifications,
                  email: {
                    ...preferences.notifications.email,
                    enabled: checked,
                    ...(checked ? {} : { orderUpdates: false, promotions: false, securityAlerts: false, newsletters: false }),
                  },
                },
              })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <ToggleRow
              label="Order updates"
              checked={preferences.notifications.email.orderUpdates}
              disabled={isSavingPreferences || !preferences.notifications.email.enabled}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, email: { ...preferences.notifications.email, orderUpdates: checked } },
                })
              }
            />
            <ToggleRow
              label="Promotions"
              checked={preferences.notifications.email.promotions}
              disabled={isSavingPreferences || !preferences.notifications.email.enabled}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, email: { ...preferences.notifications.email, promotions: checked } },
                })
              }
            />
            <ToggleRow
              label="Security"
              checked={preferences.notifications.email.securityAlerts}
              disabled={isSavingPreferences || !preferences.notifications.email.enabled}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, email: { ...preferences.notifications.email, securityAlerts: checked } },
                })
              }
            />
            <ToggleRow
              label="Newsletters"
              checked={preferences.notifications.email.newsletters}
              disabled={isSavingPreferences || !preferences.notifications.email.enabled}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, email: { ...preferences.notifications.email, newsletters: checked } },
                })
              }
            />
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Newsletter subscription</div>
                <div className="text-xs text-muted-foreground">Get curated drops and deals.</div>
              </div>
              <Switch
                checked={preferences.newsletters.enabled}
                disabled={isSavingPreferences}
                onCheckedChange={(checked) =>
                  persistPreferences({
                    ...preferences,
                    newsletters: { ...preferences.newsletters, enabled: checked, frequency: checked ? preferences.newsletters.frequency : 'never' },
                  })
                }
              />
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={preferences.newsletters.frequency}
                  onValueChange={(value: NewsletterFrequency) => persistPreferences({ ...preferences, newsletters: { ...preferences.newsletters, frequency: value } })}
                  disabled={!preferences.newsletters.enabled || isSavingPreferences}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Privacy</CardTitle>
          <CardDescription>Choose what’s visible on your profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label="Show email"
            description="Display your email address"
            checked={preferences.privacy.showEmail}
            disabled={isSavingPreferences}
            onCheckedChange={(checked) => persistPreferences({ ...preferences, privacy: { ...preferences.privacy, showEmail: checked } })}
          />
          <ToggleRow
            label="Show phone"
            description="Display your phone number"
            checked={preferences.privacy.showPhone}
            disabled={isSavingPreferences}
            onCheckedChange={(checked) => persistPreferences({ ...preferences, privacy: { ...preferences.privacy, showPhone: checked } })}
          />
          <ToggleRow
            label="Show profile image"
            description="Display your avatar"
            checked={preferences.privacy.showProfileImage}
            disabled={isSavingPreferences}
            onCheckedChange={(checked) => persistPreferences({ ...preferences, privacy: { ...preferences.privacy, showProfileImage: checked } })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>Use a strong password to secure your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pref-new-password">New password</Label>
              <Input
                id="pref-new-password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                disabled={isChangingPassword}
                onChange={(e) => onPasswordFormChange((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="At least 8 characters"
              />
              {passwordErrors.newPassword ? <div className="text-xs text-destructive">{passwordErrors.newPassword}</div> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pref-confirm-password">Confirm password</Label>
              <Input
                id="pref-confirm-password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                disabled={isChangingPassword}
                onChange={(e) => onPasswordFormChange((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Repeat password"
              />
              {passwordErrors.confirmPassword ? <div className="text-xs text-destructive">{passwordErrors.confirmPassword}</div> : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center justify-between">
        <span>{label}</span>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </Label>
      {children}
    </div>
  )
}

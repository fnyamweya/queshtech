import { useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GamerButton } from '@/components/ui/gamer-button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { OrderDetailModal } from '@/components/commerce/order-detail-modal'
import {
  User,
  Package,
  MapPin,
  CreditCard,
  Gear,
  Heart,
  Eye,
} from '@phosphor-icons/react'
import type { Order } from '@/types'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useStorage } from '@/hooks/use-storage'
import { useTheme } from '@/hooks/use-theme'
import type { NewsletterFrequency, ThemeMode, UserProfilePreferences } from '@/types/profilePreferences'
import { DEFAULT_PROFILE_PREFERENCES } from '@/types/profilePreferences'

const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'QT-2024-001',
    date: '2024-01-15',
    status: 'delivered',
    items: [],
    shippingAddress: {} as any,
    billingAddress: {} as any,
    shippingMethod: {} as any,
    paymentMethod: {} as any,
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
    shippingAddress: {} as any,
    billingAddress: {} as any,
    shippingMethod: {} as any,
    paymentMethod: {} as any,
    subtotal: 34999,
    tax: 5600,
    shipping: 500,
    discount: 0,
    total: 41099,
  },
]

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  shipped: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  delivered: 'bg-green-500/10 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export function ProfilePage() {
  const [location, setLocation] = useLocation()
  const [, params] = useRoute('/profile/:tab?')
  const activeTab = params?.tab || 'overview'
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [hasLoadedRemoteProfile, setHasLoadedRemoteProfile] = useState(false)

  const { isAuthenticated, isReady, getProfile, updateProfile } = useAuth()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!isReady) return
    if (isAuthenticated) return
    setLocation(`/login?redirect=${encodeURIComponent(location)}`)
  }, [isAuthenticated, isReady, location, setLocation])
  
  const [profile, setProfile] = useStorage<any>('user-profile', {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+254 712 345 678',
  })

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
      // Requirement: if backend sends null, settings should default to OFF.
      return allTogglesOff(DEFAULT_PROFILE_PREFERENCES)
    }

    const r = raw as any
    const d = DEFAULT_PROFILE_PREFERENCES

    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
    const asThemeMode = (v: unknown, fallback: ThemeMode): ThemeMode =>
      v === 'system' || v === 'light' || v === 'dark' ? v : fallback

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

  const [preferences, setPreferences] = useStorage<UserProfilePreferences>(
    'user-preferences',
    allTogglesOff(DEFAULT_PROFILE_PREFERENCES)
  )

  const profileInitials = useMemo(() => {
    const a = profile?.firstName?.[0] || ''
    const b = profile?.lastName?.[0] || ''
    return `${a}${b}`.toUpperCase()
  }, [profile?.firstName, profile?.lastName])

  useEffect(() => {
    if (!isAuthenticated) return
    if (hasLoadedRemoteProfile) return

    let isMounted = true
    ;(async () => {
      try {
        const payload = await getProfile()
        if (!isMounted) return

        setProfile((prev: any) => ({
          ...prev,
          firstName: payload?.firstName ?? prev?.firstName,
          lastName: payload?.lastName ?? prev?.lastName,
          email: payload?.email ?? prev?.email,
          phone: payload?.phone ?? payload?.phoneNumber ?? prev?.phone,
        }))

        // /profile/settings is driven by `profilePreferences` on the same /profile endpoint.
        // If backend sends null/undefined, treat all toggles as OFF.
        setPreferences(normalizeProfilePreferences(payload?.profilePreferences))

        setHasLoadedRemoteProfile(true)
      } catch (error) {
        toast.error('Failed to load profile')
      }
    })()

    return () => {
      isMounted = false
    }
  }, [getProfile, hasLoadedRemoteProfile, isAuthenticated, setPreferences, setProfile])

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

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsOrderModalOpen(true)
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await updateProfile({
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        email: profile?.email,
        phone: profile?.phone,
      })
      toast.success('Profile updated')
    } catch (error: any) {
      toast.error('Update failed', { description: error?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          My Account
        </h1>
        <p className="text-muted-foreground">Manage your profile, orders, and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="text-center pb-3">
            <Avatar className="w-24 h-24 mx-auto mb-3">
              <AvatarImage src="" />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-cyber-cyan text-white">
                {profileInitials}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-lg">
              {profile?.firstName} {profile?.lastName}
            </CardTitle>
            <CardDescription className="text-sm">{profile?.email}</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <nav className="space-y-1">
              <a href="/profile/overview">
                <Button variant={activeTab === 'overview' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                  <User size={18} />
                  <span>Overview</span>
                </Button>
              </a>
              <a href="/profile/orders">
                <Button variant={activeTab === 'orders' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                  <Package size={18} />
                  <span>Orders</span>
                </Button>
              </a>
              <a href="/profile/addresses">
                <Button variant={activeTab === 'addresses' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                  <MapPin size={18} />
                  <span>Addresses</span>
                </Button>
              </a>
              <a href="/profile/payment">
                <Button variant={activeTab === 'payment' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                  <CreditCard size={18} />
                  <span>Payment Methods</span>
                </Button>
              </a>
              <a href="/profile/wishlist">
                <Button variant={activeTab === 'wishlist' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                  <Heart size={18} />
                  <span>Wishlist</span>
                </Button>
              </a>
              <a href="/profile/settings">
                <Button variant={activeTab === 'settings' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                  <Gear size={18} />
                  <span>Settings</span>
                </Button>
              </a>
            </nav>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {(activeTab === 'overview' || !activeTab) && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profile?.firstName}
                        onChange={(e) => setProfile((prev: any) => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profile?.lastName}
                        onChange={(e) => setProfile((prev: any) => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email}
                      onChange={(e) => setProfile((prev: any) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile?.phone}
                      onChange={(e) => setProfile((prev: any) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>Your latest purchases</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockOrders.slice(0, 3).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors">
                        <div className="space-y-1">
                          <p className="font-semibold">{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.date).toLocaleDateString('en-KE', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={statusColors[order.status]}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                          <p className="font-semibold hidden sm:block">{formatPrice(order.total)}</p>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                          >
                            <Eye size={18} weight="bold" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <GamerButton variant="secondary" className="w-full mt-4" onClick={() => window.location.href = '/profile/orders'}>
                    View All Orders
                  </GamerButton>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'orders' && (
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>Track and manage your orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOrders.map((order) => (
                    <div key={order.id} className="p-4 sm:p-6 rounded-lg border space-y-4 hover:border-primary/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-lg">{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            Placed on {new Date(order.date).toLocaleDateString('en-KE', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <Badge className={statusColors[order.status]}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">Total: <span className="text-foreground font-semibold text-base">{formatPrice(order.total)}</span></p>
                        <div className="flex gap-2">
                          <GamerButton 
                            variant="primary" 
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                          >
                            <Eye size={16} weight="bold" />
                            View Details
                          </GamerButton>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.href = `/track-order?order=${order.orderNumber}`}
                          >
                            Track Order
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'settings' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Choose what you want to hear about, and where.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-lg border bg-card/50 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="email-enabled">Email</Label>
                          <p className="text-sm text-muted-foreground">Receipts, updates, and alerts</p>
                        </div>
                        <Switch
                          id="email-enabled"
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
                                  ...(checked
                                    ? {}
                                    : {
                                        orderUpdates: false,
                                        promotions: false,
                                        securityAlerts: false,
                                        newsletters: false,
                                      }),
                                },
                              },
                            })
                          }
                        />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email-orders" className="text-sm">Order updates</Label>
                          <Switch
                            id="email-orders"
                            checked={preferences.notifications.email.orderUpdates}
                            disabled={isSavingPreferences || !preferences.notifications.email.enabled}
                            onCheckedChange={(checked) =>
                              persistPreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences.notifications,
                                  email: {
                                    ...preferences.notifications.email,
                                    orderUpdates: checked,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email-promos" className="text-sm">Promotions</Label>
                          <Switch
                            id="email-promos"
                            checked={preferences.notifications.email.promotions}
                            disabled={isSavingPreferences || !preferences.notifications.email.enabled}
                            onCheckedChange={(checked) =>
                              persistPreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences.notifications,
                                  email: {
                                    ...preferences.notifications.email,
                                    promotions: checked,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email-security" className="text-sm">Security alerts</Label>
                          <Switch
                            id="email-security"
                            checked={preferences.notifications.email.securityAlerts}
                            disabled={isSavingPreferences || !preferences.notifications.email.enabled}
                            onCheckedChange={(checked) =>
                              persistPreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences.notifications,
                                  email: {
                                    ...preferences.notifications.email,
                                    securityAlerts: checked,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email-newsletters" className="text-sm">Newsletters</Label>
                          <Switch
                            id="email-newsletters"
                            checked={preferences.notifications.email.newsletters}
                            disabled={isSavingPreferences || !preferences.notifications.email.enabled}
                            onCheckedChange={(checked) =>
                              persistPreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences.notifications,
                                  email: {
                                    ...preferences.notifications.email,
                                    newsletters: checked,
                                  },
                                },
                                newsletters: {
                                  ...preferences.newsletters,
                                  enabled: checked,
                                  frequency: checked
                                    ? (preferences.newsletters.frequency === 'never' ? 'weekly' : preferences.newsletters.frequency)
                                    : 'never',
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-card/50 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="sms-enabled">SMS</Label>
                          <p className="text-sm text-muted-foreground">Time-sensitive updates on the go</p>
                        </div>
                        <Switch
                          id="sms-enabled"
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
                                  ...(checked
                                    ? {}
                                    : {
                                        orderUpdates: false,
                                        promotions: false,
                                        securityAlerts: false,
                                      }),
                                },
                              },
                            })
                          }
                        />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sms-orders" className="text-sm">Order updates</Label>
                          <Switch
                            id="sms-orders"
                            checked={preferences.notifications.sms.orderUpdates}
                            disabled={isSavingPreferences || !preferences.notifications.sms.enabled}
                            onCheckedChange={(checked) =>
                              persistPreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences.notifications,
                                  sms: {
                                    ...preferences.notifications.sms,
                                    orderUpdates: checked,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sms-promos" className="text-sm">Promotions</Label>
                          <Switch
                            id="sms-promos"
                            checked={preferences.notifications.sms.promotions}
                            disabled={isSavingPreferences || !preferences.notifications.sms.enabled}
                            onCheckedChange={(checked) =>
                              persistPreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences.notifications,
                                  sms: {
                                    ...preferences.notifications.sms,
                                    promotions: checked,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sms-security" className="text-sm">Security alerts</Label>
                          <Switch
                            id="sms-security"
                            checked={preferences.notifications.sms.securityAlerts}
                            disabled={isSavingPreferences || !preferences.notifications.sms.enabled}
                            onCheckedChange={(checked) =>
                              persistPreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences.notifications,
                                  sms: {
                                    ...preferences.notifications.sms,
                                    securityAlerts: checked,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSavingPreferences && (
                    <p className="text-sm text-muted-foreground">Saving settings…</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Newsletters</CardTitle>
                    <CardDescription>Control frequency and delivery.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="newsletter-enabled">Enabled</Label>
                        <p className="text-sm text-muted-foreground">Product launches, deals, and tips</p>
                      </div>
                      <Switch
                        id="newsletter-enabled"
                        checked={preferences.newsletters.enabled}
                        disabled={isSavingPreferences}
                        onCheckedChange={(checked) =>
                          persistPreferences({
                            ...preferences,
                            newsletters: {
                              ...preferences.newsletters,
                              enabled: checked,
                              frequency: checked
                                ? (preferences.newsletters.frequency === 'never' ? 'weekly' : preferences.newsletters.frequency)
                                : 'never',
                            },
                            notifications: {
                              ...preferences.notifications,
                              email: {
                                ...preferences.notifications.email,
                                newsletters: checked,
                                enabled: checked ? preferences.notifications.email.enabled : preferences.notifications.email.enabled,
                              },
                            },
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={preferences.newsletters.frequency}
                        onValueChange={(v) =>
                          persistPreferences({
                            ...preferences,
                            newsletters: {
                              ...preferences.newsletters,
                              frequency: v as NewsletterFrequency,
                            },
                          })
                        }
                        disabled={isSavingPreferences || !preferences.newsletters.enabled}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Theme</CardTitle>
                    <CardDescription>Choose how QueshTech looks on this device.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <RadioGroup
                        value={preferences.theme.mode}
                        onValueChange={(v) => {
                          const mode = v as ThemeMode
                          setTheme(mode as any)
                          persistPreferences({
                            ...preferences,
                            theme: {
                              ...preferences.theme,
                              mode,
                            },
                          })
                        }}
                        className="grid gap-3"
                      >
                        <label className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2">
                          <RadioGroupItem value="system" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">System</p>
                            <p className="text-xs text-muted-foreground">Match device settings</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2">
                          <RadioGroupItem value="light" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Light</p>
                            <p className="text-xs text-muted-foreground">Bright and crisp</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2">
                          <RadioGroupItem value="dark" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Dark</p>
                            <p className="text-xs text-muted-foreground">Easy on the eyes</p>
                          </div>
                        </label>
                      </RadioGroup>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Privacy</CardTitle>
                  <CardDescription>Control what’s visible on your profile.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="privacy-email">Show email</Label>
                      <p className="text-xs text-muted-foreground">Display your email address</p>
                    </div>
                    <Switch
                      id="privacy-email"
                      checked={preferences.privacy.showEmail}
                      disabled={isSavingPreferences}
                      onCheckedChange={(checked) =>
                        persistPreferences({
                          ...preferences,
                          privacy: { ...preferences.privacy, showEmail: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="privacy-phone">Show phone</Label>
                      <p className="text-xs text-muted-foreground">Display your phone number</p>
                    </div>
                    <Switch
                      id="privacy-phone"
                      checked={preferences.privacy.showPhone}
                      disabled={isSavingPreferences}
                      onCheckedChange={(checked) =>
                        persistPreferences({
                          ...preferences,
                          privacy: { ...preferences.privacy, showPhone: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="privacy-avatar">Show profile image</Label>
                      <p className="text-xs text-muted-foreground">Display your avatar</p>
                    </div>
                    <Switch
                      id="privacy-avatar"
                      checked={preferences.privacy.showProfileImage}
                      disabled={isSavingPreferences}
                      onCheckedChange={(checked) =>
                        persistPreferences({
                          ...preferences,
                          privacy: { ...preferences.privacy, showProfileImage: checked },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      disabled={isChangingPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Enter a new password"
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      disabled={isChangingPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Confirm your new password"
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                      {isChangingPassword ? 'Updating…' : 'Update Password'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {(activeTab === 'addresses' || activeTab === 'payment' || activeTab === 'wishlist') && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === 'addresses' && 'Saved Addresses'}
                  {activeTab === 'payment' && 'Payment Methods'}
                  {activeTab === 'wishlist' && 'My Wishlist'}
                </CardTitle>
                <CardDescription>
                  {activeTab === 'addresses' && 'Manage your delivery addresses'}
                  {activeTab === 'payment' && 'Manage your saved payment methods'}
                  {activeTab === 'wishlist' && 'Items you want to buy later'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No {activeTab} yet</p>
                  <Button>Add New</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <OrderDetailModal
        order={selectedOrder}
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
      />
    </div>
  )
}

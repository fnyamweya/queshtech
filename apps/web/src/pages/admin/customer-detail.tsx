import { useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { toast } from 'sonner'

import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { ArrowLeft, Mail, Phone, MessageCircle, ShieldBan, ShieldCheck, Power } from 'lucide-react'

import { useAdminAuth } from '@/hooks/use-admin-auth'
import { getCustomerDisplayName, type Customer } from '@/hooks/use-customers'
import { endpoints } from '@/lib/endpoints'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type CustomerDetail = Customer & {
  isBanned?: boolean
  profileImageUrl?: string
  authProvider?: string
  status?: string
  statusReason?: string | null
  lastLoginAt?: string | null
  lastPasswordChangedAt?: string | null
  twoFactorEnabled?: boolean
  mfaChannel?: string | null
  roleId?: string
  role?: { id: string; name: string; description?: string | null } | null
  profilePreferences?: Record<string, unknown>
  customerProfile?: {
    id: string
    userId: string
    dateOfBirth?: string | null
    loyaltyStatus?: string | null
    loyaltyPoints?: number | null
    marketingOptIn?: boolean | null
    tierOverrideCode?: string | null
    tierId?: string | null
    tierResolvedCode?: string | null
    tierResolvedAt?: string | null
    createdAt?: string
    updatedAt?: string
  } | null

  lifetimeValue: string
  totalOrders: string
  averageOrder: string
  orders: Array<{ id: string; date: string; total: string; status: string }>
  notes: string
  recommended: Array<{ name: string; reason: string; price: string }>
}

function toCustomerDetail(payload: any): CustomerDetail | null {
  const raw = (payload as any)?.data ?? payload
  if (!raw || typeof raw !== 'object') return null
  const id = String((raw as any).id || (raw as any)._id || (raw as any).customerId || '').trim()
  if (!id) return null

  const roleRaw = (raw as any).role
  const role =
    roleRaw && typeof roleRaw === 'object'
      ? {
          id: String((roleRaw as any).id || '').trim(),
          name: String((roleRaw as any).name || '').trim(),
          description: (roleRaw as any).description ?? null,
        }
      : null

  const customerProfileRaw = (raw as any).customerProfile
  const customerProfile =
    customerProfileRaw && typeof customerProfileRaw === 'object'
      ? {
          id: String((customerProfileRaw as any).id || '').trim(),
          userId: String((customerProfileRaw as any).userId || '').trim(),
          dateOfBirth: (customerProfileRaw as any).dateOfBirth ?? null,
          loyaltyStatus: (customerProfileRaw as any).loyaltyStatus ?? null,
          loyaltyPoints:
            typeof (customerProfileRaw as any).loyaltyPoints === 'number' ? (customerProfileRaw as any).loyaltyPoints : null,
          marketingOptIn:
            typeof (customerProfileRaw as any).marketingOptIn === 'boolean' ? (customerProfileRaw as any).marketingOptIn : null,
          tierOverrideCode: (customerProfileRaw as any).tierOverrideCode ?? null,
          tierId: (customerProfileRaw as any).tierId ?? null,
          tierResolvedCode: (customerProfileRaw as any).tierResolvedCode ?? null,
          tierResolvedAt: (customerProfileRaw as any).tierResolvedAt ?? null,
          createdAt: (customerProfileRaw as any).createdAt ? String((customerProfileRaw as any).createdAt) : undefined,
          updatedAt: (customerProfileRaw as any).updatedAt ? String((customerProfileRaw as any).updatedAt) : undefined,
        }
      : null

  return {
    id,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    firstName: typeof raw.firstName === 'string' ? raw.firstName : undefined,
    lastName: typeof raw.lastName === 'string' ? raw.lastName : undefined,
    phone:
      typeof raw.phone === 'string'
        ? raw.phone
        : typeof raw.phoneNumber === 'string'
          ? raw.phoneNumber
          : undefined,
    isActive:
      typeof raw.isActive === 'boolean'
        ? raw.isActive
        : typeof raw.active === 'boolean'
          ? raw.active
          : undefined,
    isBanned: typeof (raw as any).isBanned === 'boolean' ? (raw as any).isBanned : undefined,
    profileImageUrl: typeof (raw as any).profileImageUrl === 'string' ? (raw as any).profileImageUrl : undefined,
    authProvider: typeof (raw as any).authProvider === 'string' ? (raw as any).authProvider : undefined,
    status: typeof (raw as any).status === 'string' ? (raw as any).status : undefined,
    statusReason: (raw as any).statusReason ?? null,
    lastLoginAt: (raw as any).lastLoginAt ? String((raw as any).lastLoginAt) : null,
    lastPasswordChangedAt: (raw as any).lastPasswordChangedAt ? String((raw as any).lastPasswordChangedAt) : null,
    twoFactorEnabled: typeof (raw as any).twoFactorEnabled === 'boolean' ? (raw as any).twoFactorEnabled : undefined,
    mfaChannel: (raw as any).mfaChannel ?? null,
    roleId: typeof (raw as any).roleId === 'string' ? (raw as any).roleId : undefined,
    role: role && role.id ? role : null,
    profilePreferences:
      (raw as any).profilePreferences && typeof (raw as any).profilePreferences === 'object' ? (raw as any).profilePreferences : {},
    customerProfile: customerProfile && customerProfile.id ? customerProfile : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
    raw,
    // Future-facing placeholders so we can extend the module without reshaping the UI model.
    lifetimeValue: '—',
    totalOrders: '—',
    averageOrder: '—',
    orders: [],
    notes: '—',
    recommended: [],
  }
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function toWhatsAppE164Digits(phone?: string) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

export function AdminCustomerDetailPage() {
  const [, params] = useRoute('/axis/customers/:id')
  const [, setLocation] = useLocation()
  const { authorizedRequest, isAuthenticated } = useAdminAuth()

  const id = params?.id

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [rawJson, setRawJson] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false)
  const [whatsAppMessage, setWhatsAppMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isActionBusy, setIsActionBusy] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [editForm, setEditForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    profileImageUrl: '',
    password: '',
  })

  const title = useMemo(() => {
    if (!customer) return 'Customer'
    return `Customer: ${getCustomerDisplayName(customer)}`
  }, [customer])

  const load = async () => {
    if (!id) return
    if (!isAuthenticated) return

    setIsLoading(true)
    setError(null)
    try {
      const payload = await authorizedRequest<any>(endpoints.customers.byId(id), { method: 'GET' })
      const next = toCustomerDetail(payload)
      if (!next) throw new Error('Invalid customer response')

      setCustomer(next)
      setRawJson(JSON.stringify((payload as any)?.data ?? payload, null, 2))
      setEditForm({
        email: next.email || '',
        firstName: next.firstName || '',
        lastName: next.lastName || '',
        phone: next.phone || '',
        profileImageUrl: next.profileImageUrl || '',
        password: '',
      })
      setBanReason(typeof next.statusReason === 'string' ? next.statusReason : '')
    } catch (e: any) {
      setCustomer(null)
      setRawJson('')
      setError(e?.message || 'Failed to load customer')
      toast.error('Failed to load customer', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated])

  const handleSave = async () => {
    if (!id) return

    const patch: any = {}
    if (editForm.email.trim()) patch.email = editForm.email.trim()
    if (editForm.firstName.trim()) patch.firstName = editForm.firstName.trim()
    if (editForm.lastName.trim()) patch.lastName = editForm.lastName.trim()
    if (editForm.phone.trim()) patch.phone = editForm.phone.trim()
    if (editForm.profileImageUrl.trim()) patch.profileImageUrl = editForm.profileImageUrl.trim()
    if (editForm.password.trim()) patch.password = editForm.password.trim()

    if (Object.keys(patch).length === 0) {
      toast.message('Nothing to update')
      return
    }

    setIsSaving(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.customers.byId(id), {
        method: 'PATCH',
        body: patch,
      })
      const next = toCustomerDetail(payload)
      if (next) setCustomer(next)
      setRawJson(JSON.stringify((payload as any)?.data ?? payload, null, 2))
      setEditForm((p) => ({ ...p, password: '' }))
      setIsEditOpen(false)
      toast.success('Customer updated')
    } catch (e: any) {
      toast.error('Update failed', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await authorizedRequest(endpoints.customers.byId(id), { method: 'DELETE' })
      toast.success('Customer deleted')
      setLocation('/axis/customers')
    } catch (e: any) {
      toast.error('Delete failed', { description: e?.message || 'Please try again.' })
    }
  }

  const patchCustomer = async (patch: any, successMessage: string) => {
    if (!id) return
    setIsActionBusy(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.customers.byId(id), {
        method: 'PATCH',
        body: patch,
      })
      const next = toCustomerDetail(payload)
      if (next) setCustomer(next)
      setRawJson(JSON.stringify((payload as any)?.data ?? payload, null, 2))
      toast.success(successMessage)
    } catch (e: any) {
      toast.error('Action failed', { description: e?.message || 'Please try again.' })
    } finally {
      setIsActionBusy(false)
    }
  }

  const handleToggleActive = async () => {
    if (!customer) return
    await patchCustomer({ isActive: !customer.isActive }, customer.isActive ? 'Customer deactivated' : 'Customer activated')
  }

  const handleToggleBan = async () => {
    if (!customer) return
    if (customer.isBanned) {
      await patchCustomer({ isBanned: false, statusReason: null }, 'Customer unbanned')
    } else {
      await patchCustomer({ isBanned: true, statusReason: banReason.trim() || null }, 'Customer banned')
    }
  }

  const handleSendWhatsApp = () => {
    const phoneDigits = toWhatsAppE164Digits(customer?.phone)
    if (!phoneDigits) {
      toast.error('Missing phone number', { description: 'This customer has no valid phone number for WhatsApp.' })
      return
    }
    const text = (whatsAppMessage || '').trim()
    const url = text
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${phoneDigits}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setIsWhatsAppOpen(false)
    setWhatsAppMessage('')
  }

  if (!id) {
    return (
      <AdminLayout title="Customer not found">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">No customer matches this ID.</p>
          <Button className="mt-4" onClick={() => setLocation('/axis/customers')}>
            Back to customers
          </Button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={title} description="Account and contact details.">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation('/axis/customers')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
          </Button>

          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)} disabled={!customer || isLoading}>
            Edit
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!customer || isLoading}>
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete customer?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {customer && (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarImage src={customer.profileImageUrl || undefined} alt={getCustomerDisplayName(customer)} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(getCustomerDisplayName(customer))}
                </AvatarFallback>
              </Avatar>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold leading-none">{getCustomerDisplayName(customer)}</p>
                  {customer.status && <Badge variant="outline">{customer.status}</Badge>}
                  <Badge variant="outline">
                    {customer.isActive === true ? 'Active' : customer.isActive === false ? 'Inactive' : 'Unknown'}
                  </Badge>
                  {customer.isBanned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="secondary">Not banned</Badge>}
                  {customer.customerProfile?.loyaltyStatus ? (
                    <Badge variant="secondary">Loyalty: {customer.customerProfile.loyaltyStatus}</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground break-all">{customer.email || '—'} • {customer.phone || '—'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsWhatsAppOpen(true)}
                disabled={!customer.phone}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => customer.email && window.open(`mailto:${customer.email}`, '_blank')}
                disabled={!customer.email}
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => customer.phone && window.open(`tel:${customer.phone}`, '_self')}
                disabled={!customer.phone}
              >
                <Phone className="h-4 w-4" />
                Call
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={isActionBusy}>
                    <Power className="h-4 w-4" />
                    {customer.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{customer.isActive ? 'Deactivate customer?' : 'Activate customer?'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {customer.isActive
                        ? 'They will be unable to sign in and use customer features.'
                        : 'They will regain access to sign in and use customer features.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleActive}>
                      {customer.isActive ? 'Deactivate' : 'Activate'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant={customer.isBanned ? 'outline' : 'destructive'}
                    size="sm"
                    className="gap-2"
                    disabled={isActionBusy}
                  >
                    {customer.isBanned ? <ShieldCheck className="h-4 w-4" /> : <ShieldBan className="h-4 w-4" />}
                    {customer.isBanned ? 'Unban' : 'Ban'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{customer.isBanned ? 'Unban customer?' : 'Ban customer?'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {customer.isBanned
                        ? 'They will be allowed to sign in again.'
                        : 'They will be blocked from signing in. You can optionally record a reason.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  {!customer.isBanned && (
                    <div className="grid gap-2 py-2">
                      <Label htmlFor="banReason">Reason (optional)</Label>
                      <Input
                        id="banReason"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="e.g. Chargeback abuse"
                      />
                    </div>
                  )}

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleBan}>{customer.isBanned ? 'Unban' : 'Ban'}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      )}

      {!isLoading && !customer && (
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <p className="text-muted-foreground">{error || 'No customer matches this ID.'}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
            <Button onClick={() => setLocation('/axis/customers')}>Back to customers</Button>
          </div>
        </div>
      )}

      {customer && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Overview</CardTitle>
                  <CardDescription>Identity, contact, and account status.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Customer ID</p>
                  <p className="font-mono text-xs break-all">{customer.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-sm">{customer.role?.name || '—'}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm break-all">{customer.email || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm">{customer.phone || '—'}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Auth provider</p>
                  <p className="text-sm">{customer.authProvider || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status reason</p>
                  <p className="text-sm">{customer.statusReason || '—'}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{formatDateTime(customer.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Last updated</p>
                  <p className="text-sm">{formatDateTime(customer.updatedAt)}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Last login</p>
                  <p className="text-sm">{formatDateTime(customer.lastLoginAt || undefined)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Password changed</p>
                  <p className="text-sm">{formatDateTime(customer.lastPasswordChangedAt || undefined)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loyalty & tier</CardTitle>
              <CardDescription>Customer profile, loyalty points, and tier resolution.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Loyalty status</p>
                  <p className="text-sm">{customer.customerProfile?.loyaltyStatus || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Loyalty points</p>
                  <p className="text-sm">{typeof customer.customerProfile?.loyaltyPoints === 'number' ? customer.customerProfile.loyaltyPoints : '—'}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Marketing opt-in</p>
                  <p className="text-sm">
                    {typeof customer.customerProfile?.marketingOptIn === 'boolean'
                      ? customer.customerProfile.marketingOptIn
                        ? 'Yes'
                        : 'No'
                      : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date of birth</p>
                  <p className="text-sm">{customer.customerProfile?.dateOfBirth || '—'}</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tier override</p>
                  <p className="text-sm">{customer.customerProfile?.tierOverrideCode || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tier resolved</p>
                  <p className="text-sm">{customer.customerProfile?.tierResolvedCode || '—'}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tier resolved at</p>
                  <p className="text-sm">{formatDateTime(customer.customerProfile?.tierResolvedAt || undefined)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tier ID</p>
                  <p className="text-sm font-mono text-xs break-all">{customer.customerProfile?.tierId || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {customer && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>MFA and access posture.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm">Two-factor enabled</p>
                <Badge variant="outline">
                  {customer.twoFactorEnabled === true ? 'Enabled' : customer.twoFactorEnabled === false ? 'Disabled' : '—'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">MFA channel</p>
                <p className="text-sm text-muted-foreground">{customer.mfaChannel || '—'}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">Profile image URL</p>
                <p className="text-xs text-muted-foreground truncate max-w-[12rem]">{customer.profileImageUrl || '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commerce (placeholder)</CardTitle>
              <CardDescription>Reserved for order history + spend once wired.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">LTV</p>
                <p className="text-sm font-semibold">{customer.lifetimeValue}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Orders</p>
                <p className="text-sm font-semibold">{customer.totalOrders}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Avg. order</p>
                <p className="text-sm font-semibold">{customer.averageOrder}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced</CardTitle>
              <CardDescription>Raw API payload (read-only).</CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">Toggle raw JSON</Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-3 max-h-[520px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                    {rawJson || '—'}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>Update identity and profile fields.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profileImageUrl">Profile image URL</Label>
              <Input
                id="profileImageUrl"
                value={editForm.profileImageUrl}
                onChange={(e) => setEditForm((p) => ({ ...p, profileImageUrl: e.target.value }))}
                placeholder="https://…"
              />
              <p className="text-xs text-muted-foreground">Optional. Use a publicly accessible image URL.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">New password (optional)</Label>
              <Input
                id="password"
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWhatsAppOpen} onOpenChange={setIsWhatsAppOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp message</DialogTitle>
            <DialogDescription>Opens WhatsApp in a new tab.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="waMessage">Message (optional)</Label>
            <Input
              id="waMessage"
              value={whatsAppMessage}
              onChange={(e) => setWhatsAppMessage(e.target.value)}
              placeholder="Hi Felix, following up on…"
            />
            <p className="text-xs text-muted-foreground">We’ll use the customer phone number on file.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWhatsAppOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendWhatsApp}>Open WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

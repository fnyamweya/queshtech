import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiRequest, ApiError } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getSafeAxisRedirectFromStorage(): string {
  try {
    const raw = window.localStorage.getItem('admin-post-auth-redirect')
    if (!raw) return '/axis/dashboard'
    const decoded = JSON.parse(raw)
    if (typeof decoded !== 'string') return '/axis/dashboard'
    if (!decoded.startsWith('/axis')) return '/axis/dashboard'
    if (decoded.startsWith('//')) return '/axis/dashboard'
    if (decoded.includes('://')) return '/axis/dashboard'
    if (decoded.startsWith('/axis/login')) return '/axis/dashboard'
    return decoded
  } catch {
    return '/axis/dashboard'
  }
}

function clearAdminSessionStorage() {
  try {
    window.localStorage.removeItem('admin-access-token')
    window.localStorage.removeItem('admin-refresh-token')
    window.localStorage.removeItem('admin-auth-user')
    window.localStorage.removeItem('admin-post-auth-redirect')
  } catch {
    // ignore
  }
}

function clearCustomerSessionStorage() {
  try {
    window.localStorage.removeItem('auth-access-token')
    window.localStorage.removeItem('auth-refresh-token')
    window.localStorage.removeItem('auth-user')
    window.localStorage.removeItem('auth-post-auth-redirect')
  } catch {
    // ignore
  }
}

function getSafeCustomerRedirectFromStorage(): string {
  try {
    const raw = window.localStorage.getItem('auth-post-auth-redirect')
    if (!raw) return '/'
    const decoded = JSON.parse(raw)
    if (typeof decoded !== 'string') return '/'
    if (!decoded.startsWith('/')) return '/'
    if (decoded.startsWith('//')) return '/'
    if (decoded.includes('://')) return '/'
    if (decoded.startsWith('/login')) return '/'
    if (decoded.startsWith('/auth/google/callback')) return '/'
    return decoded
  } catch {
    return '/'
  }
}

function normalizeRole(value: unknown): string {
  if (!value) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function extractRoleFromProfile(profilePayload: any): string {
  const p = profilePayload?.data ?? profilePayload
  return (
    p?.role ??
    p?.user?.role ??
    p?.data?.role ??
    p?.userRole ??
    p?.adminRole ??
    ''
  )
}

export function GoogleOAuthCallbackPage() {
  const [status, setStatus] = useState<'working' | 'error' | 'denied'>('working')
  const [message, setMessage] = useState('Completing Google sign-in…')

  const { searchParams } = useMemo(() => {
    const raw = typeof window === 'undefined' ? '' : window.location.search
    return { searchParams: new URLSearchParams(raw) }
  }, [])

  useEffect(() => {
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    if (error) {
      setStatus('error')
      setMessage(errorDescription ? `${error}: ${safeDecode(errorDescription)}` : error)
      return
    }

    const exchangeCode = searchParams.get('exchangeCode')
    if (!exchangeCode) {
      setStatus('error')
      setMessage('Missing exchangeCode. Please try again.')
      return
    }

    const oauthKey = (() => {
      try {
        const rawKey = window.localStorage.getItem('admin-google-oauth-key')
        if (rawKey) {
          const parsed = JSON.parse(rawKey)
          if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
        }
      } catch {
        // ignore
      }
      return 'customer'
    })()

    let cancelled = false

    ;(async () => {
      try {
        setStatus('working')
        setMessage('Exchanging sign-in code…')

        const tokens = await apiRequest<{ accessToken: string; refreshToken: string }>(endpoints.auth.oauthExchange, {
          method: 'POST',
          body: { exchangeCode },
        })

        const accessToken = tokens?.accessToken
        const refreshToken = tokens?.refreshToken
        if (!accessToken) throw new Error('Login succeeded but no access token was returned.')

        if (oauthKey === 'axis') {
          // Store admin tokens for AdminAuthProvider.
          try {
            window.localStorage.setItem('admin-access-token', JSON.stringify(accessToken))
            window.localStorage.setItem('admin-refresh-token', JSON.stringify(refreshToken || null))
          } catch {
            // ignore
          }

          setMessage('Validating admin access…')
          const profile = await apiRequest<any>(endpoints.auth.profile, {
            method: 'GET',
            token: accessToken,
          })

          const role = normalizeRole(extractRoleFromProfile(profile))
          const allowed = role === 'admin' || role === 'superadmin'

          if (!allowed) {
            clearAdminSessionStorage()
            setStatus('denied')
            setMessage('Access denied. Your account is not allowed to access Axis.')
            return
          }

          // Cache minimal admin user so UI doesn't flash signed-out.
          try {
            const p = profile?.data ?? profile
            const now = new Date().toISOString()
            const adminUser = {
              id: String(p?.id || p?.userId || p?.user?.id || p?.data?.id || `admin-${Date.now()}`),
              username: String(p?.username || p?.user?.username || p?.data?.username || p?.email || ''),
              email: String(p?.email || p?.user?.email || p?.data?.email || ''),
              role: String(p?.role || p?.user?.role || p?.data?.role || 'admin'),
              firstName: String(p?.firstName || p?.user?.firstName || p?.data?.firstName || 'Admin'),
              lastName: String(p?.lastName || p?.user?.lastName || p?.data?.lastName || 'User'),
              createdAt: String(p?.createdAt || p?.user?.createdAt || p?.data?.createdAt || now),
              lastLogin: String(p?.lastLogin || p?.user?.lastLogin || p?.data?.lastLogin || now),
            }
            window.localStorage.setItem('admin-auth-user', JSON.stringify(adminUser))
          } catch {
            // ignore
          }

          const redirectTo = getSafeAxisRedirectFromStorage()
          try {
            window.localStorage.removeItem('admin-post-auth-redirect')
          } catch {
            // ignore
          }

          if (!cancelled) window.location.href = redirectTo
          return
        }

        // Customer flow
        try {
          window.localStorage.setItem('auth-access-token', JSON.stringify(accessToken))
          window.localStorage.setItem('auth-refresh-token', JSON.stringify(refreshToken || null))
        } catch {
          // ignore
        }

        setMessage('Loading your profile…')
        try {
          const profile = await apiRequest<any>(endpoints.auth.profile, { method: 'GET', token: accessToken })
          const p = profile?.data ?? profile
          const user = {
            id: String(p?.id || p?.userId || p?.user?.id || p?.data?.id || `user-${Date.now()}`),
            firstName: String(p?.firstName || p?.user?.firstName || p?.data?.firstName || ''),
            lastName: String(p?.lastName || p?.user?.lastName || p?.data?.lastName || ''),
            phoneNumber: String(p?.phone || p?.phoneNumber || p?.user?.phone || p?.user?.phoneNumber || ''),
            email: (p?.email || p?.user?.email || p?.data?.email) as string | undefined,
            avatarUrl: (p?.avatarUrl || p?.user?.avatarUrl || p?.data?.avatarUrl) as string | undefined,
            createdAt: String(p?.createdAt || p?.user?.createdAt || p?.data?.createdAt || new Date().toISOString()),
            lastLogin: String(p?.lastLogin || p?.user?.lastLogin || p?.data?.lastLogin || new Date().toISOString()),
          }
          window.localStorage.setItem('auth-user', JSON.stringify(user))
        } catch {
          // If profile fails, keep tokens and continue.
        }

        const customerRedirect = getSafeCustomerRedirectFromStorage()
        try {
          window.localStorage.removeItem('auth-post-auth-redirect')
        } catch {
          // ignore
        }

        if (!cancelled) window.location.href = customerRedirect
      } catch (e: any) {
        if (cancelled) return
        if (e instanceof ApiError) {
          setStatus('error')
          setMessage(e.message || 'Google sign-in failed. Please try again.')
          return
        }
        setStatus('error')
        setMessage(e?.message || 'Google sign-in failed. Please try again.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Signing you in</CardTitle>
          <CardDescription>Completing Google authentication.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            {status === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className={status === 'error' || status === 'denied' ? 'text-destructive' : 'text-muted-foreground'}>{message}</span>
          </div>

          {status === 'denied' ? (
            <div className="flex items-center justify-end gap-2">
              <Button asChild variant="outline">
                <Link href="/axis/login">Back to Axis login</Link>
              </Button>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="flex items-center justify-end gap-2">
              <Button asChild variant="outline">
                <Link href="/login">Back to login</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

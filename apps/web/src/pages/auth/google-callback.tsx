import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthNotice, AuthSpinner } from '@/components/auth/auth-helpers'
import { apiRequest, ApiError, extractAccessToken, extractRefreshToken } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'
import { ArrowRight, House, ShieldWarning, WarningCircle } from '@phosphor-icons/react'

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
    if (decoded.startsWith('/oauth/google/callback')) return '/'
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

type Phase = 'init' | 'exchange' | 'validate' | 'profile' | 'redirect'

export function GoogleOAuthCallbackPage() {
  const [status, setStatus] = useState<'working' | 'error' | 'denied'>('working')
  const [message, setMessage] = useState('Completing Google sign-in…')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('init')
  const [oauthKey, setOauthKey] = useState<'customer' | 'axis'>('customer')

  const { searchParams } = useMemo(() => {
    const raw = typeof window === 'undefined' ? '' : window.location.search
    return { searchParams: new URLSearchParams(raw) }
  }, [])

  useEffect(() => {
    const storedOauthKey = (() => {
      try {
        const rawKey = window.localStorage.getItem('auth-google-oauth-key')
        if (rawKey) {
          const parsed = JSON.parse(rawKey)
          if (parsed === 'axis' || parsed === 'customer') return parsed
        }
      } catch {
        // ignore
      }
      return 'customer' as const
    })()
    setOauthKey(storedOauthKey)

    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    if (error) {
      setStatus('error')
      setErrorCode(error)
      setMessage(errorDescription ? safeDecode(errorDescription) : 'Google sign-in was cancelled or blocked.')
      return
    }

    const exchangeCode = searchParams.get('exchangeCode')
    if (!exchangeCode) {
      setStatus('error')
      setErrorCode('missing_exchange_code')
      setMessage('Missing exchangeCode. Please try again.')
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        setStatus('working')
        setPhase('exchange')
        setMessage('Exchanging sign-in code…')

        const tokens = await apiRequest<unknown>(endpoints.auth.oauthExchange, {
          method: 'POST',
          body: { exchangeCode, oauthKey: storedOauthKey },
        })

        const accessToken = extractAccessToken(tokens)
        const refreshToken = extractRefreshToken(tokens)
        if (!accessToken) throw new Error('Login succeeded but no access token was returned.')

        if (storedOauthKey === 'axis') {
          // Store admin tokens for AdminAuthProvider.
          try {
            window.localStorage.setItem('admin-access-token', JSON.stringify(accessToken))
            window.localStorage.setItem('admin-refresh-token', JSON.stringify(refreshToken || null))
          } catch {
            // ignore
          }

          setPhase('validate')
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
            setErrorCode('access_denied')
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

          setPhase('redirect')
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

        setPhase('profile')
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

        setPhase('redirect')
        if (!cancelled) window.location.href = customerRedirect
      } catch (e: any) {
        if (cancelled) return
        if (e instanceof ApiError) {
          setStatus('error')
          setErrorCode(`api_${e.status || 'error'}`)
          setMessage(e.message || 'Google sign-in failed. Please try again.')
          return
        }
        setStatus('error')
        setErrorCode('unknown_error')
        setMessage(e?.message || 'Google sign-in failed. Please try again.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  const isAdmin = oauthKey === 'axis'
  const title =
    status === 'working'
      ? `Signing you in${isAdmin ? ' to Axis' : ''}…`
      : status === 'denied'
        ? 'Access denied'
        : 'Sign-in failed'

  const description =
    status === 'working'
      ? `Completing Google authentication${isAdmin ? ' for Axis' : ''}.`
      : isAdmin
        ? 'Your Google account could not be authenticated for Axis.'
        : 'Your Google account could not be authenticated.'

  const progressValue =
    phase === 'init' ? 18 : phase === 'exchange' ? 38 : phase === 'validate' ? 58 : phase === 'profile' ? 72 : 92

  return (
    <AuthShell title={title} description={description}>
      <div className="grid gap-5">
        {status === 'working' ? (
          <>
            <AuthNotice className="flex items-start gap-3">
              <AuthSpinner className="mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Please wait</div>
                <div className="text-sm text-muted-foreground">{message}</div>
              </div>
            </AuthNotice>

            <div className="grid gap-2">
              <Progress value={progressValue} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Secure exchange</span>
                <span>{Math.min(99, Math.max(5, progressValue))}%</span>
              </div>
            </div>

            <Button asChild variant="outline" className="h-11 w-full">
              <Link href="/">
                <House size={16} weight="bold" />
                Continue shopping
              </Link>
            </Button>
          </>
        ) : status === 'denied' ? (
          <>
            <Alert variant="destructive">
              <ShieldWarning size={16} weight="bold" />
              <AlertTitle>Access denied</AlertTitle>
              <AlertDescription>
                <p>{message}</p>
                {errorCode ? (
                  <p>
                    <Badge variant="secondary" className="mt-1">
                      {errorCode}
                    </Badge>
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild className="h-11 w-full">
                <Link href="/axis/login">
                  Back to Axis login
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 w-full">
                <Link href="/">
                  <House size={16} weight="bold" />
                  Home
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert variant="destructive">
              <WarningCircle size={16} weight="bold" />
              <AlertTitle>Google sign-in failed</AlertTitle>
              <AlertDescription>
                <p>{message}</p>
                {errorCode ? (
                  <p>
                    <Badge variant="secondary" className="mt-1">
                      {errorCode}
                    </Badge>
                  </p>
                ) : null}
                <p className="mt-2">
                  Try a different Google account, or sign in with email/phone instead.
                </p>
              </AlertDescription>
            </Alert>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild className="h-11 w-full">
                <Link href="/login">
                  Back to sign in
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 w-full">
                <Link href="/">
                  <House size={16} weight="bold" />
                  Home
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  )
}

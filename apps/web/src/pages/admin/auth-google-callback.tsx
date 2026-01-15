import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiRequest, extractAccessToken, extractRefreshToken } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'
import { useStorage } from '@/hooks/use-storage'

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getSafeRedirect(searchParams: URLSearchParams) {
  const raw = searchParams.get('redirect')
  if (!raw) return null

  const decoded = safeDecode(raw)

  if (!decoded.startsWith('/axis')) return null
  if (decoded.startsWith('//')) return null
  if (decoded.includes('://')) return null
  if (decoded.startsWith('/axis/login')) return null

  return decoded
}

export function AdminGoogleAuthCallbackPage() {
  const [, setAccessToken] = useStorage<string | null>('admin-access-token', null)
  const [, setRefreshToken] = useStorage<string | null>('admin-refresh-token', null)
  const [storedRedirect, setStoredRedirect] = useStorage<string | null>('admin-post-auth-redirect', null)
  const [storedOAuthKey] = useStorage<string | null>('admin-google-oauth-key', null)

  const [status, setStatus] = useState<'working' | 'error'>('working')
  const [message, setMessage] = useState<string>('Completing Google sign-in…')

  const { searchParams } = useMemo(() => {
    const raw = typeof window === 'undefined' ? '' : window.location.search
    return { searchParams: new URLSearchParams(raw) }
  }, [])

  const redirectTo = useMemo(() => {
    const fromQuery = getSafeRedirect(searchParams)
    if (fromQuery) return fromQuery
    if (storedRedirect && storedRedirect.startsWith('/axis') && !storedRedirect.startsWith('//') && !storedRedirect.includes('://') && !storedRedirect.startsWith('/axis/login')) {
      return storedRedirect
    }
    return '/axis/dashboard'
  }, [searchParams, storedRedirect])

  useEffect(() => {
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      setStatus('error')
      setMessage(errorDescription ? `${error}: ${errorDescription}` : error)
      return
    }

    const tokenSource = Object.fromEntries(searchParams.entries())
    const existingAccess = extractAccessToken(tokenSource)
    const existingRefresh = extractRefreshToken(tokenSource)

    // If backend already redirected us with tokens, we're done.
    if (existingAccess) {
      setAccessToken(existingAccess)
      setRefreshToken(existingRefresh)
      setStoredRedirect(null)
      window.location.href = redirectTo
      return
    }

    // Expected flow: backend callback redirects back to this UI with a one-time exchangeCode.
    const exchangeCode = searchParams.get('exchangeCode')
    if (!exchangeCode) {
      setStatus('error')
      setMessage('Missing exchangeCode. Please try again.')
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        // Keep the stored key around for debugging/troubleshooting, but it isn't required for exchange.
        void storedOAuthKey

        setStatus('working')
        setMessage('Exchanging sign-in code…')

        const response = await apiRequest<{ accessToken: string; refreshToken: string }>(endpoints.auth.oauthExchange, {
          method: 'POST',
          body: { exchangeCode },
        })

        const nextAccess = response?.accessToken
        const nextRefresh = response?.refreshToken

        if (!nextAccess) {
          throw new Error('Login succeeded but no access token was returned.')
        }

        if (cancelled) return

        setAccessToken(nextAccess)
        setRefreshToken(nextRefresh || null)
        setStoredRedirect(null)
        window.location.href = redirectTo
      } catch (e: any) {
        if (cancelled) return
        setStatus('error')
        setMessage(e?.message || 'Google sign-in failed. Please try again.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [redirectTo, searchParams, setAccessToken, setRefreshToken, setStoredRedirect, storedOAuthKey])

  // NOTE: This page must NOT require an authenticated AdminLayout.
  // We keep the general Axis shell look by using a minimal standalone layout.
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Signing you in</CardTitle>
          <CardDescription>Redirecting back to the admin dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            {status === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className={status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{message}</span>
          </div>

          {status === 'error' ? (
            <div className="flex items-center justify-end gap-2">
              <Button asChild variant="outline">
                <Link href="/axis/login">Back to login</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AdminUser, AdminLoginData } from '@/types/admin'
import { apiRequest, apiUrl, ApiError, extractAccessToken, extractRefreshToken } from '@/lib/api'
import { createApiClient } from '@/lib/api-client'
import { useStorage } from '@/hooks/use-storage'
import { endpoints } from '@/lib/endpoints'

type RefreshResult = { success: boolean; accessToken?: string; refreshToken?: string; error?: string }

export type AdminAuthContextValue = {
  adminUser: AdminUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isReady: boolean
  // Back-compat alias
  isInitialized: boolean
  isLoading: boolean
  login: (data: AdminLoginData) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: (key?: string) => void
  inviteUser: (data: { email: string; phone: string; roleId: string; firstName?: string; lastName?: string }) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshSession: () => Promise<RefreshResult>
  authorizedRequest: <T,>(path: string, options?: Omit<Parameters<typeof apiRequest<T>>[1], 'token'>) => Promise<T>
  getProfile: () => Promise<any>
  updateProfile: (data: { firstName?: string; lastName?: string; email?: string; phone?: string; password?: string; profileImage?: File | null }) => Promise<any>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

const toAdminUser = (payload: any, fallback: Partial<AdminUser>): AdminUser => {
  const now = new Date().toISOString()
  return {
    id: String(payload?.id || payload?.userId || payload?.user?.id || payload?.data?.id || `admin-${Date.now()}`),
    username: String(payload?.username || payload?.user?.username || payload?.data?.username || fallback.username || ''),
    email: String(payload?.email || payload?.user?.email || payload?.data?.email || fallback.email || ''),
    role: (payload?.role || payload?.user?.role || payload?.data?.role || fallback.role || 'admin') as AdminUser['role'],
    firstName: String(payload?.firstName || payload?.user?.firstName || payload?.data?.firstName || fallback.firstName || ''),
    lastName: String(payload?.lastName || payload?.user?.lastName || payload?.data?.lastName || fallback.lastName || ''),
    createdAt: String(payload?.createdAt || payload?.user?.createdAt || payload?.data?.createdAt || fallback.createdAt || now),
    lastLogin: String(payload?.lastLogin || payload?.user?.lastLogin || payload?.data?.lastLogin || fallback.lastLogin || now),
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useStorage<AdminUser | null>('admin-auth-user', null)
  const [accessToken, setAccessToken] = useStorage<string | null>('admin-access-token', null)
  const [refreshToken, setRefreshToken] = useStorage<string | null>('admin-refresh-token', null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const clearAuth = useCallback(() => {
    setAdminUser(() => null)
    setAccessToken(null)
    setRefreshToken(null)
    setIsReady(true)
  }, [setAccessToken, setAdminUser, setRefreshToken])

  const login = async (data: AdminLoginData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const api = createApiClient()
      const payload = await api.requestRaw(endpoints.adminAuth.login, {
        method: 'POST',
        body: {
          email: data.email,
          password: data.password,
          ...(data.twoFactorCode ? { twoFactorCode: data.twoFactorCode } : {}),
        },
      })

      const nextAccessToken = extractAccessToken(payload)
      const nextRefreshToken = extractRefreshToken(payload)
      // Important: clear any previously stored token if backend didn't return one.
      setAccessToken(nextAccessToken || null)
      setRefreshToken(nextRefreshToken || null)

      setAdminUser(() =>
        toAdminUser(payload, {
          username: data.email,
          email: data.email,
          role: 'admin',
          firstName: 'Admin',
          lastName: 'User',
        })
      )
      setIsReady(true)
      return { success: true }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed. Please try again.'
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Initiate Google OAuth for admin/super-admin UI using a profile key (default: 'axis').
   * Backend endpoint performs the redirect to Google OAuth.
   */
  const loginWithGoogle = (key: string = 'axis') => {
    // Backend endpoint performs the redirect to Google OAuth for the given profile key.
    // Preserve the originally requested admin path so we can redirect back after OAuth.
    let redirect: string | null = null

    try {
      const params = new URLSearchParams(window.location.search)
      const raw = params.get('redirect')
      if (raw) {
        let decoded = raw
        try {
          decoded = decodeURIComponent(raw)
        } catch {
          // ignore
        }

        // Prevent open redirects. Only allow internal admin absolute paths.
        if (decoded.startsWith('/axis') && !decoded.startsWith('//') && !decoded.includes('://') && !decoded.startsWith('/axis/login')) {
          redirect = decoded
        }
      }
    } catch {
      // ignore
    }

    try {
      if (redirect) {
        window.localStorage.setItem('admin-post-auth-redirect', JSON.stringify(redirect))
      }
      window.localStorage.setItem('admin-google-oauth-key', JSON.stringify(key))
    } catch {
      // ignore
    }

    // Spec: redirect must be a RELATIVE UI path (backend will reject absolute URLs).
    // Backend will redirect back to this route with ?exchangeCode=...
    const redirectPath = '/axis/oauth/google/callback'

    const build = (base: string) => `${base}?redirect=${encodeURIComponent(redirectPath)}`

    // Prefer spec-compliant initiation, but allow legacy deployments.
    const candidates = [endpoints.auth.googleByKey(key), endpoints.adminAuth.google, endpoints.auth.google]

    ;(async () => {
      // Only fall back on explicit 404. For other errors, let the primary route surface.
      for (const base of candidates) {
        const relative = build(base)
        const absolute = apiUrl(relative)

        try {
          const res = await fetch(absolute, {
            method: 'GET',
            redirect: 'manual',
            credentials: 'include',
          })

          if (res.status === 404) {
            continue
          }

          window.location.href = absolute
          return
        } catch {
          // Network/CORS/proxy errors: try next candidate.
          continue
        }
      }

      // Last resort: navigate to the spec route so the backend error is visible.
      window.location.href = apiUrl(build(endpoints.auth.googleByKey(key)))
    })()
  }

  const inviteUser = async (data: {
    email: string
    phone: string
    roleId: string
    firstName?: string
    lastName?: string
  }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      await authorizedRequest(endpoints.auth.inviteUser, { method: 'POST', body: data })
      return { success: true }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create invite.'
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    clearAuth()
  }

  const refreshSession = useCallback(async (): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; error?: string }> => {
    // Policy: do not attempt client-side refresh.
    // Treat refresh as unrecoverable and require re-login.
    clearAuth()
    return { success: false, error: refreshToken ? 'Session refresh disabled. Please sign in again.' : 'Missing refresh token' }
  }, [clearAuth, refreshToken, setAccessToken, setRefreshToken])

  const authorizedRequest = useCallback(
    async <T,>(path: string, options?: Omit<Parameters<typeof apiRequest<T>>[1], 'token'>) => {
      try {
        // Prefer bearer token when available; otherwise fall back to cookie-based session.
        return await apiRequest<T>(path, accessToken ? { ...(options || {}), token: accessToken } : { ...(options || {}) })
      } catch (error) {
        // Policy: treat auth failures as a hard stop.
        // Do not attempt refresh or retries to avoid loops.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearAuth()
        }
        throw error
      }
    },
    [accessToken, clearAuth]
  )

  const getProfile = useCallback(async () => {
    const payload = await authorizedRequest<any>(endpoints.auth.profile, { method: 'GET' })
    const profilePayload = (payload as any)?.data ?? payload
    setAdminUser(prev =>
      toAdminUser(profilePayload, {
        username: prev?.username || prev?.email || '',
        email: prev?.email || '',
        role: prev?.role || 'admin',
        firstName: prev?.firstName || 'Admin',
        lastName: prev?.lastName || 'User',
      })
    )
    return profilePayload
  }, [authorizedRequest, setAdminUser])

  const getProfileWithToken = useCallback(
    async (token: string) => {
      const api = createApiClient({ token })
      const payload = await api.requestRaw<any>(endpoints.auth.profile, { method: 'GET', token })
      const profilePayload = (payload as any)?.data ?? payload
      setAdminUser(prev =>
        toAdminUser(profilePayload, {
          username: prev?.username || prev?.email || '',
          email: prev?.email || '',
          role: prev?.role || 'admin',
          firstName: prev?.firstName || 'Admin',
          lastName: prev?.lastName || 'User',
        })
      )
      return profilePayload
    },
    [setAdminUser]
  )

  const updateProfile = useCallback(
    async (data: { firstName?: string; lastName?: string; email?: string; phone?: string; password?: string; profileImage?: File | null }) => {
      const form = new FormData()
      if (data.email !== undefined) form.append('email', data.email)
      if (data.firstName !== undefined) form.append('firstName', data.firstName)
      if (data.lastName !== undefined) form.append('lastName', data.lastName)
      if (data.password !== undefined) form.append('password', data.password)
      if (data.phone !== undefined) form.append('phone', data.phone)
      if (data.profileImage) form.append('profileImage', data.profileImage)

      const payload = await authorizedRequest<any>(endpoints.auth.profile, {
        method: 'PATCH',
        body: form,
      })
      const profilePayload = (payload as any)?.data ?? payload
      setAdminUser(prev =>
        toAdminUser(profilePayload, {
          username: prev?.username || prev?.email || '',
          email: prev?.email || '',
          role: prev?.role || 'admin',
          firstName: prev?.firstName || 'Admin',
          lastName: prev?.lastName || 'User',
        })
      )
      return profilePayload
    },
    [authorizedRequest, setAdminUser]
  )

  useEffect(() => {
    // One-time session boot: if we have a token or cookie session, hydrate adminUser.
    // This prevents UI showing "signed out" while a valid token exists.
    let isMounted = true
    ;(async () => {
      if (isReady) return

      try {
        if (accessToken) {
          await getProfileWithToken(accessToken)
        } else {
          // Try cookie-based admin session, if present.
          await getProfile()
        }
      } catch (e) {
        // If profile load fails, treat as signed-out.
        clearAuth()
      } finally {
        if (isMounted) setIsReady(true)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [accessToken, clearAuth, getProfile, getProfileWithToken, isReady])

  const value = useMemo<AdminAuthContextValue>(() => {
    const isAuthenticated = Boolean(adminUser)
    return {
      adminUser,
      accessToken,
      refreshToken,
      isAuthenticated,
      isReady,
      isInitialized: isReady,
      isLoading,
      login,
      loginWithGoogle,
      inviteUser,
      refreshSession,
      authorizedRequest,
      getProfile,
      updateProfile,
      logout,
    }
  }, [accessToken, adminUser, authorizedRequest, getProfile, inviteUser, isLoading, isReady, login, refreshSession, refreshToken, updateProfile])

  return createElement(AdminAuthContext.Provider, { value }, children)
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}

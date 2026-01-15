import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User, SignupData, LoginData } from '@/types/auth'
import { apiRequest, ApiError, extractAccessToken, extractRefreshToken } from '@/lib/api'
import { createApiClient } from '@/lib/api-client'
import { useStorage } from '@/hooks/use-storage'
import type { UserProfilePreferences } from '@/types/profilePreferences'
import { endpoints } from '@/lib/endpoints'
import { apiUrl } from '@/lib/api'

type RefreshResult = { success: boolean; accessToken?: string; refreshToken?: string; error?: string }

export type AuthContextValue = {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isReady: boolean
  isLoading: boolean
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>
  login: (data: LoginData) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshSession: () => Promise<RefreshResult>
  authorizedRequest: <T,>(path: string, options?: Omit<Parameters<typeof apiRequest<T>>[1], 'token'>) => Promise<T>
  getProfile: () => Promise<any>
  updateProfile: (data: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    password?: string
    profileImage?: File | null
    profilePreferences?: UserProfilePreferences
  }) => Promise<any>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const toUser = (payload: any, fallback: Partial<User>): User => {
  const now = new Date().toISOString()
  return {
    id: String(payload?.id || payload?.userId || payload?.user?.id || payload?.data?.id || `user-${Date.now()}`),
    firstName: String(payload?.firstName || payload?.user?.firstName || payload?.data?.firstName || fallback.firstName || ''),
    lastName: String(payload?.lastName || payload?.user?.lastName || payload?.data?.lastName || fallback.lastName || ''),
    phoneNumber: String(
      payload?.phone || payload?.phoneNumber || payload?.user?.phone || payload?.user?.phoneNumber || fallback.phoneNumber || ''
    ),
    email: (payload?.email || payload?.user?.email || payload?.data?.email || fallback.email) as string | undefined,
    avatarUrl: (payload?.avatarUrl || payload?.user?.avatarUrl || payload?.data?.avatarUrl) as string | undefined,
    createdAt: String(payload?.createdAt || payload?.user?.createdAt || payload?.data?.createdAt || fallback.createdAt || now),
    lastLogin: String(payload?.lastLogin || payload?.user?.lastLogin || payload?.data?.lastLogin || fallback.lastLogin || now),
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useStorage<User | null>('auth-user', null)
  const [accessToken, setAccessToken] = useStorage<string | null>('auth-access-token', null)
  const [refreshToken, setRefreshToken] = useStorage<string | null>('auth-refresh-token', null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const clearAuth = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    setIsReady(true)
  }, [setAccessToken, setRefreshToken, setUser])

  const refreshSession = useCallback(async (): Promise<RefreshResult> => {
    // Policy: do not attempt client-side refresh.
    // Treat refresh as unrecoverable and require re-login.
    clearAuth()
    return { success: false, error: refreshToken ? 'Session refresh disabled. Please sign in again.' : 'Missing refresh token' }
  }, [clearAuth, refreshToken])

  const authorizedRequest = useCallback(
    async <T,>(path: string, options?: Omit<Parameters<typeof apiRequest<T>>[1], 'token'>) => {
      try {
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
    setUser(prev => toUser(profilePayload, prev || {}))
    return profilePayload
  }, [authorizedRequest, setUser])

  const updateProfile = useCallback(
    async (data: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      password?: string
      profileImage?: File | null
      profilePreferences?: UserProfilePreferences
    }) => {
      const useFormData = Boolean(data.profileImage)

      const payload = await authorizedRequest<any>(
        endpoints.auth.profile,
        useFormData
          ? {
              method: 'PATCH',
              body: (() => {
                const form = new FormData()
                if (data.email !== undefined) form.append('email', data.email)
                if (data.firstName !== undefined) form.append('firstName', data.firstName)
                if (data.lastName !== undefined) form.append('lastName', data.lastName)
                if (data.password !== undefined) form.append('password', data.password)
                if (data.phone !== undefined) form.append('phone', data.phone)
                if (data.profileImage) form.append('profileImage', data.profileImage)
                if (data.profilePreferences !== undefined) {
                  // Note: multipart fields are strings; backend must parse this JSON.
                  form.append('profilePreferences', JSON.stringify(data.profilePreferences))
                }
                return form
              })(),
            }
          : {
              method: 'PATCH',
              body: (() => {
                const body: Record<string, unknown> = {}
                if (data.email !== undefined) body.email = data.email
                if (data.firstName !== undefined) body.firstName = data.firstName
                if (data.lastName !== undefined) body.lastName = data.lastName
                if (data.password !== undefined) body.password = data.password
                if (data.phone !== undefined) body.phone = data.phone
                if (data.profilePreferences !== undefined) body.profilePreferences = data.profilePreferences
                return body
              })(),
            }
      )
      const profilePayload = (payload as any)?.data ?? payload
      setUser(prev => toUser(profilePayload, prev || {}))
      return profilePayload
    },
    [authorizedRequest, setUser]
  )

  const ensureTokensFromPayload = useCallback(
    async (payload: any): Promise<{ accessToken: string | null; refreshToken: string | null }> => {
      const nextAccessToken = extractAccessToken(payload)
      const nextRefreshToken = extractRefreshToken(payload)
      // Important: clear any previously stored access token if the backend didn't return one,
      // otherwise we may keep using an expired token and trigger a 401 before refresh/cookie auth.
      if (nextAccessToken) setAccessToken(nextAccessToken)
      else setAccessToken(null)
      if (nextRefreshToken) setRefreshToken(nextRefreshToken)
      return { accessToken: nextAccessToken, refreshToken: nextRefreshToken }
    },
    [setAccessToken, setRefreshToken]
  )

  const getProfileWithToken = useCallback(
    async (token: string) => {
      const api = createApiClient({ token })
      const payload = await api.requestRaw<any>(endpoints.auth.profile, { method: 'GET', token })
      const profilePayload = (payload as any)?.data ?? payload
      setUser(prev => toUser(profilePayload, prev || {}))
      return profilePayload
    },
    [setUser]
  )

  const signup = useCallback(async (data: SignupData) => {
    setIsLoading(true)
    try {
      const api = createApiClient()
      // Customer account creation should use Customers controller (not legacy /users or auth register).
      await api.requestRaw(endpoints.customers.base, {
        method: 'POST',
        body: {
          phone: data.phoneNumber,
          password: data.password,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      })

      // Keep UX consistent: sign them in immediately after creation.
      const loginPayload = await api.requestRaw(endpoints.auth.customerLogin, {
        method: 'POST',
        body: {
          identifier: data.email || data.phoneNumber,
          password: data.password,
        },
      })

      const tokens = await ensureTokensFromPayload(loginPayload)
      setUser(
        toUser(loginPayload, {
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          email: data.email,
        })
      )

      // Best-effort: get canonical profile for navbar + /profile.
      try {
        if (tokens.accessToken) await getProfileWithToken(tokens.accessToken)
        else await getProfile()
      } catch {}

      return { success: true }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Signup failed. Please try again.'
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [ensureTokensFromPayload, getProfile, getProfileWithToken, setUser])

  const login = useCallback(async (data: LoginData) => {
    setIsLoading(true)
    try {
      const api = createApiClient()
      const payload = await api.requestRaw(endpoints.auth.customerLogin, {
        method: 'POST',
        body: {
          identifier: data.identifier,
          password: data.password,
        },
      })

      const tokens = await ensureTokensFromPayload(payload)

      // Set a minimal local user immediately so navbar can flip.
      setUser(toUser(payload, {
        firstName: 'Customer',
        lastName: '',
        phoneNumber: data.identifier,
        email: data.identifier.includes('@') ? data.identifier : undefined,
      }))

      // Best-effort: overwrite with canonical profile.
      try {
        if (tokens.accessToken) await getProfileWithToken(tokens.accessToken)
        else await getProfile()
      } catch {}
      return { success: true }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed. Please check your credentials.'
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [ensureTokensFromPayload, getProfile, getProfileWithToken, setUser])

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true)
    try {
      // Preserve where the user was headed so we can return after OAuth.
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

          // Prevent open redirects. Only allow internal absolute paths.
          if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('://') && !decoded.startsWith('/login') && !decoded.startsWith('/oauth/google/callback')) {
            window.localStorage.setItem('auth-post-auth-redirect', JSON.stringify(decoded))
          }
        }
      } catch {
        // ignore
      }

      // Spec: redirect must be a RELATIVE UI path.
      // Backend will redirect back to this route with ?exchangeCode=...
      const redirectPath = '/oauth/google/callback'
      const build = (base: string) => `${base}?redirect=${encodeURIComponent(redirectPath)}`

      // Store the oauthKey so the callback can bind the exchange request.
      try {
        window.localStorage.setItem('auth-google-oauth-key', JSON.stringify('customer'))
      } catch {
        // ignore
      }

      const candidates = [endpoints.auth.googleByKey('customer'), endpoints.auth.google]

      // Preflight to avoid dumping the user on a JSON 404 page.
      for (const base of candidates) {
        const relative = build(base)
        const absolute = apiUrl(relative)
        try {
          const res = await fetch(absolute, {
            method: 'GET',
            redirect: 'manual',
            credentials: 'include',
          })

          if (res.status === 404) continue

          window.location.href = absolute
          return { success: true }
        } catch {
          continue
        }
      }

      // Last resort: try the spec route.
      window.location.href = apiUrl(build(endpoints.auth.googleByKey('customer')))
      return { success: true }
    } catch {
      return { success: false, error: 'Google login failed. Please try again.' }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearAuth()
  }, [clearAuth])

  // Session restoration: ensure we have tokens and a user for navbar/profile.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // If we already have a user, we're good enough for UI.
        if (user) return

        // Try fetching profile even without an access token.
        // The backend may establish a cookie-based session (e.g. after redirect-based OAuth).
        if (accessToken) {
          await getProfile()
          return
        }

        try {
          await getProfile()
        } catch {
          // ignore: not authenticated
        }
      } catch {
        // ignore restoration failures
      } finally {
        if (!cancelled) setIsReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, getProfile, user])

  useEffect(() => {
    // If we start with a stored user, consider auth ready immediately.
    if (user && !isReady) setIsReady(true)
  }, [isReady, user])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    refreshToken,
    isAuthenticated: Boolean(user),
    isReady,
    isLoading,
    signup,
    login,
    loginWithGoogle,
    logout,
    refreshSession,
    authorizedRequest,
    getProfile,
    updateProfile,
  }), [accessToken, authorizedRequest, getProfile, isLoading, isReady, login, loginWithGoogle, logout, refreshSession, refreshToken, signup, updateProfile, user])

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return ctx
}

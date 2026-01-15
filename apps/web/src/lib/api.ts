export class ApiError extends Error {
  status?: number
  body?: unknown

  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.status = opts?.status
    this.body = opts?.body
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue }

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  signal?: AbortSignal
  headers?: Record<string, string>
}

function joinUrl(baseUrl: string, path: string) {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = baseUrl.replace(/\/$/, '')

  // Allow relative (same-origin) base URL.
  if (!base) return p

  return `${base}${p}`
}

export function getApiBaseUrl() {
  // Default to same-origin to work with local dev proxy and avoid CORS.
  // Set VITE_API_BASE_URL to an absolute URL when frontend and backend are hosted separately.
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
}

export function apiUrl(path: string) {
  return joinUrl(getApiBaseUrl(), path)
}

async function readBodySafely(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as JsonValue
    } catch {
      return null
    }
  }

  try {
    return await response.text()
  } catch {
    return null
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (!body) return undefined
  if (typeof body === 'string') return body

  if (typeof body === 'object') {
    const maybeMessage = (body as any).message
    if (typeof maybeMessage === 'string') return maybeMessage

    const maybeError = (body as any).error
    if (typeof maybeError === 'string') return maybeError

    const maybeErrors = (body as any).errors
    if (Array.isArray(maybeErrors) && typeof maybeErrors[0] === 'string') return maybeErrors[0]
  }

  return undefined
}

export async function apiRequest<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T> {
  const method = options?.method || 'GET'
  const url = apiUrl(path)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options?.headers || {}),
  }

  let body: BodyInit | undefined
  if (options?.body !== undefined) {
    const isFormData =
      typeof FormData !== 'undefined' &&
      options.body instanceof FormData

    if (isFormData) {
      // Let the browser set the multipart boundary.
      body = options.body as BodyInit
    } else {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      body = headers['Content-Type'].includes('application/json')
        ? JSON.stringify(options.body)
        : (options.body as any)
    }
  }

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: options?.signal,
    // Support cookie-based auth (same-origin by default, or cross-site when backend is separate).
    credentials: 'include',
  })

  const responseBody = await readBodySafely(response)

  if (!response.ok) {
    const message = extractErrorMessage(responseBody) || `Request failed (${response.status})`
    throw new ApiError(message, { status: response.status, body: responseBody })
  }

  return responseBody as T
}

export function extractAccessToken(payload: unknown): string | null {
  const directCandidates = [
    (payload as any)?.accessToken,
    (payload as any)?.access_token,
    (payload as any)?.access,
    (payload as any)?.token,
    (payload as any)?.jwt,
    (payload as any)?.jwtToken,
    (payload as any)?.data?.accessToken,
    (payload as any)?.data?.access_token,
    (payload as any)?.data?.access,
    (payload as any)?.data?.token,
    (payload as any)?.data?.jwt,
    (payload as any)?.tokens?.accessToken,
    (payload as any)?.tokens?.access_token,
    (payload as any)?.tokens?.access,
    (payload as any)?.data?.tokens?.accessToken,
    (payload as any)?.data?.tokens?.access_token,
    (payload as any)?.data?.tokens?.access,
  ]

  const isJwtLike = (value: unknown) => typeof value === 'string' && value.split('.').length === 3

  const directJwt = directCandidates.find(isJwtLike)
  if (directJwt && typeof directJwt === 'string') return directJwt

  const directAny = directCandidates.find(v => typeof v === 'string' && v.length > 0)
  if (directAny && typeof directAny === 'string') return directAny

  type Candidate = { token: string; score: number }
  const visited = new Set<unknown>()
  const candidates: Candidate[] = []

  const scoreAccessToken = (keyPath: string, value: string): number => {
    const path = keyPath.toLowerCase()
    const isJwt = isJwtLike(value)
    let score = 0

    if (isJwt) score += 5
    if (path.includes('access')) score += 6
    if (path.endsWith('.token') || path === 'token') score += 2
    if (path.includes('jwt')) score += 2
    if (path.includes('refresh')) score -= 10

    // Slight preference for longer JWT-ish tokens over short strings.
    if (isJwt) score += Math.min(3, Math.floor(value.length / 80))
    return score
  }

  const deepCollect = (node: unknown, depth: number, keyPath: string) => {
    if (depth > 6) return
    if (node === null || node === undefined) return

    if (typeof node === 'string') {
      const s = node
      const looksTokenish = s.length > 10
      if (looksTokenish) {
        candidates.push({ token: s, score: scoreAccessToken(keyPath, s) })
      }
      return
    }

    if (typeof node !== 'object') return
    if (visited.has(node)) return
    visited.add(node)

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        deepCollect(node[i], depth + 1, `${keyPath}[${i}]`)
      }
      return
    }

    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      deepCollect(v, depth + 1, keyPath ? `${keyPath}.${k}` : k)
    }
  }

  deepCollect(payload, 0, '')

  const best = candidates
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)[0]

  return best?.token || null
}

export function extractRefreshToken(payload: unknown): string | null {
  const directCandidates = [
    (payload as any)?.refreshToken,
    (payload as any)?.refresh_token,
    (payload as any)?.refresh,
    (payload as any)?.data?.refreshToken,
    (payload as any)?.data?.refresh_token,
    (payload as any)?.data?.refresh,
    (payload as any)?.tokens?.refreshToken,
    (payload as any)?.tokens?.refresh_token,
    (payload as any)?.tokens?.refresh,
    (payload as any)?.data?.tokens?.refreshToken,
    (payload as any)?.data?.tokens?.refresh_token,
    (payload as any)?.data?.tokens?.refresh,
  ]

  const directAny = directCandidates.find(v => typeof v === 'string' && v.length > 0)
  if (directAny && typeof directAny === 'string') return directAny

  type Candidate = { token: string; score: number }
  const visited = new Set<unknown>()
  const candidates: Candidate[] = []

  const isJwtLike = (value: unknown) => typeof value === 'string' && value.split('.').length === 3

  const scoreRefreshToken = (keyPath: string, value: string): number => {
    const path = keyPath.toLowerCase()
    let score = 0

    if (path.includes('refresh')) score += 8
    if (path.includes('token')) score += 2
    if (path.includes('access')) score -= 8
    if (path.includes('jwt')) score -= 6

    // Refresh tokens are often not JWTs, so penalize JWT-like strings.
    if (isJwtLike(value)) score -= 2
    if (value.length > 10) score += 1

    return score
  }

  const deepCollect = (node: unknown, depth: number, keyPath: string) => {
    if (depth > 6) return
    if (node === null || node === undefined) return

    if (typeof node === 'string') {
      const s = node
      if (s.length > 10) {
        candidates.push({ token: s, score: scoreRefreshToken(keyPath, s) })
      }
      return
    }

    if (typeof node !== 'object') return
    if (visited.has(node)) return
    visited.add(node)

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        deepCollect(node[i], depth + 1, `${keyPath}[${i}]`)
      }
      return
    }

    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      deepCollect(v, depth + 1, keyPath ? `${keyPath}.${k}` : k)
    }
  }

  deepCollect(payload, 0, '')

  const best = candidates
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)[0]

  return best?.token || null
}

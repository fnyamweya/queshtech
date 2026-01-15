import { apiRequest } from '@/lib/api'

/**
 * Tiny API client wrapper over `apiRequest`.
 * - Centralizes token handling (default token per client).
 * - Centralizes common "{ data: ... }" response unwrapping.
 *
 * Keep this generic so other hooks can adopt it over time.
 */

export type ApiClientOptions = {
  token?: string | null
}

type RequestOptions = Omit<Parameters<typeof apiRequest>[1], 'method' | 'body' | 'token'> & {
  token?: string | null
}

function unwrapData<T>(payload: T): T {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  if ('data' in (payload as any)) return ((payload as any).data ?? payload) as T
  return payload
}

export function createApiClient(options?: ApiClientOptions) {
  const defaultToken = options?.token ?? null

  const request = async <T,>(
    path: string,
    init: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; token?: string | null } & RequestOptions
  ): Promise<T> => {
    const payload = await apiRequest<T>(path, {
      ...(init || {}),
      method: init.method,
      body: init.body,
      token: init.token ?? defaultToken,
    })

    return unwrapData(payload)
  }

  return {
    get: <T,>(path: string, init?: RequestOptions & { token?: string | null }) =>
      request<T>(path, { ...(init || {}), method: 'GET' }),

    post: <T,>(path: string, body?: unknown, init?: RequestOptions & { token?: string | null }) =>
      request<T>(path, { ...(init || {}), method: 'POST', body }),

    put: <T,>(path: string, body?: unknown, init?: RequestOptions & { token?: string | null }) =>
      request<T>(path, { ...(init || {}), method: 'PUT', body }),

    patch: <T,>(path: string, body?: unknown, init?: RequestOptions & { token?: string | null }) =>
      request<T>(path, { ...(init || {}), method: 'PATCH', body }),

    delete: <T,>(path: string, init?: RequestOptions & { token?: string | null }) =>
      request<T>(path, { ...(init || {}), method: 'DELETE' }),

    /** Use when a caller needs the unmodified envelope (no data unwrapping). */
    requestRaw: <T,>(path: string, init: Parameters<typeof apiRequest<T>>[1]) => apiRequest<T>(path, init),
  }
}

/**
 * Optional helper for REST-y resources.
 * Example:
 *   const categories = createResource(api, endpoints.catalog.categories)
 */
export function createResource(api: ReturnType<typeof createApiClient>, basePath: string) {
  return {
    list: <T,>(init?: RequestOptions) => api.get<T>(basePath, init),
    create: <T,>(body: unknown, init?: RequestOptions) => api.post<T>(basePath, body, init),
    byId: (id: string) => `${basePath}/${encodeURIComponent(id)}`,
    get: <T,>(id: string, init?: RequestOptions) => api.get<T>(`${basePath}/${encodeURIComponent(id)}`, init),
    update: <T,>(id: string, body: unknown, init?: RequestOptions) => api.patch<T>(`${basePath}/${encodeURIComponent(id)}`, body, init),
    remove: <T,>(id: string, init?: RequestOptions) => api.delete<T>(`${basePath}/${encodeURIComponent(id)}`, init),
  }
}

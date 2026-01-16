import algoliasearch from 'algoliasearch/lite'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

export type AlgoliaCatalogPublicConfig = {
  enabled: boolean
  appId?: string
  searchApiKey?: string
  indexName?: string
  searchParamsJson?: Record<string, unknown>
  minQueryLength: number
  debounceMs: number
}

export type AlgoliaCatalogProductHit = {
  objectID: string
  productId: string
  slug: string
  title: string
  description?: string
  status?: string
  externalRef?: string
  brandId?: string
  brandName?: string
  categoryIds?: string[]
  categoryNames?: string[]
  skuIds?: string[]
  skuCodes?: string[]
  skuTitles?: string[]
  optionValues?: string[]
  tags?: string[]
  imageUrl?: string
  createdAt?: number
  updatedAt?: number
  _highlightResult?: any
}

const CONFIG_TTL_MS = 60_000
let cachedConfig: { value: AlgoliaCatalogPublicConfig; at: number } | null = null

export async function getAlgoliaCatalogPublicConfig(options?: { force?: boolean }): Promise<AlgoliaCatalogPublicConfig> {
  if (!options?.force && cachedConfig && Date.now() - cachedConfig.at < CONFIG_TTL_MS) {
    return cachedConfig.value
  }

  const api = createApiClient()
  const resp = await api.get<AlgoliaCatalogPublicConfig>(endpoints.catalog.publicSearchConfig)

  const cfg: AlgoliaCatalogPublicConfig = {
    enabled: Boolean(resp?.enabled),
    appId: resp?.appId,
    searchApiKey: resp?.searchApiKey,
    indexName: resp?.indexName,
    searchParamsJson: resp?.searchParamsJson ?? {},
    minQueryLength: typeof resp?.minQueryLength === 'number' ? resp.minQueryLength : 2,
    debounceMs: typeof resp?.debounceMs === 'number' ? resp.debounceMs : 150,
  }

  cachedConfig = { value: cfg, at: Date.now() }
  return cfg
}

export async function searchAlgoliaCatalogProducts(
  query: string,
  options?: {
    hitsPerPage?: number
    page?: number
    forceRefreshConfig?: boolean
    extraParams?: Record<string, unknown>
  },
): Promise<{ hits: AlgoliaCatalogProductHit[]; nbHits?: number }> {
  const cfg = await getAlgoliaCatalogPublicConfig({ force: options?.forceRefreshConfig })

  if (!cfg.enabled || !cfg.appId || !cfg.searchApiKey || !cfg.indexName) {
    return { hits: [], nbHits: 0 }
  }

  const q = query.trim()
  if (!q || q.length < (cfg.minQueryLength || 2)) {
    return { hits: [], nbHits: 0 }
  }

  const client = algoliasearch(cfg.appId, cfg.searchApiKey)
  const index = client.initIndex(cfg.indexName)

  const params = {
    ...(cfg.searchParamsJson ?? {}),
    ...(options?.extraParams ?? {}),
    ...(typeof options?.hitsPerPage === 'number' ? { hitsPerPage: options.hitsPerPage } : null),
    ...(typeof options?.page === 'number' ? { page: options.page } : null),
  } as any

  const result = await index.search<AlgoliaCatalogProductHit>(q, params)
  return { hits: result.hits ?? [], nbHits: result.nbHits }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import type { Banner, BannerPlacement } from '@/types/catalog'

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.results)) return p.results
  if (Array.isArray(p?.data?.items)) return p.data.items
  return []
}

function toBanner(raw: any): Banner | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || raw._id || raw.bannerId || raw.slug || '').trim()
  if (!id) return null

  const title = typeof raw.title === 'string' ? raw.title : typeof raw.headline === 'string' ? raw.headline : raw.name
  const subtitle = typeof raw.subtitle === 'string' ? raw.subtitle : raw.subTitle
  const description = typeof raw.description === 'string' ? raw.description : raw.body

  const placements = Array.isArray(raw.placements)
    ? raw.placements
        .map((p: any) => {
          const page = typeof p.page === 'string' ? p.page : typeof p.context === 'string' ? p.context : undefined
          const section = typeof p.section === 'string' ? p.section : typeof p.area === 'string' ? p.area : undefined
          if (!page || !section) return null
          const position = typeof p.position === 'number' ? p.position : typeof p.order === 'number' ? p.order : undefined
          return { page, section, position }
        })
        .filter(Boolean)
    : raw.placement
      ? [
          {
            page: typeof raw.page === 'string' ? raw.page : 'landing',
            section: raw.placement,
            position: typeof raw.position === 'number' ? raw.position : typeof raw.priority === 'number' ? raw.priority : undefined,
          },
        ]
      : []

  const placement = (raw.placement || placements[0]?.section) as BannerPlacement
  const priorityRaw = raw.priority ?? raw.sortOrder ?? raw.sort_order ?? raw.order ?? placements[0]?.position
  const priority = typeof priorityRaw === 'number' ? priorityRaw : undefined

  const startsAt = typeof raw.startsAt === 'string' ? raw.startsAt : raw.startDate
  const endsAt = typeof raw.endsAt === 'string' ? raw.endsAt : raw.endDate

  const targets = Array.isArray(raw.targets)
    ? raw.targets
        .map((t: any) => {
          const kind = typeof t.kind === 'string' ? t.kind : typeof t.type === 'string' ? t.type : undefined
          const refId = typeof t.refId === 'string' ? t.refId : typeof t.id === 'string' ? t.id : undefined
          if (!kind) return null
          return { kind, refId }
        })
        .filter(Boolean)
    : undefined

  const creative = raw.creative && typeof raw.creative === 'object'
    ? {
        kind: typeof raw.creative.kind === 'string' ? raw.creative.kind : undefined,
        imageKey: typeof raw.creative.imageKey === 'string' ? raw.creative.imageKey : undefined,
        alt: typeof raw.creative.alt === 'string' ? raw.creative.alt : undefined,
        cta: raw.creative.cta && typeof raw.creative.cta === 'object'
          ? {
              label: typeof raw.creative.cta.label === 'string' ? raw.creative.cta.label : undefined,
              url: typeof raw.creative.cta.url === 'string' ? raw.creative.cta.url : undefined,
            }
          : undefined,
      }
    : undefined

  const metaJson = raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined
  const landingSection = typeof metaJson?.landingSection === 'string' ? metaJson.landingSection : undefined

  return {
    id,
    title: typeof title === 'string' ? title : undefined,
    subtitle: typeof subtitle === 'string' ? subtitle : undefined,
    description: typeof description === 'string' ? description : undefined,
    imageUrl:
      (typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined) ||
      (typeof raw.image === 'string' ? raw.image : undefined) ||
      (creative?.imageKey ? creative.imageKey : undefined),
    mobileImageUrl: typeof raw.mobileImageUrl === 'string' ? raw.mobileImageUrl : typeof raw.mobileImage === 'string' ? raw.mobileImage : undefined,
    href: typeof raw.href === 'string' ? raw.href : typeof raw.link === 'string' ? raw.link : typeof raw.url === 'string' ? raw.url : undefined,
    placement,
    placements,
    position: raw.position ?? raw.slot ?? raw.area ?? placements[0]?.position,
    priority,
    ctaLabel: typeof raw.ctaLabel === 'string' ? raw.ctaLabel : typeof raw.buttonLabel === 'string' ? raw.buttonLabel : undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : undefined,
    startsAt: typeof startsAt === 'string' ? startsAt : undefined,
    endsAt: typeof endsAt === 'string' ? endsAt : undefined,
    metaJson,
    targets,
    landingSection,
    creative,
  }
}

export function usePublicBanners(options?: { placement?: BannerPlacement }) {
  const api = useMemo(() => createApiClient(), [])

  const [banners, setBanners] = useState<Banner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get(endpoints.banners.publicList({ placement: options?.placement, isActive: true }))
      const mapped = extractList(payload).map(toBanner).filter(Boolean) as Banner[]

      setBanners(mapped)
    } catch (e: any) {
      setBanners([])
      setError(e?.message || 'Failed to load banners')
    } finally {
      setIsLoading(false)
    }
  }, [api, options?.placement])

  useEffect(() => {
    refresh()
  }, [refresh])

  const heroBanners = useMemo(() => {
    const ranked = banners.filter((b) => {
      const placementMatch = (b.placements || []).some(
        (p) => p.page?.toLowerCase() === 'landing' && p.section?.toLowerCase() === 'hero'
      )
      const legacyMatch = (b.placement || '').toLowerCase() === 'hero'
      return placementMatch || legacyMatch
    })

    return ranked.sort((a, b) => {
      const aPos = a.placements?.find((p) => p.page?.toLowerCase() === 'landing' && p.section?.toLowerCase() === 'hero')?.position
      const bPos = b.placements?.find((p) => p.page?.toLowerCase() === 'landing' && p.section?.toLowerCase() === 'hero')?.position
      const aScore = typeof aPos === 'number' ? aPos : typeof a.priority === 'number' ? a.priority : 0
      const bScore = typeof bPos === 'number' ? bPos : typeof b.priority === 'number' ? b.priority : 0
      return aScore - bScore
    })
  }, [banners])

  const featureBanners = useMemo(() => {
    const heroIds = new Set(heroBanners.map((b) => b.id))
    const candidates = banners.filter((b) => !heroIds.has(b.id))
    return candidates.sort((a, b) => {
      const aPos = a.placements?.[0]?.position
      const bPos = b.placements?.[0]?.position
      const aScore = typeof aPos === 'number' ? aPos : typeof a.priority === 'number' ? a.priority : 0
      const bScore = typeof bPos === 'number' ? bPos : typeof b.priority === 'number' ? b.priority : 0
      return aScore - bScore
    })
  }, [banners, heroBanners])

  return { banners, heroBanners, featureBanners, isLoading, error, refresh }
}

export type AdminBannerInput = {
  title: string
  subtitle?: string
  description?: string
  imageUrl: string
  imageAlt?: string
  href?: string
  placementSection?: BannerPlacement
  priority?: number
  ctaLabel?: string
  isActive?: boolean
  startsAt?: string | null
  endsAt?: string | null
  metaJson?: Record<string, any>
  landingSection?: string
  targetKind?: string
  targetRefId?: string
}

export function useAdminBanners(options?: { token?: string | null; placement?: BannerPlacement }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [banners, setBanners] = useState<Banner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get(endpoints.banners.list({ placement: options?.placement }))
      const mapped = extractList(payload).map(toBanner).filter(Boolean) as Banner[]
      setBanners(mapped)
    } catch (e: any) {
      setBanners([])
      setError(e?.message || 'Failed to load banners')
    } finally {
      setIsLoading(false)
    }
  }, [api, options?.placement])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createBanner = useCallback(
    async (input: AdminBannerInput) => {
      const placementSection = input.placementSection || 'hero'
      const placementEntry = {
        page: 'landing',
        section: placementSection,
        position: typeof input.priority === 'number' ? input.priority : undefined,
      }

      const payload = await api.post(endpoints.banners.list(), {
        title: input.title,
        headline: input.title,
        subtitle: input.subtitle,
        description: input.description,
        body: input.description,
        imageUrl: input.imageUrl,
        mobileImageUrl: input.imageUrl,
        href: input.href,
        link: input.href,
        url: input.href,
        placement: placementSection,
        placements: [placementEntry],
        position: placementEntry.position,
        priority: input.priority,
        sortOrder: input.priority,
        ctaLabel: input.ctaLabel,
        buttonLabel: input.ctaLabel,
        isActive: input.isActive ?? true,
        startsAt: input.startsAt ?? undefined,
        endsAt: input.endsAt ?? undefined,
        targets:
          input.targetRefId && input.targetKind
            ? [
                {
                  kind: input.targetKind,
                  refId: input.targetRefId,
                },
              ]
            : undefined,
        creative: {
          kind: 'image',
          imageKey: input.imageUrl,
          alt: input.imageAlt || input.title,
          cta: { label: input.ctaLabel, url: input.href },
        },
        meta: {
          ...(input.metaJson || {}),
          landingSection: input.landingSection,
        },
        metaJson: {
          ...(input.metaJson || {}),
          landingSection: input.landingSection,
        },
      })

      const created = toBanner(payload)
      if (created) setBanners((prev) => [created, ...prev])
      return created
    },
    [api]
  )

  return {
    banners,
    isLoading,
    error,
    refresh,
    createBanner,
  }
}

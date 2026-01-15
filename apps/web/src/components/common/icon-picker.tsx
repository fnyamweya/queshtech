import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { phosphorIcons, resolvePhosphorIcon, toPhosphorComponentName, toPhosphorKey } from '@/lib/phosphor'

const PHOSPHOR_META_URL = 'https://unpkg.com/@phosphor-icons/react@2.1.7/?meta'

let cachedIconNames: string[] | null = null
let pendingIconRequest: Promise<string[]> | null = null

const fetchIconNames = async () => {
  if (cachedIconNames) return cachedIconNames
  if (pendingIconRequest) return pendingIconRequest

  pendingIconRequest = fetch(PHOSPHOR_META_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to load Phosphor icon list')
      const data = await res.json()
      const files: { path?: string }[] = Array.isArray(data?.files) ? data.files : []
      const names = files
        .map((file) => file.path || '')
        .filter((path) => path.startsWith('/dist/csr/') && path.endsWith('.mjs'))
        .map((path) => path.split('/').pop() || '')
        .map((name) => name.replace(/\.mjs$/, ''))
        .filter((name) => name && name !== 'index')

      const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
      cachedIconNames = unique
      return unique
    })
    .finally(() => {
      pendingIconRequest = null
    })

  return pendingIconRequest
}

interface IconPickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function IconPicker({ value, onChange, placeholder, className }: IconPickerProps) {
  const [icons, setIcons] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchIconNames()
      .then((names) => {
        if (!active) return
        setIcons(names)
      })
      .catch((err) => {
        if (!active) return
        setError(err?.message || 'Unable to load icons')
      })
    return () => {
      active = false
    }
  }, [])

  const selectedComponentName = useMemo(() => toPhosphorComponentName(value), [value])
  const SelectedIcon = useMemo(() => resolvePhosphorIcon(value), [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return icons
    return icons.filter((name) => name.toLowerCase().includes(q))
  }, [icons, query])

  const visible = filtered.slice(0, 120)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center">
          {SelectedIcon ? (
            <SelectedIcon size={20} weight="bold" />
          ) : (
            <span className="text-[10px] text-muted-foreground">No icon</span>
          )}
        </div>
        <div className="flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || 'Search icons (e.g. device, cart)'}
          />
          {selectedComponentName ? (
            <p className="text-xs text-muted-foreground mt-1">Selected: {selectedComponentName}</p>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-2 rounded-md border p-2 max-h-48 overflow-auto">
        {visible.map((name) => {
          const Icon = phosphorIcons[name]
          const isSelected = selectedComponentName === name
          return (
            <Button
              key={name}
              type="button"
              variant={isSelected ? 'secondary' : 'ghost'}
              size="icon"
              className={cn('h-9 w-9', isSelected && 'ring-1 ring-primary')}
              onClick={() => onChange(toPhosphorKey(name))}
              aria-label={name}
            >
              {Icon ? <Icon size={18} weight="bold" /> : null}
            </Button>
          )
        })}
      </div>

      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ph:device-mobile"
      />
    </div>
  )
}

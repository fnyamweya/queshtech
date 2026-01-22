import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ValueIcon } from '@/components/common/value-icon'
import lineiconsCss from 'lineicons/dist/lineicons.css?raw'

let cachedIconNames: string[] | null = null

function extractLineiconNames(cssText: string): string[] {
  const matches = cssText.matchAll(/\.lni-([a-z0-9-]+)::before\s*\{/g)
  const raw = Array.from(matches, (m) => m[1]).filter(Boolean)
  const unique = Array.from(new Set(raw))
    .map((n) => `lni-${n}`)
    .filter((n) => !['lni-sm', 'lni-lg', 'lni-16', 'lni-32', 'lni-is-spinning'].includes(n))
    .sort((a, b) => a.localeCompare(b))
  return unique
}

function getIconNames(): string[] {
  if (cachedIconNames) return cachedIconNames
  cachedIconNames = extractLineiconNames(lineiconsCss)
  return cachedIconNames
}

interface IconPickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function IconPicker({ value, onChange, placeholder, className }: IconPickerProps) {
  const [icons, setIcons] = useState<string[]>(() => getIconNames())
  const [query, setQuery] = useState('')

  useEffect(() => {
    setIcons(getIconNames())
  }, [])

  const selectedLabel = useMemo(() => (value || '').trim(), [value])

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
          <ValueIcon value={value} size={20} />
        </div>
        <div className="flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || 'Search icons (e.g. cart, tag, phone)'}
          />
          {selectedLabel ? (
            <p className="text-xs text-muted-foreground mt-1">Selected: {selectedLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-2 rounded-md border p-2 max-h-48 overflow-auto">
        {visible.map((name) => {
          const isSelected = (value || '').trim() === name
          return (
            <Button
              key={name}
              type="button"
              variant={isSelected ? 'secondary' : 'ghost'}
              size="icon"
              className={cn('h-9 w-9', isSelected && 'ring-1 ring-primary')}
              onClick={() => onChange(name)}
              aria-label={name}
            >
              <ValueIcon value={name} size={18} />
            </Button>
          )
        })}
      </div>

      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="lni-cart (or ph:device-mobile)"
      />
    </div>
  )
}

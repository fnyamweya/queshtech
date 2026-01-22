import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { resolvePhosphorIcon } from '@/lib/phosphor'
import { LniIcon } from '@/components/common/lni-icon'

export function ValueIcon(props: { value?: string | null; size?: number; className?: string }) {
  const value = (props.value || '').trim()
  const size = props.size ?? 16

  const Ph = useMemo(() => (value.startsWith('ph:') ? resolvePhosphorIcon(value) : null), [value])

  if (!value) return null
  if (value.startsWith('ph:') && Ph) return <Ph size={size} weight="bold" className={props.className} />
  if (value.includes('lni-') || value.startsWith('lni:')) return <LniIcon name={value} size={size} className={props.className} />

  return (
    <span className={cn('text-xs text-muted-foreground', props.className)} title={value}>
      {value.slice(0, 2).toUpperCase()}
    </span>
  )
}


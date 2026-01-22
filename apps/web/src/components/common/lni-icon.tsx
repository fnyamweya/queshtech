import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type LniIconProps = Omit<ComponentProps<'i'>, 'children'> & {
  name: string
  size?: number
  spin?: boolean
}

function normalizeLniName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('lni ')) {
    const parts = trimmed.split(/\s+/g).filter(Boolean)
    const icon = parts.find((p) => p.startsWith('lni-')) || ''
    return icon
  }
  if (trimmed.startsWith('lni:')) {
    const raw = trimmed.slice(4).trim()
    if (!raw) return ''
    return raw.startsWith('lni-') ? raw : `lni-${raw}`
  }
  return trimmed.startsWith('lni-') ? trimmed : `lni-${trimmed}`
}

export function LniIcon({ name, size = 16, spin, className, style, ...props }: LniIconProps) {
  const iconClass = normalizeLniName(name)
  return (
    <i
      aria-hidden="true"
      className={cn('lni', iconClass, spin && 'lni-is-spinning', className)}
      style={{ fontSize: size, lineHeight: 1, ...style }}
      {...props}
    />
  )
}


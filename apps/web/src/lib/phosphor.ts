import type { JSX } from 'react'
import * as PhosphorIcons from '@phosphor-icons/react'

export type PhosphorIconName = keyof typeof PhosphorIcons

type IconComponent = (props: { size?: number; weight?: any; className?: string }) => JSX.Element

const toKebabCase = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()

const toPascalCase = (value: string) =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join('')

export const toPhosphorKey = (iconName: string) => `ph:${toKebabCase(iconName)}`

export const toPhosphorComponentName = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const raw = trimmed.startsWith('ph:') ? trimmed.slice(3) : trimmed
  if (!raw) return null
  return toPascalCase(raw)
}

export const resolvePhosphorIcon = (value?: string | null): IconComponent | null => {
  const name = toPhosphorComponentName(value)
  if (!name) return null
  return (PhosphorIcons as unknown as Record<string, IconComponent>)[name] || null
}

export const phosphorIcons = PhosphorIcons as unknown as Record<string, IconComponent>

import { useEffect, useState } from 'react'
import { useStorage } from '@/hooks/use-storage'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export function useTheme() {
  // Default remains 'light' to avoid changing existing UX.
  const [theme, setTheme] = useStorage<Theme>('theme', 'light')
  const [mounted, setMounted] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (theme !== 'system') {
      setResolvedTheme(theme)
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => setResolvedTheme(media.matches ? 'dark' : 'light')
    apply()

    // Support both modern and older browsers.
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }

    media.addListener(apply)
    return () => media.removeListener(apply)
  }, [mounted, theme])

  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
  }, [mounted, resolvedTheme])

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      if (currentTheme === 'dark') return 'light'
      if (currentTheme === 'light') return 'dark'
      // From system, toggle to the opposite explicit mode.
      return resolvedTheme === 'dark' ? 'light' : 'dark'
    })
  }

  return { theme, setTheme, toggleTheme, mounted, resolvedTheme }
}

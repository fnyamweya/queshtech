import { useMemo } from 'react'
import { useStorage } from '@/hooks/use-storage'

export type AdminThemeFlavor = 'blue' | 'indigo' | 'teal' | 'jade' | 'amber'

const DEFAULT_FLAVOR: AdminThemeFlavor = 'blue'

const FLAVORS: Array<{ value: AdminThemeFlavor; label: string }> = [
  { value: 'blue', label: 'Blue' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'teal', label: 'Teal' },
  { value: 'jade', label: 'Jade' },
  { value: 'amber', label: 'Amber' },
]

export function useAdminThemeFlavor() {
  const [flavor, setFlavor] = useStorage<AdminThemeFlavor>('admin-theme-flavor', DEFAULT_FLAVOR)

  const safeFlavor = useMemo<AdminThemeFlavor>(() => {
    return FLAVORS.some((f) => f.value === flavor) ? flavor : DEFAULT_FLAVOR
  }, [flavor])

  return {
    flavor: safeFlavor,
    setFlavor,
    flavors: FLAVORS,
  }
}

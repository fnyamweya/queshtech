import { useEffect, useState } from 'react'

export function useDelayedFlag(active: boolean, delayMs = 300): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!active) {
      setReady(false)
      return
    }

    const t = window.setTimeout(() => setReady(true), delayMs)
    return () => window.clearTimeout(t)
  }, [active, delayMs])

  return active && ready
}

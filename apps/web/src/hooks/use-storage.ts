import { useCallback, useEffect, useState } from 'react'

type SetStateAction<T> = T | ((prev: T) => T)

function readFromStorage<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') return initialValue

  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return initialValue
    return JSON.parse(raw) as T
  } catch {
    return initialValue
  }
}

function writeToStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore write errors (private mode, quota exceeded)
  }

  // The native `storage` event only fires in *other* documents (tabs/windows).
  // We broadcast our own event so multiple hook instances in the same tab stay in sync.
  // Include the value so we can sync even when localStorage is unavailable/blocked.
  try {
    window.dispatchEvent(
      new CustomEvent('app:local-storage', {
        detail: { key, value },
      })
    )
  } catch {
    // ignore event errors
  }
}

/**
 * Local persistence hook compatible with `useState`/`useKV` setter signatures.
 */
export function useStorage<T>(key: string, initialValue: T): [T, (value: SetStateAction<T>) => void] {
  const [value, setValue] = useState<T>(() => readFromStorage(key, initialValue))

  useEffect(() => {
    setValue(readFromStorage(key, initialValue))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return
      if (e.key !== key) return
      setValue(readFromStorage(key, initialValue))
    }

    const onLocalBroadcast = (e: Event) => {
      const evt = e as CustomEvent<{ key?: string; value?: unknown }>
      if (!evt.detail?.key) return
      if (evt.detail.key !== key) return

      // Prefer the broadcasted value (works even when localStorage can't be read).
      if (Object.prototype.hasOwnProperty.call(evt.detail, 'value')) {
        setValue(evt.detail.value as T)
        return
      }

      setValue(readFromStorage(key, initialValue))
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('app:local-storage', onLocalBroadcast)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('app:local-storage', onLocalBroadcast)
    }
  }, [key, initialValue])

  const setStoredValue = useCallback(
    (next: SetStateAction<T>) => {
      setValue(prev => {
        const computed = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        writeToStorage(key, computed)
        return computed
      })
    },
    [key]
  )

  return [value, setStoredValue]
}

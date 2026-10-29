import { useEffect, useState } from 'react'

// useState that mirrors a string value to localStorage. `isValid` guards against stale or tampered values.
export function usePersistedState<T extends string>(key: string, initial: T, isValid?: (value: string) => boolean) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved !== null && (!isValid || isValid(saved)) ? (saved as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      if (value === initial) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      // storage unavailable; the value just won't persist
    }
  }, [key, value, initial])

  return [value, setValue] as const
}

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'theme'
const query = '(prefers-color-scheme: dark)'

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const systemTheme = (): Theme => (window.matchMedia(query).matches ? 'dark' : 'light')

// Follows the OS until the user picks a theme; the choice is then remembered.
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme())

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => {
      if (!stored()) setTheme(systemTheme())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage unavailable; the choice just won't persist
    }
    setTheme(next)
  }, [theme])

  return [theme, toggle]
}

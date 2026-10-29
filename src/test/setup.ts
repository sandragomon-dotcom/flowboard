import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { fakeDb, seed } from './fakeDb'
import { fakeSupabase, resetSupabaseMock, state } from './supabaseMock'

// Tests never touch the real database: both the Supabase client and the data layer are replaced.
vi.mock('../supabase', () => ({
  supabase: fakeSupabase,
  get missingConfig() {
    return state.missingConfig
  },
}))

vi.mock('../db', async () => {
  const actual = await vi.importActual<typeof import('../db')>('../db')
  return { ...actual, ...fakeDb }
})

beforeEach(() => {
  seed()
  resetSupabaseMock()
  // Belt and braces: a stray network call fails the test instead of leaving the machine.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('Network access is blocked in tests'))),
  )
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// jsdom gaps used by the app.
// Report "reduce motion" so the animation code takes its no-animation path.
window.matchMedia = (query: string) =>
  ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

if (!('CSS' in globalThis)) {
  Object.assign(globalThis, { CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) } })
}

Element.prototype.animate = (() => ({ finished: Promise.resolve(), cancel: () => {} })) as unknown as Element['animate']

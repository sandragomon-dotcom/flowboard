import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

// Stand-in for src/supabase.ts. Nothing here can reach a network or a real project.
export const state = {
  missingConfig: false,
  session: null as Session | null,
  authListener: null as ((event: string, session: Session | null) => void) | null,
  realtimeStatus: null as ((status: string) => void) | null,
}

export const fakeSession = { user: { id: 'user-1', email: 'me@example.com' } } as unknown as Session

const ok = () => Promise.resolve({ data: {}, error: null })

export const fakeSupabase = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: state.session } })),
    onAuthStateChange: vi.fn((cb: (event: string, session: Session | null) => void) => {
      state.authListener = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signInWithPassword: vi.fn(ok),
    signUp: vi.fn(ok),
    signOut: vi.fn(ok),
    resetPasswordForEmail: vi.fn(ok),
    updateUser: vi.fn(ok),
  },
  channel: vi.fn(() => {
    const channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn((cb?: (status: string) => void) => {
        state.realtimeStatus = cb ?? null
        return channel
      }),
    }
    return channel
  }),
  removeChannel: vi.fn(),
  // Any direct table access in a test is a mistake: tests must go through the fake db module.
  from: vi.fn(() => {
    throw new Error('Tests must not query Supabase tables directly')
  }),
}

export function resetSupabaseMock() {
  state.missingConfig = false
  state.session = null
  state.authListener = null
  state.realtimeStatus = null
}

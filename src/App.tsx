import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useState } from 'react'
import AuthForm from './components/AuthForm'
import AuthBrand from './components/AuthBrand'
import SetPassword from './components/SetPassword'
import { missingConfig, supabase } from './supabase'

// Loaded after sign-in so the public sign-in page ships less JavaScript.
const Board = lazy(() => import('./components/Board'))

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (missingConfig) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const screen = missingConfig ? 'Setup' : !ready ? '' : !session ? 'Sign in' : recovering ? 'Set a new password' : ''
  useEffect(() => {
    document.title = screen ? `${screen} – Flowboard` : 'Flowboard – Simple Team Kanban Board'
  }, [screen])

  if (missingConfig) {
    return (
      <main className="auth">
        <AuthBrand subtitle="Setup needed" />
        <div className="modal auth-card">
          <p className="form-error" role="alert">
            Supabase isn't configured. Copy <code>.env.example</code> to <code>.env.local</code>, set{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLIC_CONFIG</code>, then restart the dev server.
          </p>
        </div>
      </main>
    )
  }
  if (!ready) {
    return (
      <main className="auth" role="status">
        <span className="sr-only">Loading…</span>
        <div className="skeleton" style={{ width: 200, height: 24 }} />
      </main>
    )
  }
  if (!session) return <AuthForm />
  if (recovering) return <SetPassword onDone={() => setRecovering(false)} />

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to board
      </a>
      <Suspense
        fallback={
          <p className="loading" role="status">
            Loading board…
          </p>
        }
      >
        <Board email={session.user.email ?? ''} onSignOut={() => supabase.auth.signOut()} />
      </Suspense>
    </div>
  )
}

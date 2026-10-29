import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import AuthBrand from './AuthBrand'

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) setError(error.message)
      else setNotice('If an account exists for that email, a reset link is on its way.')
    } else if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (!data.session) setNotice('Check your email to confirm your account, then sign in.')
    }
    setBusy(false)
  }

  return (
    <main className="auth">
      <AuthBrand subtitle={mode === 'signin' ? 'Sign in to your team board' : mode === 'signup' ? 'Create your account' : 'Reset your password'} />
      <form className="modal auth-card" onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        {mode !== 'reset' && (
          <label>
            Password
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="link"
                aria-label={`${showPassword ? 'Hide' : 'Show'} password`}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice">{notice}</p>}
        <div className="modal-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </button>
        </div>
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
        {mode === 'signin' && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode('reset')
              setError(null)
              setNotice(null)
            }}
          >
            Forgot your password?
          </button>
        )}
      </form>
    </main>
  )
}

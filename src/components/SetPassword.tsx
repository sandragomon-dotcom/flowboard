import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'

export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <main className="auth">
      <form className="modal" onSubmit={submit}>
        <h1>Flowboard</h1>
        <p className="auth-sub">Choose a new password</p>
        <label>
          New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" autoFocus />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Please wait…' : 'Save password'}
          </button>
        </div>
      </form>
    </main>
  )
}

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { supabase } from './supabase'
import App from './App'
import { fakeSession, state } from './test/supabaseMock'

describe('App shell', () => {
  it('shows the sign-in form in a main landmark with its own page title', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Flowboard' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Sign in – Flowboard'))
  })

  it('shows the board with a skip link once signed in', async () => {
    state.session = fakeSession
    render(<App />)
    expect(await screen.findByText('Write spec')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to board' })).toHaveAttribute('href', '#main')
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(document.title).toBe('Flowboard – Simple Team Kanban Board')
  })

  it('explains missing configuration instead of showing a blank page', () => {
    state.missingConfig = true
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Supabase isn't configured/)
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    expect(document.title).toBe('Setup – Flowboard')
  })

  it('shows the set-password screen after following a recovery link', async () => {
    state.session = fakeSession
    render(<App />)
    await screen.findByText('Write spec')
    act(() => state.authListener?.('PASSWORD_RECOVERY', fakeSession))
    expect(await screen.findByText('Choose a new password')).toBeInTheDocument()
  })
})

describe('Sign-in form', () => {
  it('toggles password visibility with a stable, descriptive label', async () => {
    const user = userEvent.setup()
    render(<App />)
    const password = await screen.findByLabelText(/^Password/)
    expect(password).toHaveAttribute('type', 'password')
    const toggle = screen.getByRole('button', { name: 'Show password' })
    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument()
  })

  it('sends a password-reset email', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', { redirectTo: window.location.origin })
    expect(await screen.findByText(/reset link is on its way/)).toBeInTheDocument()
  })

  it('signs in with the entered credentials', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.com', password: 'correct horse' })
  })
})

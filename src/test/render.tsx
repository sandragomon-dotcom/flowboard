import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, vi } from 'vitest'
import Board from '../components/Board'

// Renders the board and waits until the (fake) database has loaded.
export async function renderBoard() {
  const user = userEvent.setup()
  const utils = render(<Board email="me@example.com" onSignOut={vi.fn()} />)
  await waitFor(() => expect(screen.queryByText('Loading board…')).not.toBeInTheDocument())
  return { user, ...utils }
}

export const dataTransfer = () => ({ setData: () => {}, getData: () => '', effectAllowed: '', dropEffect: '' })

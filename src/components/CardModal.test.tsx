import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CardModal from './CardModal'

function setup(onSave = vi.fn(() => Promise.resolve()), initial = null) {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<CardModal initial={initial} onSave={onSave} onClose={onClose} />)
  return { user, onSave, onClose }
}

describe('CardModal', () => {
  it('saves with only a title: assignee and due date are optional', async () => {
    const { user, onSave } = setup()
    await user.type(screen.getByLabelText(/^Title/), 'Just a title')
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    expect(onSave).toHaveBeenCalledWith({ title: 'Just a title', assignee: '', priority: 'Medium', dueDate: '' })
  })

  it('marks the optional fields as optional and the title as required', () => {
    setup()
    expect(screen.getByLabelText(/^Title \(required\)/)).toHaveAttribute('aria-required', 'true')
    expect(screen.getByLabelText('Assignee (optional)')).not.toBeRequired()
    expect(screen.getByLabelText('Due date (optional)')).not.toBeRequired()
  })

  it('rejects a whitespace-only title with an inline error and does not save', async () => {
    const { user, onSave } = setup()
    await user.type(screen.getByLabelText(/^Title/), '    ')
    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title')
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^Title/)).toHaveFocus()

    await user.type(screen.getByLabelText(/^Title/), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('limits field lengths to match the database constraints', () => {
    setup()
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute('maxlength', '120')
    expect(screen.getByLabelText(/^Assignee/)).toHaveAttribute('maxlength', '60')
  })

  it('stays open with the input intact when saving fails, and can be retried', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValue(undefined)
    const { user } = setup(onSave)
    await user.type(screen.getByLabelText(/^Title/), 'Keep me')
    await user.type(screen.getByLabelText(/^Assignee/), 'Sam')
    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable')
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Keep me')
    expect(screen.getByLabelText(/^Assignee/)).toHaveValue('Sam')
    expect(screen.getByRole('button', { name: 'Add card' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Add card' }))
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('closes on Escape and on Cancel', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('is a labelled modal dialog', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'New card' })).toHaveAttribute('aria-modal', 'true')
  })
})

import { act, fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeDb } from '../test/fakeDb'
import { dataTransfer, renderBoard } from '../test/render'

const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const titlesIn = (name: string) => within(column(name)).queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('creating cards', () => {
  it('adds a card to the first column from the header button', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add Card' }))
    const dialog = screen.getByRole('dialog', { name: 'New card' })
    await user.type(within(dialog).getByLabelText(/^Title/), '  Plan launch  ')
    await user.click(within(dialog).getByRole('button', { name: 'Add card' }))

    expect(fakeDb.insertCard).toHaveBeenCalledWith(
      { title: 'Plan launch', assignee: '', priority: 'Medium', dueDate: '' },
      'backlog',
      3,
    )
    expect(await within(column('Backlog')).findByText('Plan launch')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it("adds a card to a specific column from that column's own button", async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add card to In Progress' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^Title/), 'Review PR')
    await user.click(within(dialog).getByRole('button', { name: 'Add card' }))

    expect(fakeDb.insertCard).toHaveBeenCalledWith(expect.objectContaining({ title: 'Review PR' }), 'doing', 2)
    expect(await within(column('In Progress')).findByText('Review PR')).toBeInTheDocument()
  })
})

describe('editing cards', () => {
  it('opens the card prefilled and saves changes in place', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Edit Write spec' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit card' })
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Write spec')
    expect(within(dialog).getByLabelText(/^Assignee/)).toHaveValue('Ana')
    expect(within(dialog).getByLabelText('Priority')).toHaveValue('High')

    const title = within(dialog).getByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'Write the spec')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(fakeDb.updateCardFields).toHaveBeenCalledWith('c1', {
      title: 'Write the spec',
      assignee: 'Ana',
      priority: 'High',
      dueDate: '',
    })
    expect(await screen.findByText('Write the spec')).toBeInTheDocument()
    expect(titlesIn('Backlog')).toEqual(['Write the spec', 'Design UI'])
  })
})

describe('moving cards', () => {
  it('moves a card to another column with the "Move to" select', async () => {
    const { user } = await renderBoard()
    await user.selectOptions(screen.getByLabelText('Move Write spec to another column'), 'doing')

    expect(fakeDb.updateCardPlacement).toHaveBeenCalledWith('c1', 'doing', 2)
    expect(titlesIn('In Progress')).toEqual(['Ship it', 'Write spec'])
    expect(titlesIn('Backlog')).toEqual(['Design UI'])
  })

  it('moves a card right with Shift+ArrowRight', async () => {
    const { user } = await renderBoard()
    screen.getByRole('button', { name: 'Edit Write spec' }).focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(fakeDb.updateCardPlacement).toHaveBeenCalledWith('c1', 'doing', 2)
  })

  it('reorders within a column with Shift+ArrowDown and Shift+ArrowUp', async () => {
    const { user } = await renderBoard()
    screen.getByRole('button', { name: 'Edit Write spec' }).focus()
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(fakeDb.updateCardPlacement).toHaveBeenLastCalledWith('c1', 'backlog', 3)
    expect(titlesIn('Backlog')).toEqual(['Design UI', 'Write spec'])

    screen.getByRole('button', { name: 'Edit Write spec' }).focus()
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(titlesIn('Backlog')).toEqual(['Write spec', 'Design UI'])
  })

  it('does nothing at the edge of the board', async () => {
    const { user } = await renderBoard()
    screen.getByRole('button', { name: 'Edit Write spec' }).focus()
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(fakeDb.updateCardPlacement).not.toHaveBeenCalled()
    expect(screen.getByText('Write spec is already in the first column')).toBeInTheDocument()
  })

  it('drops a card onto another card to insert it before that card', async () => {
    await renderBoard()
    const source = screen.getByRole('button', { name: 'Edit Ship it' }).closest('article')!
    const target = screen.getByRole('button', { name: 'Edit Design UI' }).closest('article')!
    fireEvent.dragStart(source, { dataTransfer: dataTransfer() })
    fireEvent.drop(target, { dataTransfer: dataTransfer() })

    expect(fakeDb.updateCardPlacement).toHaveBeenCalledWith('c3', 'backlog', 1.5)
    expect(titlesIn('Backlog')).toEqual(['Write spec', 'Ship it', 'Design UI'])
  })

  it('drops a card on a column to append it', async () => {
    await renderBoard()
    const source = screen.getByRole('button', { name: 'Edit Write spec' }).closest('article')!
    fireEvent.dragStart(source, { dataTransfer: dataTransfer() })
    fireEvent.drop(column('Done'), { dataTransfer: dataTransfer() })

    expect(fakeDb.updateCardPlacement).toHaveBeenCalledWith('c1', 'done', 1)
    expect(titlesIn('Done')).toEqual(['Write spec'])
  })

  it('rolls back and shows an error when the move fails to save', async () => {
    const { user } = await renderBoard()
    const { failNextWrite } = await import('../test/fakeDb')
    failNextWrite('Could not save')
    await user.selectOptions(screen.getByLabelText('Move Write spec to another column'), 'doing')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(titlesIn('Backlog')).toEqual(['Write spec', 'Design UI'])
  })
})

describe('deleting cards', () => {
  it('hides the card at once but only deletes it after the undo window', async () => {
    await renderBoard()
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Write spec' }))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.queryByText('Write spec')).not.toBeInTheDocument()
    expect(screen.getByText(/Deleted "Write spec"/)).toBeInTheDocument()
    expect(fakeDb.deleteCardById).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fakeDb.deleteCardById).toHaveBeenCalledTimes(1)
    expect(fakeDb.deleteCardById).toHaveBeenCalledWith('c1')
    expect(screen.queryByText(/Deleted "Write spec"/)).not.toBeInTheDocument()
  })
})

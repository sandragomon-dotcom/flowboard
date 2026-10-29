import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Board from './Board'
import { card, fakeDb, failNextWrite, seed } from '../test/fakeDb'
import { dataTransfer, renderBoard } from '../test/render'
import { state } from '../test/supabaseMock'

const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })

// Delete helpers for tests that run the undo timer: load first with real timers, then switch.
async function clickAndSettle(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
  await act(() => vi.advanceTimersByTimeAsync(0))
}

describe('undoable deletes (replaced window.confirm)', () => {
  it('never opens a native confirm dialog', async () => {
    seed({
      columns: [
        { id: 'backlog', name: 'Backlog', position: 1 },
        { id: 'done', name: 'Done', position: 2 },
      ],
      cards: [card('c1', 'Write spec', 'backlog', 1), card('c4', 'Old task', 'done', 1)],
    })
    const confirm = vi.spyOn(window, 'confirm')
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Delete Write spec')
    await clickAndSettle('Clear completed')
    await clickAndSettle('Delete Backlog')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('restores a card when Undo is clicked and never deletes it', async () => {
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Delete Write spec')
    expect(screen.queryByText('Write spec')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Write spec')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(fakeDb.deleteCardById).not.toHaveBeenCalled()
  })

  it.each([
    ['Ctrl+Z', { ctrlKey: true }],
    ['Cmd+Z', { metaKey: true }],
  ])('undoes with %s', async (_label, modifier) => {
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Delete Write spec')
    fireEvent.keyDown(document.body, { key: 'z', ...modifier })
    expect(screen.getByText('Write spec')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('does not hijack Ctrl+Z while typing in a field', async () => {
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Delete Write spec')
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search cards' }), { key: 'z', ctrlKey: true })
    expect(screen.queryByText('Write spec')).not.toBeInTheDocument()
  })

  it('announces the toast through a live region that is always mounted', async () => {
    await renderBoard()
    const regions = screen.getAllByRole('status')
    expect(regions.some((r) => r.getAttribute('aria-live') === 'polite' && r.textContent === '')).toBe(true)
    vi.useFakeTimers()
    await clickAndSettle('Delete Write spec')
    const live = screen.getAllByRole('status').find((r) => r.textContent?.includes('Deleted "Write spec"'))
    expect(live).toHaveTextContent('Press Control or Command Z to undo')
  })

  it('pauses the countdown while the toast is hovered', async () => {
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Delete Write spec')
    const toast = screen.getByRole('button', { name: 'Undo' }).parentElement!
    fireEvent.mouseEnter(toast)
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(fakeDb.deleteCardById).not.toHaveBeenCalled()

    fireEvent.mouseLeave(toast)
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fakeDb.deleteCardById).toHaveBeenCalledWith('c1')
  })

  it('commits the first delete as soon as a second one starts', async () => {
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Delete Write spec')
    await clickAndSettle('Delete Design UI')
    expect(fakeDb.deleteCardById).toHaveBeenCalledWith('c1')
    expect(fakeDb.deleteCardById).not.toHaveBeenCalledWith('c2')
  })

  it('restores a cleared Done column', async () => {
    seed({ cards: [card('c4', 'Old task', 'done', 1), card('c5', 'Older task', 'done', 2)] })
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Clear completed')
    expect(screen.getByText('Deleted 2 completed cards')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(within(column('Done')).getByText('Old task')).toBeInTheDocument()
    expect(within(column('Done')).getByText('Older task')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(fakeDb.deleteCardsByStatus).not.toHaveBeenCalled()
  })

  it('deletes a column with its cards after the undo window, and Undo brings both back', async () => {
    await renderBoard()
    vi.useFakeTimers()
    await clickAndSettle('Delete Backlog')
    expect(screen.getByText(/Deleted "Backlog" column and its 2 cards/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /^Backlog/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(within(column('Backlog')).getByText('Write spec')).toBeInTheDocument()
    expect(fakeDb.deleteColumnById).not.toHaveBeenCalled()

    await clickAndSettle('Delete Backlog')
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fakeDb.deleteColumnById).toHaveBeenCalledWith('backlog')
  })

  it('keeps a pending delete hidden when a failed save triggers a reload', async () => {
    const { user } = await renderBoard()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Write spec' }))
    await waitFor(() => expect(screen.queryByText('Write spec')).not.toBeInTheDocument())

    failNextWrite()
    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    await user.type(screen.getByRole('textbox', { name: 'Column name' }), 'X{Enter}')
    await waitFor(() => expect(fakeDb.renameColumn).toHaveBeenCalled())
    await screen.findByRole('alert')
    expect(screen.queryByText('Write spec')).not.toBeInTheDocument()
  })

  it('moves focus to a neighbouring card after deleting the focused one', async () => {
    await renderBoard()
    vi.useFakeTimers()
    screen.getByRole('button', { name: 'Delete Write spec' }).focus()
    await clickAndSettle('Delete Write spec')
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(screen.getByRole('button', { name: 'Edit Design UI' })).toHaveFocus()
  })
})

describe('save and error feedback', () => {
  it('shows a failed save in a dismissible banner that survives the reload', async () => {
    const { user } = await renderBoard()
    failNextWrite('Could not save')
    await user.selectOptions(screen.getByLabelText('Move Write spec to another column'), 'doing')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not save')

    await user.click(within(alert).getByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an offline banner and a reconnecting banner', async () => {
    await renderBoard()
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/You're offline/)).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()

    act(() => state.realtimeStatus?.('CHANNEL_ERROR'))
    expect(screen.getByText(/Live updates paused/)).toBeInTheDocument()
    act(() => state.realtimeStatus?.('SUBSCRIBED'))
    expect(screen.queryByText(/Live updates paused/)).not.toBeInTheDocument()
  })

  it('shows loading text for screen readers while the board loads', async () => {
    render(<Board email="me@example.com" onSignOut={vi.fn()} />)
    expect(screen.getByText('Loading board…')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Loading board…')).not.toBeInTheDocument())
  })
})

describe('columns', () => {
  it('renders each column as a named region', async () => {
    await renderBoard()
    for (const name of ['Backlog', 'In Progress', 'Done']) expect(column(name)).toBeInTheDocument()
  })

  it.each([['{Enter}'], [' ']])('renames a column from the keyboard (%j) and returns focus to the name', async (key) => {
    const { user } = await renderBoard()
    screen.getByRole('button', { name: 'Backlog' }).focus()
    await user.keyboard(key)
    const input = screen.getByRole('textbox', { name: 'Column name' })
    await user.clear(input)
    await user.type(input, 'Todo{Enter}')

    expect(fakeDb.renameColumn).toHaveBeenCalledWith('backlog', 'Todo')
    expect(screen.getByRole('button', { name: 'Todo' })).toHaveFocus()
  })

  it('no longer renames on double-click', async () => {
    await renderBoard()
    fireEvent.doubleClick(screen.getByRole('heading', { name: /^Backlog/ }))
    expect(screen.queryByRole('textbox', { name: 'Column name' })).not.toBeInTheDocument()
  })

  it('does not offer to delete the Done column', async () => {
    await renderBoard()
    expect(screen.queryByRole('button', { name: 'Delete Done' })).not.toBeInTheDocument()
  })
})

describe('toolbar', () => {
  it('puts a "Column" button with an icon at the far end of the toolbar', async () => {
    await renderBoard()
    const toolbar = screen.getByRole('search')
    const button = toolbar.lastElementChild as HTMLElement
    expect(button).toHaveClass('add-column')
    expect(button).toHaveTextContent('Column')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(toolbar.firstElementChild).toHaveClass('search-bar')
  })

  it('adds a column inline and lets Escape cancel with focus restored', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Column' }))
    await user.type(screen.getByRole('textbox', { name: 'New column name' }), 'QA{Enter}')
    expect(fakeDb.insertColumn).toHaveBeenCalledWith('QA', 4)
    expect(await screen.findByRole('region', { name: /^QA/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Column' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Column' })).toHaveFocus()
    expect(fakeDb.insertColumn).toHaveBeenCalledTimes(1)
  })

  it('describes the filter popover with aria-controls rather than announcing a menu', async () => {
    const { user } = await renderBoard()
    const filter = screen.getByRole('button', { name: 'Filter' })
    expect(filter).not.toHaveAttribute('aria-haspopup')
    await user.click(filter)
    expect(filter).toHaveAttribute('aria-controls', 'filter-popover')
    expect(screen.getByRole('group', { name: 'Filter cards' })).toHaveAttribute('id', 'filter-popover')
  })

  it('closes the filter popover when focus leaves it', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    fireEvent.focusOut(screen.getByRole('group', { name: 'Filter cards' }), { relatedTarget: document.body })
    expect(screen.queryByRole('group', { name: 'Filter cards' })).not.toBeInTheDocument()
  })
})

describe('empty states', () => {
  it('says "No matching cards" and offers to clear a search with no results', async () => {
    const { user } = await renderBoard()
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'zzzz')
    // Columns that hold cards say the filter hid them; the genuinely empty Done column still says "No cards".
    expect(screen.getAllByText('No matching cards')).toHaveLength(2)
    expect(within(column('Done')).getByText('No cards')).toBeInTheDocument()
    expect(screen.getByText(/No cards match your search or filters/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByText('Write spec')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('')
  })

  it('welcomes a first-time user to an empty board', async () => {
    seed({ cards: [] })
    await renderBoard()
    expect(screen.getByText(/Your board is empty/)).toBeInTheDocument()
    expect(screen.getAllByText('No cards')).toHaveLength(3)
  })

  it('explains a board with no columns', async () => {
    seed({ columns: [], cards: [] })
    await renderBoard()
    expect(screen.getByText(/No columns yet/)).toBeInTheDocument()
  })
})

describe('accessibility', () => {
  it('has one main landmark', async () => {
    await renderBoard()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('announces moves made with the select and with drag and drop', async () => {
    const { user } = await renderBoard()
    await user.selectOptions(screen.getByLabelText('Move Write spec to another column'), 'doing')
    expect(screen.getByText('Moved Write spec to In Progress')).toBeInTheDocument()

    const source = screen.getByRole('button', { name: 'Edit Design UI' }).closest('article')!
    fireEvent.dragStart(source, { dataTransfer: dataTransfer() })
    fireEvent.drop(column('Done'), { dataTransfer: dataTransfer() })
    expect(screen.getByText('Moved Design UI to Done')).toBeInTheDocument()
  })

  it('makes the page inert behind the card dialog', async () => {
    const { user } = await renderBoard()
    expect(document.querySelector('[inert]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add Card' }))
    expect(document.querySelector('[inert]')).not.toBeNull()
    expect(document.querySelector('[inert]')).not.toContainElement(screen.getByRole('dialog'))
    await user.keyboard('{Escape}')
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('returns focus to the button that opened the dialog', async () => {
    const { user } = await renderBoard()
    const opener = screen.getByRole('button', { name: 'Add Card' })
    await user.click(opener)
    await user.keyboard('{Escape}')
    expect(opener).toHaveFocus()
  })

  it('keeps every card control labelled with the card it acts on', async () => {
    await renderBoard()
    const cardEl = screen.getByRole('button', { name: 'Edit Write spec' }).closest('article')!
    expect(within(cardEl).getByRole('button', { name: 'Delete Write spec' })).toBeInTheDocument()
    expect(within(cardEl).getByLabelText('Move Write spec to another column')).toBeInTheDocument()
  })
})

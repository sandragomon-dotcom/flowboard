import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from './test/supabaseMock'

// The global setup replaces db.ts with a fake; these tests exercise the real one against a fake Supabase client.
const actual = await vi.importActual<typeof import('./db')>('./db')

function mockBuilder(row: unknown = {}) {
  const builder = {
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: row, error: null })),
    eq: vi.fn(async () => ({ error: null })),
  }
  fakeSupabase.from.mockReturnValue(builder as never)
  return builder
}

describe('rowToCard', () => {
  it('maps a missing due date to an empty string', () => {
    const card = actual.rowToCard({ id: '1', title: 'T', assignee: '', priority: 'High', due_date: null, status: 'backlog', position: 1 })
    expect(card.dueDate).toBe('')
  })

  it('falls back to Medium for an unknown priority', () => {
    const card = actual.rowToCard({ id: '1', title: 'T', assignee: '', priority: 'Urgent', due_date: null, status: 'backlog', position: 1 })
    expect(card.priority).toBe('Medium')
  })
})

describe('card writes', () => {
  it('stores an empty due date as null on insert', async () => {
    const builder = mockBuilder({ id: '1', title: 'T', assignee: '', priority: 'Low', due_date: null, status: 'backlog', position: 1 })
    await actual.insertCard({ title: 'T', assignee: '', priority: 'Low', dueDate: '' }, 'backlog', 1)
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ due_date: null, status: 'backlog', position: 1 }))
  })

  it('stores an empty due date as null on update', async () => {
    const builder = mockBuilder()
    await actual.updateCardFields('1', { title: 'T', assignee: '', priority: 'Low', dueDate: '' })
    expect(builder.update).toHaveBeenCalledWith({ title: 'T', assignee: '', priority: 'Low', due_date: null })
  })

  it('throws when the database reports an error', async () => {
    const builder = mockBuilder()
    builder.eq.mockResolvedValueOnce({ error: new Error('denied') } as never)
    await expect(actual.updateCardPlacement('1', 'done', 2)).rejects.toThrow('denied')
  })
})

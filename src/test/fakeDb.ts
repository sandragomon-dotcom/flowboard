import { vi } from 'vitest'
import type { CardData, CardInput, ColumnData } from '../types'

// In-memory replacement for src/db.ts. Every function is a spy so tests can assert on what the app wrote.
export const store = {
  columns: [] as ColumnData[],
  cards: [] as CardData[],
  failNext: null as string | null,
  nextId: 1,
}

const clone = <T,>(value: T): T => structuredClone(value)

// Makes the next write reject, as if the network or the database failed.
export function failNextWrite(message = 'Database unavailable') {
  store.failNext = message
}

function maybeFail() {
  if (!store.failNext) return
  const message = store.failNext
  store.failNext = null
  throw new Error(message)
}

export const fakeDb = {
  fetchCards: vi.fn(async () => clone(store.cards)),
  fetchColumns: vi.fn(async () => clone(store.columns)),
  insertCard: vi.fn(async (input: CardInput, status: string, position: number) => {
    maybeFail()
    const card: CardData = { id: `new-${store.nextId++}`, ...input, status, position }
    store.cards.push(card)
    return clone(card)
  }),
  updateCardFields: vi.fn(async (id: string, input: CardInput) => {
    maybeFail()
    store.cards = store.cards.map((c) => (c.id === id ? { ...c, ...input } : c))
  }),
  updateCardPlacement: vi.fn(async (id: string, status: string, position: number) => {
    maybeFail()
    store.cards = store.cards.map((c) => (c.id === id ? { ...c, status, position } : c))
  }),
  deleteCardById: vi.fn(async (id: string) => {
    maybeFail()
    store.cards = store.cards.filter((c) => c.id !== id)
  }),
  deleteCardsByStatus: vi.fn(async (status: string) => {
    maybeFail()
    store.cards = store.cards.filter((c) => c.status !== status)
  }),
  deleteColumnById: vi.fn(async (id: string) => {
    maybeFail()
    store.cards = store.cards.filter((c) => c.status !== id)
    store.columns = store.columns.filter((c) => c.id !== id)
  }),
  insertColumn: vi.fn(async (name: string, position: number) => {
    maybeFail()
    const column: ColumnData = { id: `col-${store.nextId++}`, name, position }
    store.columns.push(column)
    return clone(column)
  }),
  renameColumn: vi.fn(async (id: string, name: string) => {
    maybeFail()
    store.columns = store.columns.map((c) => (c.id === id ? { ...c, name } : c))
  }),
}

export const card = (id: string, title: string, status: string, position: number, extra: Partial<CardData> = {}): CardData => ({
  id,
  title,
  assignee: '',
  priority: 'Medium',
  dueDate: '',
  status,
  position,
  ...extra,
})

// Backlog: Write spec, Design UI. In Progress: Ship it. Done: (empty).
export function seed(options: { cards?: CardData[]; columns?: ColumnData[] } = {}) {
  store.failNext = null
  store.nextId = 1
  store.columns = options.columns ?? [
    { id: 'backlog', name: 'Backlog', position: 1 },
    { id: 'doing', name: 'In Progress', position: 2 },
    { id: 'done', name: 'Done', position: 3 },
  ]
  store.cards = options.cards ?? [
    card('c1', 'Write spec', 'backlog', 1, { assignee: 'Ana', priority: 'High' }),
    card('c2', 'Design UI', 'backlog', 2),
    card('c3', 'Ship it', 'doing', 1),
  ]
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  deleteCardById,
  deleteCardsByStatus,
  deleteColumnById,
  fetchCards,
  fetchColumns,
  insertCard,
  insertColumn,
  renameColumn,
  rowToCard,
  rowToColumn,
  updateCardFields,
  updateCardPlacement,
  type CardRow,
  type ColumnRow,
} from '../db'
import { supabase } from '../supabase'
import { useTheme } from '../theme'
import { usePersistedState } from '../usePersistedState'
import { DONE_ID, PRIORITIES, type CardData, type CardInput, type ColumnData, type Priority, type ShiftDirection, type Status } from '../types'
import CardModal from './CardModal'
import Column from './Column'
import Toast from './Toast'

type ModalState = { mode: 'closed' } | { mode: 'add'; status: Status } | { mode: 'edit'; card: CardData }

interface Props {
  email: string
  onSignOut: () => void
}

const UNASSIGNED = '__unassigned__'
const UNDO_MS = 10000
const NO_CARDS: CardData[] = []

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function measureCards() {
  const layout = new Map<string, { rect: DOMRect; column: string }>()
  document.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
    layout.set(el.dataset.cardId!, {
      rect: el.getBoundingClientRect(),
      column: el.closest<HTMLElement>('[data-status]')?.dataset.status ?? '',
    })
  })
  return layout
}

// Fades an element out before React removes it.
function animateOut(els: HTMLElement[]) {
  if (!els.length || prefersReducedMotion()) return Promise.resolve()
  return Promise.all(
    els.map(
      (el) =>
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-12px) scale(0.96)' }], {
          duration: 160,
          easing: 'ease-in',
          fill: 'forwards',
        }).finished,
    ),
  ).then(() => undefined)
}

const inColumn =(cards: CardData[], status: Status) =>
  cards.filter((c) => c.status === status).sort((a, b) => a.position - b.position)

export default function Board({ email, onSignOut }: Props) {
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })
  const [dragId, setDragId] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnData[]>([])
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [query, setQuery] = usePersistedState<string>('board.search', '')
  const [theme, toggleTheme] = useTheme()

  const [priorityFilter, setPriorityFilter] = usePersistedState<Priority | ''>('board.priority', '', (v) =>
    PRIORITIES.some((p) => p === v),
  )
  const [assigneeFilter, setAssigneeFilter] = usePersistedState<string>('board.assignee', '')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const prioritySelectRef = useRef<HTMLSelectElement>(null)
  const addColumnButtonRef = useRef<HTMLButtonElement>(null)
  const wasAddingColumn = useRef(false)
  const focusCardId = useRef<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [realtimeDown, setRealtimeDown] = useState(false)
  const [toast, setToast] = useState<{ message: string; undo: () => void } | null>(null)
  const pending = useRef<{ commit: () => void; pause: () => void; resume: () => void } | null>(null)
  const pendingCards = useRef(new Set<string>())
  const pendingColumns = useRef(new Set<string>())

  // Card positions from the last layout, so the next render can slide cards from where they were.
  const lastLayout = useRef(new Map<string, { rect: DOMRect; column: string }>())
  const layoutReady = useRef(false)

  useLayoutEffect(() => {
    const next = measureCards()
    if (layoutReady.current && !prefersReducedMotion()) {
      next.forEach(({ rect, column }, id) => {
        const el = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`)
        const before = lastLayout.current.get(id)
        if (!el) return
        if (!before) {
          el.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], {
            duration: 180,
            easing: 'ease-out',
          })
          return
        }
        const dx = before.rect.left - rect.left
        const dy = before.rect.top - rect.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: 240,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
        if (before.column !== column) {
          el.animate(
            [{ boxShadow: '0 0 0 2px var(--accent)' }, { boxShadow: '0 0 0 2px transparent' }],
            { duration: 700, easing: 'ease-out' },
          )
        }
      })
    }
    lastLayout.current = next
    if (!loading) layoutReady.current = true
  })

  // Scrolling and resizing move cards without a render; keep the remembered positions current.
  useEffect(() => {
    const refresh = () => {
      lastLayout.current = measureCards()
    }
    window.addEventListener('scroll', refresh, true)
    window.addEventListener('resize', refresh)
    return () => {
      window.removeEventListener('scroll', refresh, true)
      window.removeEventListener('resize', refresh)
    }
  }, [])

  // Commits any delete still waiting on its undo window (a new delete, or leaving the board).
  const flushPending = () => {
    pending.current?.commit()
  }

  useEffect(
    () => () => {
      pending.current?.commit()
    },
    [],
  )

  // Ctrl/Cmd+Z undoes a pending delete (unless the user is typing in a field).
  useEffect(() => {
    if (!toast) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || e.shiftKey || !(e.metaKey || e.ctrlKey)) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      e.preventDefault()
      toast.undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toast])

  useEffect(() => {
    if (!filterOpen) return
    prioritySelectRef.current?.focus()
    const onDown = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFilterOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setFilterOpen(false)
      filterButtonRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])

  // Return focus to the "+ Add column" button when the inline form closes.
  useEffect(() => {
    if (wasAddingColumn.current && !addingColumn) addColumnButtonRef.current?.focus()
    wasAddingColumn.current = addingColumn
  }, [addingColumn])

  // After a keyboard move the card may have remounted in another column; put focus back on its title.
  useEffect(() => {
    const id = focusCardId.current
    if (!id) return
    focusCardId.current = null
    document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"] .card-title`)?.focus()
  }, [cards])

  const assignees = useMemo(
    () => [...new Set(cards.map((c) => c.assignee.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cards],
  )
  const hasUnassigned = useMemo(() => cards.some((c) => !c.assignee.trim()), [cards])
  const activeFilters = (priorityFilter ? 1 : 0) + (assigneeFilter ? 1 : 0)

  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  const filtering = terms.length > 0 || activeFilters > 0
  const visible = useMemo(
    () =>
      filtering
        ? cards.filter((c) => {
            if (priorityFilter && c.priority !== priorityFilter) return false
            if (assigneeFilter === UNASSIGNED ? c.assignee.trim() : assigneeFilter && c.assignee.trim() !== assigneeFilter)
              return false
            const haystack = `${c.title} ${c.assignee} ${c.priority} ${c.dueDate}`.toLowerCase()
            return terms.every((t) => haystack.includes(t))
          })
        : cards,
    [cards, filtering, priorityFilter, assigneeFilter, terms],
  )
  // Group and sort once per change instead of once per column per render.
  const visibleByColumn = useMemo(() => {
    const map = new Map<string, CardData[]>()
    for (const c of visible) map.set(c.status, [...(map.get(c.status) ?? []), c])
    map.forEach((list) => list.sort((a, b) => a.position - b.position))
    return map
  }, [visible])
  const totalByColumn = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cards) map.set(c.status, (map.get(c.status) ?? 0) + 1)
    return map
  }, [cards])

  const reload = useCallback(async () => {
    try {
      const [loadedColumns, loadedCards] = await Promise.all([fetchColumns(), fetchCards()])
      setColumns(loadedColumns.filter((c) => !pendingColumns.current.has(c.id)))
      setCards(loadedCards.filter((c) => !pendingCards.current.has(c.id) && !pendingColumns.current.has(c.status)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load cards')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()

    const channel = supabase
      .channel('cards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) setCards((prev) => prev.filter((c) => c.id !== id))
        } else {
          const card = rowToCard(payload.new as CardRow)
          setCards((prev) => (prev.some((c) => c.id === card.id) ? prev.map((c) => (c.id === card.id ? card : c)) : [...prev, card]))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) {
            setColumns((prev) => prev.filter((c) => c.id !== id))
            setCards((prev) => prev.filter((c) => c.status !== id))
          }
        } else {
          const column = rowToColumn(payload.new as ColumnRow)
          setColumns((prev) =>
            (prev.some((c) => c.id === column.id) ? prev.map((c) => (c.id === column.id ? column : c)) : [...prev, column]).sort(
              (a, b) => a.position - b.position,
            ),
          )
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeDown((down) => {
            if (down) void reload()
            return false
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeDown(true)
        }
      })

    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      supabase.removeChannel(channel)
    }
  }, [reload])

  // Runs a write; on failure shows the error and resyncs from the database.
  const run = async (action: () => Promise<void>) => {
    try {
      await action()
      setError(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong'
      await reload()
      // reload() clears the error on success, so show this one afterwards.
      setError(message)
    }
  }

  const closeModal = () => setModal({ mode: 'closed' })

  // Throws on failure so the modal can stay open and show the error with the user's input intact.
  const handleSave = async (input: CardInput) => {
    const current = modal
    if (current.mode === 'add') {
      const col = inColumn(cards, current.status)
      const position = col.length ? col[col.length - 1].position + 1 : 1
      const created = await insertCard(input, current.status, position)
      setCards((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]))
    } else if (current.mode === 'edit') {
      const id = current.card.id
      await updateCardFields(id, input)
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...input } : c)))
    }
    setError(null)
    closeModal()
  }

  // Hides items right away and offers Undo; the database delete only happens once the toast expires.
  const deleteWithUndo = (
    message: string,
    items: { cards?: CardData[]; column?: ColumnData },
    commit: () => Promise<void>,
  ) => {
    const cardIds = new Set((items.cards ?? []).map((c) => c.id))
    const columnId = items.column?.id
    const leaving = columnId
      ? [document.querySelector<HTMLElement>(`[data-status="${CSS.escape(columnId)}"]`)]
      : [...cardIds].map((id) => document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`))
    const leavingEls = leaving.filter((el): el is HTMLElement => !!el)
    // If focus is inside what's being removed, pick the nearest survivor so keyboard users aren't dropped on <body>.
    let nextFocus: (() => HTMLElement | null) | null = null
    if (leavingEls.some((el) => el.contains(document.activeElement))) {
      if (columnId) nextFocus = () => addColumnButtonRef.current
      else {
        const first = leavingEls[0]
        const body = first.closest('.column-body')
        const siblings = [...(body?.querySelectorAll<HTMLElement>('[data-card-id]') ?? [])]
        const i = siblings.indexOf(first)
        const survivor = [...siblings.slice(i + 1), ...siblings.slice(0, i).reverse()].find((el) => !leavingEls.includes(el))
        const fallback = body?.querySelector<HTMLElement>('.column-add')
        nextFocus = () =>
          (survivor?.isConnected ? survivor.querySelector<HTMLElement>('.card-title') : null) ??
          (fallback?.isConnected ? fallback : null)
      }
    }
    void animateOut(leavingEls).then(() => {
      flushPending()
      const release = () => {
        cardIds.forEach((id) => pendingCards.current.delete(id))
        if (columnId) pendingColumns.current.delete(columnId)
      }
      cardIds.forEach((id) => pendingCards.current.add(id))
      if (columnId) pendingColumns.current.add(columnId)
      setCards((prev) => prev.filter((c) => !cardIds.has(c.id)))
      if (columnId) setColumns((prev) => prev.filter((c) => c.id !== columnId))
      if (nextFocus) window.requestAnimationFrame(() => nextFocus?.()?.focus())

      let timer = 0
      let remaining = UNDO_MS
      let startedAt = Date.now()
      const finish = () => {
        window.clearTimeout(timer)
        pending.current = null
        setToast(null)
        release()
        void run(commit)
      }
      // Pause the countdown while the toast is hovered or focused.
      const pause = () => {
        if (!timer) return
        window.clearTimeout(timer)
        timer = 0
        remaining -= Date.now() - startedAt
      }
      const resume = () => {
        if (timer) return
        startedAt = Date.now()
        timer = window.setTimeout(finish, Math.max(remaining, 3000))
      }
      resume()
      pending.current = { commit: finish, pause, resume }
      setToast({
        message,
        undo: () => {
          window.clearTimeout(timer)
          pending.current = null
          release()
          setToast(null)
          if (items.column) {
            const restored = items.column
            setColumns((prev) => [...prev, restored].sort((a, b) => a.position - b.position))
          }
          const restoredCards = items.cards ?? []
          setCards((prev) => [...prev, ...restoredCards])
        },
      })
    })
  }

  const openAdd = (status: Status) => setModal({ mode: 'add', status })

  const handleDelete = (id: string) => {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    deleteWithUndo(`Deleted "${card.title}"`, { cards: [card] }, () => deleteCardById(id))
  }

  const handleClearDone = () => {
    const done = cards.filter((c) => c.status === DONE_ID)
    if (!done.length) return
    deleteWithUndo(`Deleted ${done.length} completed card${done.length === 1 ? '' : 's'}`, { cards: done }, () =>
      deleteCardsByStatus(DONE_ID),
    )
  }

  const handleAddColumn = (e: FormEvent) => {
    e.preventDefault()
    const name = newColumnName.trim()
    if (!name) return
    const position = columns.length ? columns[columns.length - 1].position + 1 : 1
    setNewColumnName('')
    setAddingColumn(false)
    void run(async () => {
      const created = await insertColumn(name, position)
      setColumns((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]))
    })
  }

  const handleRenameColumn = (id: Status, name: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
    void run(() => renameColumn(id, name))
  }

  const handleDeleteColumn = (id: Status) => {
    const column = columns.find((c) => c.id === id)
    if (!column) return
    const columnCards = cards.filter((c) => c.status === id)
    const detail = columnCards.length ? ` and its ${columnCards.length} card${columnCards.length === 1 ? '' : 's'}` : ''
    deleteWithUndo(`Deleted "${column.name}" column${detail}`, { column, cards: columnCards }, () => deleteColumnById(id))
  }

  // Moves a card into `status`, placed before `beforeId` or at the end.
  const moveCard = (id: string, status: Status, beforeId?: string) => {
    if (id === beforeId) return
    const col = inColumn(cards, status).filter((c) => c.id !== id)
    const idx = beforeId ? col.findIndex((c) => c.id === beforeId) : -1
    let position: number
    if (idx === -1) position = col.length ? col[col.length - 1].position + 1 : 1
    else if (idx === 0) position = col[0].position - 1
    else position = (col[idx - 1].position + col[idx].position) / 2

    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status, position } : c)))
    void run(() => updateCardPlacement(id, status, position))
  }

  const shiftCard = (id: string, direction: ShiftDirection) => {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    focusCardId.current = id
    if (direction === 'left' || direction === 'right') {
      const target = columns[columns.findIndex((c) => c.id === card.status) + (direction === 'left' ? -1 : 1)]
      if (!target) {
        setAnnouncement(`${card.title} is already in the ${direction === 'left' ? 'first' : 'last'} column`)
        return
      }
      moveCard(id, target.id)
      setAnnouncement(`Moved ${card.title} to ${target.name}`)
      return
    }
    const col = inColumn(cards, card.status)
    const i = col.findIndex((c) => c.id === id)
    const next = direction === 'up' ? i - 1 : i + 1
    if (next < 0 || next >= col.length) {
      setAnnouncement(`${card.title} is already ${direction === 'up' ? 'first' : 'last'} in ${columns.find((c) => c.id === card.status)?.name ?? 'its column'}`)
      return
    }
    moveCard(id, card.status, direction === 'up' ? col[i - 1].id : col[i + 2]?.id)
    setAnnouncement(`Moved ${card.title} to position ${next + 1} of ${col.length}`)
  }

  // Moves from the select or a drop have no other spoken feedback.
  const moveAndAnnounce = (id: string, status: Status, beforeId?: string) => {
    const card = cards.find((c) => c.id === id)
    moveCard(id, status, beforeId)
    if (card) setAnnouncement(`Moved ${card.title} to ${columns.find((c) => c.id === status)?.name ?? 'another column'}`)
  }

  const dropOnColumn = (status: Status) => {
    if (dragId) moveAndAnnounce(dragId, status)
    setDragId(null)
  }

  const dropOnCard = (targetId: string) => {
    const target = cards.find((c) => c.id === targetId)
    if (dragId && target) moveAndAnnounce(dragId, target.status, targetId)
    setDragId(null)
  }

  return (
    <>
      <div inert={modal.mode !== 'closed'}>
      <header className="app-header">
        <h1>Flowboard</h1>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {theme === 'dark' ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              ) : (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              )}
            </svg>
          </button>
          <span className="user-email">{email}</span>
          <button type="button" className="secondary" onClick={onSignOut}>
            Sign out
          </button>
          <button type="button" className="primary" onClick={() => setModal({ mode: 'add', status: columns[0]?.id ?? 'backlog' })}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Card
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
      <p id="column-rename-hint" className="sr-only">
        Press Enter to rename this column.
      </p>
      <p id="card-shortcuts-hint" className="sr-only">
        Press Shift with the arrow keys to move this card between columns or reorder it within its column.
      </p>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <div className="toolbar" role="search">
        <div className="search-bar">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Search cards"
            aria-label="Search cards"
          />
        </div>
        <div
          className="filter"
          ref={filterRef}
          onBlur={(e) => {
            if (filterOpen && !e.currentTarget.contains(e.relatedTarget as Node | null)) setFilterOpen(false)
          }}
        >
          <button
            type="button"
            ref={filterButtonRef}
            className="filter-button"
            aria-expanded={filterOpen}
            aria-controls="filter-popover"
            onClick={() => setFilterOpen((o) => !o)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            Filter
            {activeFilters > 0 && (
              <span className="filter-badge">
                <span aria-hidden="true">{activeFilters}</span>
                <span className="sr-only">{activeFilters === 1 ? '1 filter active' : `${activeFilters} filters active`}</span>
              </span>
            )}
          </button>
          {filterOpen && (
            <div id="filter-popover" className="filter-popover" role="group" aria-label="Filter cards">
              <label>
                Priority
                <select ref={prioritySelectRef} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}>
                  <option value="">All priorities</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assignee
                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                  <option value="">All assignees</option>
                  {assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  {hasUnassigned && <option value={UNASSIGNED}>Unassigned</option>}
                  {assigneeFilter && assigneeFilter !== UNASSIGNED && !assignees.includes(assigneeFilter) && (
                    <option value={assigneeFilter}>{assigneeFilter}</option>
                  )}
                </select>
              </label>
              <button
                type="button"
                className="link"
                disabled={activeFilters === 0}
                onClick={() => {
                  setPriorityFilter('')
                  setAssigneeFilter('')
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
        {filtering && (
          <span className="search-count" aria-live="polite">
            {visible.length} of {cards.length}
          </span>
        )}
        {addingColumn ? (
          <form className="add-column-form" onSubmit={handleAddColumn}>
            <input
              autoFocus
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setNewColumnName('')
                  setAddingColumn(false)
                }
              }}
              placeholder="Column name"
              aria-label="New column name"
              maxLength={40}
            />
            <div>
              <button type="submit" className="primary-small" disabled={!newColumnName.trim()}>
                Add column
              </button>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setNewColumnName('')
                  setAddingColumn(false)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="add-column" ref={addColumnButtonRef} onClick={() => setAddingColumn(true)}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Column
          </button>
        )}
      </div>
      {(!online || realtimeDown) && (
        <p className="banner-warning" role="status">
          {online ? 'Live updates paused. Reconnecting…' : "You're offline. Changes won't save until you reconnect."}
        </p>
      )}
      {filtering && !loading && visible.length === 0 && cards.length > 0 && (
        <p className="board-empty" role="status">
          No cards match your search or filters.{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setQuery('')
              setPriorityFilter('')
              setAssigneeFilter('')
            }}
          >
            Clear all
          </button>
        </p>
      )}
      {!filtering && !loading && columns.length > 0 && cards.length === 0 && (
        <p className="board-empty">Your board is empty. Add your first card with “+ Add card” or the button above.</p>
      )}
      {error && (
        <p className="banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="link" onClick={() => setError(null)} aria-label="Dismiss error">
            Dismiss
          </button>
        </p>
      )}
      {loading ? (
        <div className="board" role="status">
          <span className="sr-only">Loading board…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="column">
              <div className="skeleton" style={{ width: '50%', height: 20, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 84, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 84 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="board">
          {columns.length === 0 && (
            <p className="board-empty">No columns yet. Use “+ Column” in the toolbar to create your first one.</p>
          )}
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              columns={columns}
              cards={visibleByColumn.get(column.id) ?? NO_CARDS}
              total={totalByColumn.get(column.id) ?? 0}
              filtering={filtering}
              onAdd={openAdd}
              onClear={column.id === DONE_ID ? handleClearDone : undefined}
              onRename={handleRenameColumn}
              onDeleteColumn={handleDeleteColumn}
              onEdit={(card) => setModal({ mode: 'edit', card })}
              onDelete={handleDelete}
              onMove={(id, s) => moveAndAnnounce(id, s)}
              onShift={shiftCard}
              onDragStart={setDragId}
              onDragEnd={() => setDragId(null)}
              onDropOnColumn={dropOnColumn}
              onDropOnCard={dropOnCard}
            />
          ))}
        </div>
      )}
      </main>
      </div>
      {modal.mode !== 'closed' && (
        <CardModal initial={modal.mode === 'edit' ? modal.card : null} onSave={handleSave} onClose={closeModal} />
      )}
      <Toast toast={toast} onPause={() => pending.current?.pause()} onResume={() => pending.current?.resume()} />
    </>
  )
}

import { useState } from 'react'
import { DONE_ID, type CardData, type ColumnData, type ShiftDirection, type Status } from '../types'

interface Props {
  card: CardData
  columns: ColumnData[]
  onEdit: (card: CardData) => void
  onDelete: (id: string) => void
  onMove: (id: string, status: Status) => void
  onShift: (id: string, direction: ShiftDirection) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDropOnCard: (targetId: string) => void
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

function formatDate(iso: string): string {
  if (!iso) return 'No due date'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(card: CardData): boolean {
  if (!card.dueDate || card.status === DONE_ID) return false
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return card.dueDate < iso
}

const SHIFT_KEYS: Record<string, ShiftDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

export default function Card({ card, columns, onEdit, onDelete, onMove, onShift, onDragStart, onDragEnd, onDropOnCard }: Props) {
  const overdue = isOverdue(card)
  const [dragging, setDragging] = useState(false)
  const [dropBefore, setDropBefore] = useState(false)
  return (
    <article
      className={`card${overdue ? ' card-overdue' : ''}${dragging ? ' dragging' : ''}${dropBefore ? ' drop-before' : ''}`}
      data-card-id={card.id}
      onClick={() => onEdit(card)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', card.id)
        onDragStart(card.id)
        // Wait a tick so the browser snapshots the card before it dims.
        window.setTimeout(() => setDragging(true), 0)
      }}
      onDragEnd={() => {
        setDragging(false)
        setDropBefore(false)
        onDragEnd()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragging) setDropBefore(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropBefore(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDropBefore(false)
        onDropOnCard(card.id)
      }}
    >
      <div className="card-top">
        <span className={`priority priority-${card.priority.toLowerCase()}`}>{card.priority}</span>
        <div className="card-actions">
          <button
            type="button"
            className="danger"
            title="Delete"
            aria-label={`Delete ${card.title}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(card.id)
            }}
          >
            <TrashIcon />
            <span>Delete</span>
          </button>
        </div>
      </div>
      <h3>
        <button
          type="button"
          className="card-title"
          aria-label={`Edit ${card.title}`}
          aria-describedby="card-shortcuts-hint"
          aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(card)
          }}
          onKeyDown={(e) => {
            const direction = e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey ? SHIFT_KEYS[e.key] : undefined
            if (!direction) return
            e.preventDefault()
            onShift(card.id, direction)
          }}
        >
          {card.title}
        </button>
      </h3>
      <div className="card-meta">
        <span>{card.assignee || 'Unassigned'}</span>
        <span className={overdue ? 'overdue' : ''}>{overdue ? `Overdue · ${formatDate(card.dueDate)}` : formatDate(card.dueDate)}</span>
      </div>
      <label className="card-move" onClick={(e) => e.stopPropagation()}>
        Move to
        <select
          value={card.status}
          aria-label={`Move ${card.title} to another column`}
          onChange={(e) => onMove(card.id, e.target.value as Status)}
        >
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name}
            </option>
          ))}
        </select>
      </label>
    </article>
  )
}

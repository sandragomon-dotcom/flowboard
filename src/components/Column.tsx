import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DONE_ID, type CardData, type ColumnData, type ShiftDirection, type Status } from '../types'
import Card from './Card'

interface Props {
  column: ColumnData
  columns: ColumnData[]
  cards: CardData[]
  total: number
  onClear?: () => void
  onAdd: (status: Status) => void
  filtering: boolean
  onRename: (id: Status, name: string) => void
  onDeleteColumn: (id: Status) => void
  onEdit: (card: CardData) => void
  onDelete: (id: string) => void
  onMove: (id: string, status: Status) => void
  onShift: (id: string, direction: ShiftDirection) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDropOnColumn: (status: Status) => void
  onDropOnCard: (targetId: string) => void
}

export default function Column({
  column,
  columns,
  cards,
  total,
  onClear,
  onAdd,
  filtering,
  onRename,
  onDeleteColumn,
  onEdit,
  onDelete,
  onMove,
  onShift,
  onDragStart,
  onDragEnd,
  onDropOnColumn,
  onDropOnCard,
}: Props) {
  const [over, setOver] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)

  const settled = useRef(false)
  const nameButton = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  // Hand focus back to the name button once the inline editor closes.
  useEffect(() => {
    if (wasEditing.current && !editing) nameButton.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const submitName = (e: FormEvent) => {
    e.preventDefault()
    if (settled.current) return
    settled.current = true
    const next = name.trim()
    if (next && next !== column.name) onRename(column.id, next)
    setEditing(false)
  }

  return (
    <section
      aria-labelledby={`column-title-${column.id}`}
      className={`column${over ? ' drag-over' : ''}`}
      data-status={column.id}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onDropOnColumn(column.id)
      }}
    >
      <header className="column-header">
        {editing ? (
          <form className="column-rename" onSubmit={submitName}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitName}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return
                settled.current = true
                setEditing(false)
              }}
              aria-label="Column name"
            />
          </form>
        ) : (
          <h2 id={`column-title-${column.id}`}>
            <button
              type="button"
              ref={nameButton}
              className="column-name"
              aria-describedby="column-rename-hint"
              onClick={() => {
                settled.current = false
                setName(column.name)
                setEditing(true)
              }}
            >
              {column.name}
            </button>{' '}
            <span className="count">
              <span aria-hidden="true">{cards.length === total ? total : `${cards.length} / ${total}`}</span>
              <span className="sr-only">
                {cards.length === total ? `${total} cards` : `${cards.length} of ${total} cards shown`}
              </span>
            </span>
          </h2>
        )}
        <div className="column-tools">
          {onClear && total > 0 && (
            <button type="button" className="column-clear" onClick={onClear}>
              Clear completed
            </button>
          )}
          {column.id !== DONE_ID && (
            <button
              type="button"
              className="column-icon danger"
              title="Delete column"
              aria-label={`Delete ${column.name}`}
              onClick={() => onDeleteColumn(column.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      </header>
      <div className="column-body">
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            columns={columns}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
            onShift={onShift}
            onDragStart={onDragStart}
            onDragEnd={() => {
              setOver(false)
              onDragEnd()
            }}
            onDropOnCard={(id) => {
              setOver(false)
              onDropOnCard(id)
            }}
          />
        ))}
        {cards.length === 0 && <p className="empty">{filtering && total > 0 ? 'No matching cards' : 'No cards'}</p>}
        <button type="button" className="column-add" onClick={() => onAdd(column.id)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add card{' '}
          <span className="sr-only">to {column.name}</span>
        </button>
      </div>
    </section>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PRIORITIES, type CardInput, type Priority } from '../types'

interface Props {
  initial: CardInput | null
  onSave: (input: CardInput) => Promise<void>
  onClose: () => void
}

export default function CardModal({ initial, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [assignee, setAssignee] = useState(initial?.assignee ?? '')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'Medium')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLFormElement>(null)

  // Remember what opened the dialog and give focus back when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!title.trim()) {
      setTitleError('Enter a title')
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ title: title.trim(), assignee: assignee.trim(), priority, dueDate })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the card')
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return
          const items = dialogRef.current?.querySelectorAll<HTMLElement>('input, select, textarea, a[href], button:not([disabled])')
          if (!items?.length) return
          const first = items[0]
          const last = items[items.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }}
      >
        <h2 id="modal-title">{initial ? 'Edit card' : 'New card'}</h2>

        <label>
          Title (required)
          <input
            ref={titleRef}
            aria-required="true"
            value={title}
            maxLength={120}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? 'title-error' : undefined}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleError(null)
            }}
          />
          {titleError && (
            <span id="title-error" className="form-error" role="alert">
              {titleError}
            </span>
          )}
        </label>
        <label>
          Assignee (optional)
          <input value={assignee} maxLength={60} onChange={(e) => setAssignee(e.target.value)} />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due date (optional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {initial ? 'Save changes' : 'Add card'}
          </button>
        </div>
      </form>
    </div>
  )
}

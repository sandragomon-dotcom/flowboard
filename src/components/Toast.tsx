interface Props {
  toast: { message: string; undo: () => void } | null
  onPause: () => void
  onResume: () => void
}

// The live region stays mounted so screen readers announce the message when it appears.
export default function Toast({ toast, onPause, onResume }: Props) {
  return (
    <div role="status" aria-live="polite">
      {toast && (
        <div className="toast" onMouseEnter={onPause} onMouseLeave={onResume} onFocus={onPause} onBlur={onResume}>
          <span>
            {toast.message}
            <span className="sr-only">. Press Control or Command Z to undo.</span>
          </span>
          <button type="button" className="link" onClick={toast.undo}>
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

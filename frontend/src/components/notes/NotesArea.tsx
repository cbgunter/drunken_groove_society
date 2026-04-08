import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useNotesStore } from '../../store/notesStore'

export interface NotesAreaHandle {
  stamp: (track: string) => void
}

interface Props {
  sessionId: string
  entryId: string
  userId: string
  readOnly?: boolean
}

const NotesArea = forwardRef<NotesAreaHandle, Props>(function NotesArea(
  { sessionId, entryId, readOnly = false },
  ref,
) {
  const { getDraft, setDraft } = useNotesStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const content = getDraft(sessionId, entryId)

  useImperativeHandle(ref, () => ({
    stamp(track: string) {
      const el = textareaRef.current
      if (!el) return
      const start = el.selectionStart ?? content.length
      const before = content.slice(0, start)
      const after = content.slice(start)
      const stamp = (before.length && !before.endsWith('\n') ? '\n' : '') + `${track}: `
      const next = before + stamp + after
      setDraft(sessionId, entryId, next)
      // Restore cursor after stamp
      requestAnimationFrame(() => {
        el.focus()
        const pos = before.length + stamp.length
        el.setSelectionRange(pos, pos)
      })
    },
  }))

  return (
    <div>
      <label
        className="block text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-muted)' }}
        htmlFor={`notes-${entryId}`}
      >
        Your listening notes
      </label>
      <textarea
        id={`notes-${entryId}`}
        ref={textareaRef}
        className="w-full rounded-lg px-3 py-2.5 text-sm resize-y min-h-[120px] outline-none transition-colors"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          lineHeight: '1.6',
        }}
        placeholder={readOnly ? 'No notes taken.' : 'Tap a track above to stamp it, then write your thoughts…'}
        value={content}
        readOnly={readOnly}
        onChange={readOnly ? undefined : (e) => setDraft(sessionId, entryId, e.target.value)}
      />
      {!readOnly && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Notes are private until you share them with the crew.
        </p>
      )}
    </div>
  )
})

export default NotesArea

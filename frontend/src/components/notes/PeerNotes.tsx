import type { Session } from '../../types'

interface UserNote {
  userId: string
  userName: string
  entryId: string
  content: string
}

interface Props {
  session: Session
  notes: UserNote[]
  myUserId: string
}

// Assign a stable color to each userId
const COLORS = ['#7c3aed', '#059669', '#d97706', '#dc2626', '#2563eb', '#db2777']
function colorFor(userId: string): string {
  let h = 0
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) & 0xffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

export default function PeerNotes({ session, notes, myUserId }: Props) {
  if (!notes.length) {
    return (
      <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        No notes shared yet. Ask the crew to click "Share my notes" above.
      </p>
    )
  }

  // Group by user
  const byUser = new Map<string, UserNote[]>()
  for (const note of notes) {
    const list = byUser.get(note.userId) ?? []
    list.push(note)
    byUser.set(note.userId, list)
  }

  return (
    <div className="space-y-5">
      {[...byUser.entries()].map(([userId, userNotes]) => {
        const name = userNotes[0].userName || userId.slice(0, 6)
        const color = colorFor(userId)
        const isMe = userId === myUserId

        return (
          <div key={userId}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span className="text-xs font-semibold" style={{ color }}>
                {name}
                {isMe ? ' (you)' : ''}
              </span>
            </div>
            <div className="space-y-3 pl-4">
              {session.entries.map((entry) => {
                const note = userNotes.find((n) => n.entryId === entry.id)
                if (!note?.content.trim()) return null
                return (
                  <div key={entry.id}>
                    <p
                      className="text-xs font-medium mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {entry.badge_emoji} {entry.artist} — {entry.title}
                    </p>
                    <pre
                      className="text-sm whitespace-pre-wrap rounded-lg px-3 py-2.5"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit',
                        lineHeight: '1.6',
                      }}
                    >
                      {note.content}
                    </pre>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

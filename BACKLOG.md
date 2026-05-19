# Backlog

Improvements identified but deferred. Ordered roughly by priority.

---

## High priority

### Save failure states
All three save paths fail silently with no retry UI:
- `sessionStore.saveToRemote()` — sets an error flag but the UI has no retry button
- `listeningStore.saveDraft()` — shows "Saving…" spinner but no failure state or timeout
- `SessionView` → `fetchPeerNotes()` — failure is swallowed; user enters meeting mode with stale/incomplete data

Each needs a visible error state and a retry affordance.

### entries stored as JSON string in DynamoDB
`putSession.ts` does `JSON.stringify(session.entries)` before writing. Entries are an opaque blob — DynamoDB expressions can't touch individual fields. Migrate to a native DynamoDB map/list so individual entries can be updated without rewriting the whole session. Requires a one-time data migration and coordinated frontend/backend change.

---

## Medium priority

### Historic seed data in TypeScript literals
`frontend/src/utils/historicSeed.ts` embeds 3 complete past sessions as hardcoded TypeScript objects. Corrections require a code change and redeploy. As real sessions accumulate in DynamoDB (starting from March 2026 onward), consider migrating the seed data into DynamoDB directly so all sessions live in one place.

### Peer notes cache
`SessionView` calls `fetchPeerNotes()` unconditionally on every mount. Add an `updatedAt` timestamp check in `notesStore` so the fetch is skipped when the cached data is recent (e.g., within the last 5 minutes).

### Session unlock flow
Once a session is locked, there is no way to unlock it from the UI. Add a simple unlock affordance for the session owner to correct mistakes after locking (e.g., wrong rating, missed entry).

---

## Lower priority / cleanup

### Lambda memory tuning for generateSummary
`generateSummary` is currently at 256 MB. Lambda CPU allocation scales with memory. Run [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning) on this function — bumping to 512 or 1024 MB will likely reduce duration enough to offset the memory cost.

### Tool use `as any` cast in lookup.ts
`toolUse.input` is cast as `any` with no shape validation. If the Claude tool response structure changes, fields silently become undefined. Add a narrow type guard or Zod schema to catch this at the boundary.

### putSession validation references non-existent fields
`putSession.ts` line 19 checks `!session.title || !session.date`, but the `Session` type has no `title` or `date` fields. This validation either always passes (if the fields are undefined/falsy) or always rejects — worth auditing to confirm sessions are actually persisting to DynamoDB correctly.

### notesStore.submitNotes deprecation
`notesStore.submitNotes` is documented as deprecated in favor of `listeningStore.saveDraft`. Verify it is no longer called anywhere and remove it.

### session.id / session.month redundancy
Both `Session.id` and `Session.month` are `YYYY-MM` strings and always identical. Remove one (keep `id`, derive month where needed).

### Phase detection scattered across files
`SessionView.tsx` has a `derivePhase()` function, but phase decisions are also made in `calendarStore` seeding and `sessionStore`. Centralize into a single `getPhase(session)` utility in `types/` or `utils/`.

---

## Features

### Album art
The `/lookup` handler returns rich metadata but no cover image. The [Cover Art Archive](https://coverartarchive.org/) (free, no key) could be queried by MusicBrainz ID to fetch artwork, making entries visually scannable on the calendar and in session views.

### Additional streaming links
`lookup.ts` only recognizes Spotify and YouTube URLs. Add Apple Music and Bandcamp as recognized platforms with appropriate labels.

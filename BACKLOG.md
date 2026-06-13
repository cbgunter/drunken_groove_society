# Backlog

Improvements identified but deferred. Ordered roughly by priority.

---

---

## Medium priority

### Historic seed data in TypeScript literals
`frontend/src/utils/historicSeed.ts` embeds past sessions as hardcoded TypeScript objects. Corrections require a code change and redeploy. A one-time migration script could PUT each seed session to DynamoDB (skipping any month that already exists) then remove it from the local seed. Deferred: Apr/May 2026 may already have real DynamoDB records, so a blind PUT risks overwriting them.

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

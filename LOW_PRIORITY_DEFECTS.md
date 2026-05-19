# Low Priority Defects

Logged 2026-05-19. Critical, high, and medium defects were fixed before the first meeting.

---

## DEF-011 — `submitNotes` in notesStore is a no-op stub

**File:** `frontend/src/store/notesStore.ts:54-56`

`submitNotes` is exported in the interface but does nothing — notes are now saved per-entry
via `listeningStore.saveDraft`. The stub creates a misleading API surface.

**Fix:** Remove `submitNotes` from the store interface and its call sites, or replace with
a JSDoc deprecation comment pointing callers to `listeningStore.saveDraft`.

---

## DEF-012 — Roster setup allows duplicate names

**File:** `frontend/src/components/roster/RosterSetup.tsx`

No deduplication check on the three name inputs. A user can enter the same name for multiple
slots (e.g., "Corey", "Corey", "Mike"), which creates ambiguous `selector` matching throughout
the session and listening views.

**Fix:** Validate that all three names are non-empty and distinct before allowing the roster
to be saved.

---

## DEF-013 — DynamoDB key scheme in CLAUDE.md is wrong

**File:** `CLAUDE.md` (Architecture → DynamoDB key scheme table)

CLAUDE.md documents user notes as `PK: NOTES#<sessionId>` / `SK: USER#<userId>`. The actual
implementation uses `PK: SESSION#<sessionId>` / `SK: NOTES#<userId>`. The code is
self-consistent (put and get agree), so there is no functional impact — it's purely a docs
error.

**Fix:** Update the table in CLAUDE.md to match the actual key scheme.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is an npm workspace project with `frontend` and `backend` packages.

```bash
# Local development
npm run dev            # Vite dev server on :5173, proxies /api → localhost:3001

# Build
npm run build          # builds backend (esbuild) then frontend (Vite)
npm run build:backend  # esbuild bundles backend/src/handlers/*.ts → backend/dist/handlers/
npm run build:frontend # tsc + vite build

# Type checking
npm run typecheck      # runs tsc -noEmit in both workspaces
```

There are no tests and no linting configured. Type checking is the primary correctness gate.

The Vite proxy expects a local backend on `:3001`. For local backend dev, run `sam local start-api --port 3001` (requires SAM CLI and Docker). Otherwise the frontend dev server calls the deployed API via `VITE_API_BASE_URL`.

### Deploy (GitHub Actions)

Deploys are automatic on push to `main` via two path-filtered workflows:

- `.github/workflows/deploy-backend.yml` — triggers on changes to `backend/**`, `template.yaml`, or `samconfig.toml`. Runs `npm run build:backend` → `sam build` → `sam deploy`.
- `.github/workflows/deploy-frontend.yml` — triggers on changes to `frontend/**`. Reads CloudFormation outputs for bucket/dist/API endpoint, runs `npm run build:frontend` with `VITE_API_BASE_URL`, syncs to S3, and invalidates CloudFront.

Required GitHub Actions secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ANTHROPIC_API_KEY`.

`samconfig.toml` supplies the stack name, S3 artifact bucket, region, and custom domain parameter overrides.

### Manual deploy (fallback)

```bash
# Backend (requires SAM CLI — use Cloud9)
npm run build:backend && sam build
sam deploy --parameter-overrides AnthropicApiKey=<key>

# Frontend
bash scripts/deploy-frontend.sh
```

## Architecture

**Stack:** React SPA (Vite + TypeScript + Tailwind + Zustand) → S3 + CloudFront → HTTP API Gateway v2 → Lambda (Node 20) → DynamoDB. Deployed via AWS SAM (`template.yaml`), stack name `drunken-groove-society`, region `us-east-1`, custom domain `dgs.caseyhunter.net`.

### Frontend routing

No react-router. `App.tsx` manages a `view` state (`'calendar' | 'month' | 'roster-setup' | 'roster-edit'`) that controls which top-level component renders. The active month is derived from a `?month=YYYY-MM` URL param for deep-linking.

All API calls go through `frontend/src/api/client.ts`, which exports a single `api` object wrapping every endpoint.

### Frontend state model

State lives in four Zustand stores, all persisted to `localStorage`:

| Store | Persistence key | What it holds |
|---|---|---|
| `calendarStore` | `dgs-calendar` | `roster` (3 names), `summaries` (per-month grid data), `localSessions` (seed/draft sessions not yet in DynamoDB), `seedVersion` |
| `sessionStore` | none | Active `Session` object, dirty/saving flags; fetches from API or creates blank |
| `listeningStore` | `dgs-listening` | Per-entry drafts, ratings (1–5), and note history (last 10 saves) keyed by `sessionId:entryId` |
| `notesStore` | `dgs-notes` | Peer notes fetched from API; `notesStore.submitNotes` is deprecated — use `listeningStore.saveDraft` |

Session load order: local cache (`calendarStore.localSessions`) → DynamoDB → blank new session.

### Session data model

A `Session` (`frontend/src/types/index.ts`) is keyed by month (`YYYY-MM`). It has a `phase` (`selection` → `listening` → `done`) and a `locked` boolean. Each `Entry` belongs to one crew member (`selector`) and carries album metadata auto-populated via the `/lookup` Lambda (Claude API call).

Identity is stored in `localStorage` as `dgs_user_name` and `dgs_user_id_<name>` (stable nanoid per name). Theme preference is `dgs_theme`.

### Frontend styling

Tailwind with dark mode via the `dark` class on `<html>`. Custom component utility classes are defined in `frontend/src/index.css`: `.surface`, `.btn-primary`, `.btn-ghost`, `.pill`. Custom `groove` color palette in `tailwind.config.ts`.

### Backend Lambda handlers

All handlers are in `backend/src/handlers/`. Each exports a `handler` function for API Gateway HTTP v2. Helpers in `backend/src/lib/`:
- `dynamo.ts` — DynamoDB Document Client, `TABLE` constant
- `cors.ts` — `ok()` / `err()` response builders with CORS headers

The two Claude API handlers use specific models: `lookup.ts` calls Claude Sonnet 4.6 with `tool_choice` to return structured album metadata; `generateSummary.ts` calls Claude Haiku 4.5 to produce a markdown meeting guide.

**DynamoDB key scheme (single table `drunken-groove-society`):**

| Entity | PK | SK |
|---|---|---|
| Session | `SESSION#<month>` | `METADATA` |
| User notes | `SESSION#<month>` | `NOTES#<userId>` |

Sessions and their notes share the same PK (`SESSION#<month>`), so all data for a month lives in one partition. Sessions have a 90-day TTL. `entries` is stored as a JSON string inside the session item; user notes store an `entries` map keyed by `entryId`.

### API routes

| Method | Path | Lambda |
|---|---|---|
| GET | `/sessions/{id}` | GetSession |
| PUT | `/sessions/{id}` | PutSession |
| GET | `/sessions/{id}/notes` | GetNotes |
| PUT | `/sessions/{id}/notes` | PutNotes |
| POST | `/lookup` | Lookup (Claude API) |
| POST | `/summary` | GenerateSummary (Claude API, 60s timeout) |

Frontend dev proxy: Vite forwards `/api/*` → `http://localhost:3001` (stripping the `/api` prefix).

### Infrastructure

- `template.yaml` — SAM template; `AWS::Serverless::HttpApi` generates `ApiprodStage`
- CloudFront → S3 (private bucket via OAC); custom error pages return `index.html` for SPA routing
- `?month=YYYY-MM` URL param deep-links to a specific month
- Historic session data is seeded client-side via `frontend/src/utils/historicSeed.ts`; `SEED_VERSION` is bumped whenever the seed data changes to re-run the seed effect

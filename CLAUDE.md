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

### Backend Lambda handlers

All handlers are in `backend/src/handlers/`. Each exports a `handler` function for API Gateway HTTP v2. Helpers in `backend/src/lib/`:
- `dynamo.ts` — DynamoDB Document Client, `TABLE` constant
- `cors.ts` — `ok()` / `err()` response builders with CORS headers

**DynamoDB key scheme (single table `drunken-groove-society`):**

| Entity | PK | SK |
|---|---|---|
| Session | `SESSION#<month>` | `METADATA` |
| User notes | `NOTES#<sessionId>` | `USER#<userId>` |

Sessions have a 90-day TTL. `entries` is stored as a JSON string inside the item.

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

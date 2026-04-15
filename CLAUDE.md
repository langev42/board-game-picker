# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GameShelf is a board game collection manager with a random game picker, built as a PWA. Users can add games (via photo identification using Claude AI or manual entry), edit them, filter by criteria, and get random suggestions for game night. Deployed to Render with a Turso (cloud SQLite) database.

## Architecture

Single Express server serving a vanilla HTML/CSS/JS PWA:

- **`index.js`** — Express server (default port 3001, honors `PORT` env var). Serves static files from `public/`, provides the API, handles PIN-based auth via httpOnly cookie, compresses responses (gzip), and rate-limits the Claude API endpoint. Uses the Anthropic SDK (Claude Haiku) to identify board games from photos.
- **`db.js`** — Data layer. Uses `@libsql/client` to talk to Turso. Falls back to a local `data/gameshelf.db` file if `TURSO_URL` is not set (useful for local dev).
- **`public/`** — PWA frontend:
  - `index.html` — shell with navbar/footer
  - `app.js` — all client logic (hash-based routing: `#/` home, `#/collection` collection)
  - `styles.css` — styling
  - `service-worker.js` — network-first for HTML/JS/CSS, cache-first for images/fonts
  - `manifest.json`, `icon-192.png`, `icon-512.png`, `logo.svg`, `icon.svg`

## Environment Variables

- `ANTHROPIC_API_KEY` — **required** for photo identification
- `APP_PIN` — shared PIN for access; if unset, auth is disabled
- `TURSO_URL` — Turso database URL (libsql://...); falls back to local file if unset
- `TURSO_AUTH_TOKEN` — Turso read-write token
- `PORT` — server port (Render sets this automatically)

Loaded via dotenv from `.env` locally.

## Commands

```bash
npm install   # install deps
npm start     # run server on :3001 (or $PORT)
```

No build step, no tests. Deployment to Render is automatic on push to `master`.

## API Endpoints

All `/api` routes except `/api/auth/*` require a valid `token` cookie when `APP_PIN` is set.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/verify` | Submit PIN, receive cookie |
| `GET` | `/api/auth/check` | Check if already authenticated |
| `GET` | `/api/collection` | List all games |
| `POST` | `/api/collection/identify` | Multipart image upload → identified game JSON (rate-limited: 10/min/IP) |
| `POST` | `/api/collection/add` | Add game (JSON body) |
| `PUT` | `/api/collection/:id` | Update game (JSON body) |
| `DELETE` | `/api/collection/:id` | Remove game by UUID |

## Key Details

- Game objects: `id` (UUID), `name`, `description`, `players`, `duration`, `difficulty` (Easy/Medium/Hard), `genre`, `addedAt`
- The identify endpoint uses assistant prefill (`"{"`) to force JSON output from Claude
- Client compresses images to max 1024px before upload (Canvas API)
- The auth token is a deterministic SHA-256 of the PIN — no random secret, so it survives server restarts
- Filtering on the home page happens client-side (already-loaded collection) with multi-select chips; state persists in sessionStorage
- No TypeScript, no build step, no tests — all vanilla JavaScript
- Styling: plain CSS with Google Fonts (Open Sans)
- Service worker bumps its `CACHE_NAME` on meaningful frontend releases to force updates

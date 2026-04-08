# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GameShelf is a board game collection manager with a random game picker, built as a PWA. Users can add games to their collection (via photo identification using Claude AI or manual entry) and get random suggestions for game night.

## Architecture

Single Express server serving a vanilla HTML/CSS/JS PWA:

- **`index.js`** — Express server (port 3001). Serves static files from `public/` and provides the API. Uses a JSON file (`collection.json`) as the data store. Uses the Anthropic SDK (Claude Haiku) to identify board games from photos via `/api/collection/identify`.
- **`public/`** — PWA frontend. `index.html` is the shell, `app.js` has all client logic (hash-based routing: `#/` for home, `#/collection` for collection page), `styles.css` for styling.

The server requires an `ANTHROPIC_API_KEY` environment variable (loaded via dotenv) for the photo identification feature.

## Commands

```bash
npm install   # install deps
npm start     # run server (node index.js) on :3001
```

## API Endpoints

- `GET /api/collection` — list all games
- `POST /api/collection/identify` — multipart image upload, returns identified game JSON
- `POST /api/collection/add` — add game to collection (JSON body)
- `DELETE /api/collection/:id` — remove game by UUID
- `GET /api/random-game` — random game from collection

## Key Details

- Game objects have fields: `id`, `name`, `description`, `players`, `duration`, `difficulty` (Easy/Medium/Hard), `genre`, `addedAt`
- The identify endpoint uses assistant prefill (`"{"`) to force JSON output from Claude
- Client compresses images to max 1024px before upload (Canvas API in app.js)
- No database — collection is persisted to `collection.json`
- No TypeScript, no build step — all vanilla JavaScript
- Styling: plain CSS with Google Fonts (Open Sans)
- PWA: manifest.json + service-worker.js for installability and offline shell caching

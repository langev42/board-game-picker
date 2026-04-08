# GameShelf

A PWA for managing your board game collection and randomly picking what to play. Uses Claude AI to identify games from photos.

## Getting Started

```bash
npm install
npm start
```

The app will be available at `http://localhost:3001`.

Requires an `ANTHROPIC_API_KEY` environment variable for photo identification (set in `.env`).

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/collection` | List all games |
| `POST` | `/api/collection/identify` | Upload photo, get identified game |
| `POST` | `/api/collection/add` | Add game to collection |
| `DELETE` | `/api/collection/:id` | Remove game by ID |
| `GET` | `/api/random-game` | Random game from collection |

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS PWA
- **Backend:** Node.js, Express
- **AI:** Anthropic Claude (game identification from photos)
- **Fonts:** Open Sans (Google Fonts)

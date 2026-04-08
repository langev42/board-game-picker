require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// GET /api/collection
app.get('/api/collection', (req, res) => {
  res.json(db.getCollection());
});

// POST /api/collection/identify — send photo, get game details back
app.post('/api/collection/identify', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided.' });

  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!supportedTypes.includes(req.file.mimetype)) {
    return res.status(415).json({
      error: `Unsupported image format (${req.file.mimetype}). Please use JPEG or PNG. On iPhone, go to Settings → Camera → Formats → Most Compatible.`,
    });
  }

  try {
    const client = new Anthropic();
    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            {
              type: 'text',
              text: `Identify the board game in this photo. Respond with ONLY a raw JSON object (no markdown, no code blocks, no backticks) using these exact fields:
{"name":"game name","description":"1-2 sentence description","players":"e.g. 2-4","duration":"e.g. 60-90 min","difficulty":"Easy or Medium or Hard","genre":"e.g. Strategy"}
If no board game is clearly visible, respond with: {"error":"brief explanation"}`,
            },
          ],
        },
        {
          role: 'assistant',
          content: '{',
        },
      ],
    });

    // Reconstruct full JSON (we pre-filled the opening brace via assistant turn)
    const rawText = '{' + response.content[0].text.trim();
    // Strip any accidental markdown fences just in case
    const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const game = JSON.parse(cleaned);

    if (game.error) return res.status(422).json({ error: game.error });

    res.json(game);
  } catch (err) {
    console.error('Identify error:', err.message);
    res.status(500).json({ error: 'Failed to identify the game. Please try again.' });
  }
});

// POST /api/collection/add
app.post('/api/collection/add', (req, res) => {
  const { name, description, players, duration, difficulty, genre } = req.body;
  if (!name) return res.status(400).json({ error: 'Game name is required.' });

  const game = db.addGame({ name, description, players, duration, difficulty, genre });
  res.status(201).json(game);
});

// DELETE /api/collection/:id
app.delete('/api/collection/:id', (req, res) => {
  const deleted = db.removeGame(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Game not found.' });
  res.json({ success: true });
});

// GET /api/random-game — picks from collection
app.get('/api/random-game', (req, res) => {
  const game = db.getRandomGame();
  if (!game) {
    return res.status(404).json({ error: 'Your collection is empty. Add a game using the camera below.' });
  }
  res.json(game);
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GameShelf API running on http://localhost:${PORT}`);
});

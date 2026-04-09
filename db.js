const { createClient } = require('@libsql/client');
const { v4: uuidv4 } = require('uuid');

const db = createClient({
  url: process.env.TURSO_URL || 'file:data/gameshelf.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      players TEXT,
      duration TEXT,
      difficulty TEXT,
      genre TEXT,
      addedAt TEXT NOT NULL
    )
  `);
}

async function getCollection() {
  const result = await db.execute('SELECT * FROM games ORDER BY addedAt DESC');
  return result.rows;
}

async function addGame({ name, description, players, duration, difficulty, genre }) {
  const game = {
    id: uuidv4(),
    name,
    description: description || null,
    players: players || null,
    duration: duration || null,
    difficulty: difficulty || null,
    genre: genre || null,
    addedAt: new Date().toISOString(),
  };
  await db.execute({
    sql: 'INSERT INTO games (id, name, description, players, duration, difficulty, genre, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [game.id, game.name, game.description, game.players, game.duration, game.difficulty, game.genre, game.addedAt],
  });
  return game;
}

async function removeGame(id) {
  const result = await db.execute({ sql: 'DELETE FROM games WHERE id = ?', args: [id] });
  return result.rowsAffected > 0;
}

async function getRandomGame() {
  const result = await db.execute('SELECT * FROM games ORDER BY RANDOM() LIMIT 1');
  return result.rows[0] || null;
}

module.exports = { init, getCollection, addGame, removeGame, getRandomGame };

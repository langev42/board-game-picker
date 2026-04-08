const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(path.join(DATA_DIR, 'gameshelf.db'));
db.pragma('journal_mode = WAL');

db.exec(`
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

const stmts = {
  getAll: db.prepare('SELECT * FROM games ORDER BY addedAt DESC'),
  insert: db.prepare(`
    INSERT INTO games (id, name, description, players, duration, difficulty, genre, addedAt)
    VALUES (@id, @name, @description, @players, @duration, @difficulty, @genre, @addedAt)
  `),
  remove: db.prepare('DELETE FROM games WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) as count FROM games'),
  random: db.prepare('SELECT * FROM games ORDER BY RANDOM() LIMIT 1'),
};

function getCollection() {
  return stmts.getAll.all();
}

function addGame({ name, description, players, duration, difficulty, genre }) {
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
  stmts.insert.run(game);
  return game;
}

function removeGame(id) {
  const result = stmts.remove.run(id);
  return result.changes > 0;
}

function getRandomGame() {
  return stmts.random.get() || null;
}

function getCount() {
  return stmts.count.get().count;
}

module.exports = { getCollection, addGame, removeGame, getRandomGame, getCount };

import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3001;
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const database = new Database(path.join(dataDir, 'blog.sqlite'));
const adminToken = process.env.ADMIN_TOKEN || 'change-me-in-production';

database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id),
    article_slug TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, article_slug)
  );
  CREATE TABLE IF NOT EXISTS article_stats (
    article_slug TEXT PRIMARY KEY,
    likes_count INTEGER NOT NULL DEFAULT 0
  );
`);

const seed = database.transaction(() => {
  const article = database.prepare('SELECT article_slug FROM article_stats WHERE article_slug = ?').get('faith-and-technology');
  if (!article) {
    database.prepare('INSERT INTO article_stats (article_slug, likes_count) VALUES (?, ?)').run('faith-and-technology', 128);
  }
  const comment = database.prepare('SELECT id FROM comments LIMIT 1').get();
  if (!comment) {
    const now = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const user = database.prepare('INSERT INTO users (name, session_token, created_at) VALUES (?, ?, ?)').run('Amelia', crypto.randomUUID(), now);
    database.prepare('INSERT INTO comments (user_id, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      user.lastInsertRowid,
      'Thought-provoking and balanced. The distinction between tools and deities is especially important.',
      'approved',
      now,
      now,
    );
  }
});
seed();

const getOrCreateReader = (req, res) => {
  let token = req.cookies?.reader_session;
  let reader = token ? database.prepare('SELECT id, name FROM users WHERE session_token = ?').get(token) : null;
  if (!reader) {
    token = crypto.randomUUID();
    const now = new Date().toISOString();
    const result = database.prepare('INSERT INTO users (name, session_token, created_at) VALUES (?, ?, ?)').run('Reader', token, now);
    reader = { id: Number(result.lastInsertRowid), name: 'Reader' };
    res.setHeader('Set-Cookie', `reader_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Max-Age=31536000; Path=/`);
  }
  return reader;
};

const formatComment = (comment) => ({
  id: comment.id,
  name: comment.name,
  message: comment.message,
  status: comment.status,
  createdAt: comment.created_at,
  time: comment.created_at,
});

const requireAdmin = (req, res, next) => {
  const token = req.get('x-admin-token') || req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token !== adminToken) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  return next();
};

app.use(express.json());
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries((req.get('cookie') || '').split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }));
  next();
});

app.get('/api/likes', (_req, res) => {
  const reader = getOrCreateReader(_req, res);
  const stats = database.prepare('SELECT likes_count AS likes FROM article_stats WHERE article_slug = ?').get('faith-and-technology');
  const liked = database.prepare('SELECT 1 FROM likes WHERE user_id = ? AND article_slug = ?').get(reader.id, 'faith-and-technology');
  res.json({ liked: Boolean(liked), likes: stats.likes });
});

app.post('/api/likes/toggle', (_req, res) => {
  const reader = getOrCreateReader(_req, res);
  const toggle = database.transaction(() => {
    const existing = database.prepare('SELECT 1 FROM likes WHERE user_id = ? AND article_slug = ?').get(reader.id, 'faith-and-technology');
    if (existing) {
      database.prepare('DELETE FROM likes WHERE user_id = ? AND article_slug = ?').run(reader.id, 'faith-and-technology');
      database.prepare('UPDATE article_stats SET likes_count = MAX(0, likes_count - 1) WHERE article_slug = ?').run('faith-and-technology');
      return false;
    }
    database.prepare('INSERT INTO likes (user_id, article_slug, created_at) VALUES (?, ?, ?)').run(reader.id, 'faith-and-technology', new Date().toISOString());
    database.prepare('UPDATE article_stats SET likes_count = likes_count + 1 WHERE article_slug = ?').run('faith-and-technology');
    return true;
  });
  const liked = toggle();
  const stats = database.prepare('SELECT likes_count AS likes FROM article_stats WHERE article_slug = ?').get('faith-and-technology');
  res.json({ liked, likes: stats.likes });
});

app.get('/api/comments', (_req, res) => {
  const comments = database.prepare(`
    SELECT comments.id, users.name, comments.message, comments.status, comments.created_at
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.status = 'approved'
    ORDER BY comments.created_at DESC
  `).all();
  res.json(comments.map(formatComment));
});

app.post('/api/comments', (req, res) => {
  const reader = getOrCreateReader(req, res);
  const { name, message } = req.body || {};
  const safeName = String(name || reader.name || 'Reader').trim();
  const safeMessage = String(message || '').trim();

  if (!safeMessage) {
    return res.status(400).json({ error: 'Comment message is required.' });
  }

  const now = new Date().toISOString();
  database.prepare('UPDATE users SET name = ? WHERE id = ?').run(safeName.slice(0, 40) || 'Reader', reader.id);
  const result = database.prepare('INSERT INTO comments (user_id, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    reader.id,
    safeMessage.slice(0, 300),
    'pending',
    now,
    now,
  );
  res.status(201).json({ id: Number(result.lastInsertRowid), status: 'pending', message: safeMessage.slice(0, 300), createdAt: now });
});

app.get('/api/admin/comments', requireAdmin, (_req, res) => {
  const comments = database.prepare(`
    SELECT comments.id, users.name, comments.message, comments.status, comments.created_at
    FROM comments JOIN users ON users.id = comments.user_id
    ORDER BY CASE comments.status WHEN 'pending' THEN 0 ELSE 1 END, comments.created_at DESC
  `).all();
  res.json(comments.map(formatComment));
});

app.patch('/api/admin/comments/:id', requireAdmin, (req, res) => {
  const status = String(req.body?.status || '');
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be pending, approved, or rejected.' });
  }
  const result = database.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Comment not found.' });
  }
  return res.json({ id: Number(req.params.id), status });
});

app.delete('/api/admin/comments/:id', requireAdmin, (req, res) => {
  const result = database.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Comment not found.' });
  }
  return res.status(204).end();
});

app.listen(port, () => {
  console.log(`Blog backend running at http://localhost:${port}`);
});

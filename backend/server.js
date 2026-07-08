const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');
const { startScheduler, checkAllUrls } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());

const insertUrl = db.prepare('INSERT INTO urls (name, url) VALUES (@name, @url)');
const deleteUrl = db.prepare('DELETE FROM urls WHERE id = ?');
const getLatestCheck = db.prepare(`
  SELECT status_code, response_time_ms, is_up, checked_at
  FROM checks
  WHERE url_id = ?
  ORDER BY checked_at DESC, id DESC
  LIMIT 1
`);
const getHistory = db.prepare(`
  SELECT status_code, response_time_ms, is_up, checked_at
  FROM checks
  WHERE url_id = ?
  ORDER BY checked_at DESC, id DESC
  LIMIT 50
`);

app.get('/api/urls', (req, res) => {
  const urls = db.prepare('SELECT * FROM urls ORDER BY created_at ASC').all();
  const withStatus = urls.map((u) => {
    const latest = getLatestCheck.get(u.id);
    return {
      id: u.id,
      name: u.name,
      url: u.url,
      created_at: u.created_at,
      status: latest ? (latest.is_up ? 'up' : 'down') : 'pending',
      status_code: latest ? latest.status_code : null,
      response_time_ms: latest ? latest.response_time_ms : null,
      last_checked_at: latest ? latest.checked_at : null,
    };
  });
  res.json(withStatus);
});

app.get('/api/urls/:id/history', (req, res) => {
  const history = getHistory.all(req.params.id);
  res.json(history);
});

app.post('/api/urls', (req, res) => {
  const { name, url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }
  let parsed;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
  } catch {
    return res.status(400).json({ error: 'url must be a valid http(s) URL' });
  }

  try {
    const info = insertUrl.run({ name: name || parsed.hostname, url });
    checkAllUrls(io).catch((e) => console.error('Immediate check failed:', e));
    res.status(201).json({ id: info.lastInsertRowid, name: name || parsed.hostname, url });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'This URL is already being monitored' });
    }
    res.status(500).json({ error: 'Failed to add URL' });
  }
});

app.delete('/api/urls/:id', (req, res) => {
  deleteUrl.run(req.params.id);
  res.status(204).send();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

server.listen(PORT, () => {
  console.log(`Uptime monitor backend listening on port ${PORT}`);
  startScheduler(io);
});

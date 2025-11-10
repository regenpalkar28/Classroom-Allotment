const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const DB_FILE = path.join(__dirname, 'db.sqlite');

app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// SQLite DB
const db = new sqlite3.Database(DB_FILE, err => {
  if (err) return console.error('DB open error', err);
  console.log('Connected to SQLite DB:', DB_FILE);
});

// Initialize table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS availabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher TEXT NOT NULL,
      class_code TEXT NOT NULL,
      slots TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// --- API ROUTES ---

// GET
app.get('/api/availabilities', (req, res) => {
  db.all('SELECT * FROM availabilities ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const parsed = rows.map(r => ({ ...r, slots: JSON.parse(r.slots) }));
    res.json(parsed);
  });
});

// POST
app.post('/api/availabilities', (req, res) => {
  const { teacher, class_code, slots } = req.body;
  if (!teacher || !class_code || !Array.isArray(slots)) return res.status(400).json({ error: 'Invalid payload' });

  // Check conflicts
  db.all('SELECT slots FROM availabilities WHERE class_code = ?', [class_code], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    for (const row of rows) {
      const taken = JSON.parse(row.slots);
      if (slots.some(s => taken.includes(s))) return res.status(400).json({ error: 'Selected slot(s) already booked' });
    }
    const stmt = db.prepare('INSERT INTO availabilities (teacher, class_code, slots) VALUES (?, ?, ?)');
    stmt.run(teacher, class_code, JSON.stringify(slots), function(err) {
      if (err) return res.status(500).json({ error: 'DB insert error' });
      res.status(201).json({ id: this.lastID, teacher, class_code, slots });
    });
  });
});

// PUT
app.put('/api/availabilities/:id', (req, res) => {
  const id = Number(req.params.id);
  const { teacher, class_code, slots } = req.body;
  if (!id || !teacher || !class_code || !Array.isArray(slots)) return res.status(400).json({ error: 'Invalid payload' });

  db.all('SELECT id, slots FROM availabilities WHERE class_code = ? AND id != ?', [class_code, id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    for (const row of rows) {
      const taken = JSON.parse(row.slots);
      if (slots.some(s => taken.includes(s))) return res.status(400).json({ error: 'Selected slot(s) already booked' });
    }
    db.run('UPDATE availabilities SET teacher = ?, class_code = ?, slots = ? WHERE id = ?', [teacher, class_code, JSON.stringify(slots), id], function(err) {
      if (err) return res.status(500).json({ error: 'DB update error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ id, teacher, class_code, slots });
    });
  });
});

// DELETE
app.delete('/api/availabilities/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  db.run('DELETE FROM availabilities WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'DB delete error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });
});

// FALLBACK
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));

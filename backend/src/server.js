const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50kb' }));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me';
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: 'Server error' }); });
const admin = (req, res, next) => (req.get('x-admin-key') === ADMIN_KEY ? next() : res.status(401).json({ error: 'Invalid admin key' }));

app.get('/api/health', wrap(async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }));

app.get('/api/events', wrap(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT e.*, COUNT(r.id)::int AS registered
    FROM events e LEFT JOIN registrations r ON r.event_id = e.id
    GROUP BY e.id ORDER BY e.starts_at`);
  res.json(rows);
}));

app.post('/api/events', admin, wrap(async (req, res) => {
  const { title, description = '', venue, starts_at, capacity = 100 } = req.body;
  if (!title || !venue || !starts_at) return res.status(400).json({ error: 'title, venue and starts_at are required' });
  const { rows } = await pool.query(
    'INSERT INTO events (title, description, venue, starts_at, capacity) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [title, description, venue, starts_at, capacity]);
  res.status(201).json(rows[0]);
}));

app.delete('/api/events/:id', admin, wrap(async (req, res) => {
  await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

app.post('/api/events/:id/register', wrap(async (req, res) => {
  const { name, email, reg_no = null } = req.body;
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'A name and valid email are required' });
  const ev = await pool.query(
    'SELECT capacity, (SELECT COUNT(*) FROM registrations WHERE event_id = $1) AS n FROM events WHERE id = $1', [req.params.id]);
  if (!ev.rows.length) return res.status(404).json({ error: 'Event not found' });
  if (Number(ev.rows[0].n) >= ev.rows[0].capacity) return res.status(409).json({ error: 'This event is full' });
  try {
    await pool.query('INSERT INTO registrations (event_id, name, email, reg_no) VALUES ($1,$2,$3,$4)', [req.params.id, name, email, reg_no]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'This email is already registered' });
    throw e;
  }
  res.status(201).json({ ok: true });
}));

app.get('/api/events/:id/registrations', admin, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT name, email, reg_no, created_at FROM registrations WHERE event_id = $1 ORDER BY created_at', [req.params.id]);
  res.json(rows);
}));

async function init() {
  for (let i = 1; i <= 30; i++) {
    try {
      await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM events');
      if (!rows[0].n) {
        await pool.query(`INSERT INTO events (title, description, venue, starts_at, capacity) VALUES
          ('VisioSpark Hackathon 24h','Build, break and ship a project in a single day with your team.','CS Lab 3, COMSATS Wah', now() + interval '14 days', 120),
          ('AI & Cloud Workshop','Hands-on session on containers, Kubernetes and ML deployment.','Seminar Hall, COMSATS Wah', now() + interval '28 days', 80)`);
      }
      return;
    } catch (e) { console.log(`DB not ready (${i}/30): ${e.message}`); await new Promise((r) => setTimeout(r, 2000)); }
  }
  process.exit(1);
}

const port = process.env.PORT || 3000;
init().then(() => app.listen(port, () => console.log(`VisioSpark API on :${port}`)));

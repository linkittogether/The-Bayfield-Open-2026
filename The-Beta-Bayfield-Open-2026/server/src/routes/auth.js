const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/auth/player-login
router.post('/player-login', async (req, res) => {
  try {
    const { player_id, pin } = req.body;
    if (!player_id || !pin) {
      return res.status(400).json({ error: 'player_id and pin required' });
    }

    const result = await pool.query(
      'SELECT id, name, photo_url, handicap, pin FROM players WHERE id = $1',
      [player_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = result.rows[0];

    if (!player.pin) {
      return res.status(401).json({ error: 'This player has no PIN set. Please ask an admin.' });
    }

    if (player.pin !== String(pin).trim()) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }

    res.json({
      type: 'player',
      id: player.id,
      name: player.name,
      photo_url: player.photo_url,
      handicap: player.handicap,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admin-login
router.post('/admin-login', async (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code) {
      return res.status(400).json({ error: 'username and code required' });
    }

    const result = await pool.query(
      'SELECT id, username FROM admins WHERE username = $1 AND code = $2',
      [username.trim(), code.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid admin username or code' });
    }

    res.json({
      type: 'admin',
      id: result.rows[0].id,
      name: result.rows[0].username,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/players-list (for login dropdown — no PINs)
router.get('/players-list', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, photo_url, handicap, (pin IS NOT NULL AND pin != \'\') AS has_pin FROM players ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/admins
router.get('/admins', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, created_at FROM admins ORDER BY username');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admins — add new admin
router.post('/admins', async (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code) return res.status(400).json({ error: 'username and code required' });

    const result = await pool.query(
      'INSERT INTO admins (username, code) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET code = $2 RETURNING id, username, created_at',
      [username.trim(), code.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/admins/:id
router.delete('/admins/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM admins WHERE id = $1 AND username != \'admin\'', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

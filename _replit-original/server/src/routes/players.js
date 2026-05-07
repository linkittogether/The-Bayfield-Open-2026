const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
                allowed.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});

// GET all players (no PIN exposed)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, photo_url, handicap, created_at, (pin IS NOT NULL AND pin != \'\') AS has_pin FROM players ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single player (no PIN)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, photo_url, handicap, created_at, (pin IS NOT NULL AND pin != \'\') AS has_pin FROM players WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST register player (with optional PIN)
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { name, handicap, pin } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const hcp = parseInt(handicap) || 0;
    const playerPin = pin ? String(pin).trim() : null;

    const result = await pool.query(
      'INSERT INTO players (name, photo_url, handicap, pin) VALUES ($1, $2, $3, $4) RETURNING id, name, photo_url, handicap, created_at',
      [name, photoUrl, hcp, playerPin]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update player (admin only — client enforces this)
router.patch('/:id', async (req, res) => {
  try {
    const { handicap, pin, name } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (handicap !== undefined) { updates.push(`handicap = $${idx++}`); values.push(parseInt(handicap)); }
    if (pin !== undefined) { updates.push(`pin = $${idx++}`); values.push(pin ? String(pin).trim() : null); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE players SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, photo_url, handicap, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE player
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

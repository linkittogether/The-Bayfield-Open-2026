const express = require('express');
const router = express.Router();
const pool = require('../db');

// The pre-defined Day 3 team members — kept in sync with players table
// Truffle Hogs captain: Adison E  |  Mycelium Syndicate captain: Josh Wright
async function repopulateDay3Teams(client) {
  const truffle = await client.query(
    `SELECT id FROM players WHERE name IN ('Adison E','Duncan M','Rob V','Daniel C','Spencer C','Mike P','Chris G','Owen T','Mike H','Joe M') ORDER BY name`
  );
  const syndicate = await client.query(
    `SELECT id FROM players WHERE name IN ('Josh Wright','Ryan P','Jordan C','Dave G','Scott M','Travis W','Grant M','James','Jordan H','Korey B') ORDER BY name`
  );
  const adisonRow = await client.query(`SELECT id FROM players WHERE name = 'Adison E'`);
  const joshRow = await client.query(`SELECT id FROM players WHERE name = 'Josh W'`);
  const adisonId = adisonRow.rows[0]?.id;
  const joshId = joshRow.rows[0]?.id;

  for (const r of truffle.rows) {
    await client.query(
      `INSERT INTO day3_players (player_id, team_name, is_captain) VALUES ($1, 'truffle_hogs', $2) ON CONFLICT DO NOTHING`,
      [r.id, r.id === adisonId]
    );
  }
  for (const r of syndicate.rows) {
    await client.query(
      `INSERT INTO day3_players (player_id, team_name, is_captain) VALUES ($1, 'mycelium_syndicate', $2) ON CONFLICT DO NOTHING`,
      [r.id, r.id === joshId]
    );
  }
}

// GET tournament state
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournament_state WHERE id = 1');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH tournament state
router.patch('/', async (req, res) => {
  try {
    const {
      current_day,
      day1_complete,
      day1_picking_started,
      day1_picking_complete,
      day2_complete,
      day2_draft_complete,
      day3_complete,
      next_picker_rank
    } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (current_day !== undefined) { updates.push(`current_day = $${idx++}`); values.push(current_day); }
    if (day1_complete !== undefined) { updates.push(`day1_complete = $${idx++}`); values.push(day1_complete); }
    if (day1_picking_started !== undefined) { updates.push(`day1_picking_started = $${idx++}`); values.push(day1_picking_started); }
    if (day1_picking_complete !== undefined) { updates.push(`day1_picking_complete = $${idx++}`); values.push(day1_picking_complete); }
    if (day2_complete !== undefined) { updates.push(`day2_complete = $${idx++}`); values.push(day2_complete); }
    if (day2_draft_complete !== undefined) { updates.push(`day2_draft_complete = $${idx++}`); values.push(day2_draft_complete); }
    if (day3_complete !== undefined) { updates.push(`day3_complete = $${idx++}`); values.push(day3_complete); }
    if (next_picker_rank !== undefined) { updates.push(`next_picker_rank = $${idx++}`); values.push(next_picker_rank); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(1);
    const result = await pool.query(
      `UPDATE tournament_state SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST reset tournament — preserves players and day3 team assignments
router.post('/reset', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM day3_holes');
    await client.query('DELETE FROM day3_matches');
    await client.query('DELETE FROM day3_players');
    await client.query('DELETE FROM day2_round_scores');
    await client.query('DELETE FROM day2_teams');
    await client.query('DELETE FROM day1_scores');
    await client.query(`
      UPDATE tournament_state SET
        current_day = 1,
        day1_complete = FALSE,
        day1_picking_started = FALSE,
        day1_picking_complete = FALSE,
        day2_complete = FALSE,
        day2_draft_complete = FALSE,
        day3_complete = FALSE,
        next_picker_rank = 10
      WHERE id = 1
    `);
    // Re-populate fixed Day 3 teams
    await repopulateDay3Teams(client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Tournament reset successfully (players and teams preserved)' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

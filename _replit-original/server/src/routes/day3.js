const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET day3 teams and players
router.get('/teams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        dp.team_name, dp.is_captain,
        p.id AS player_id, p.name, p.photo_url, p.handicap
      FROM day3_players dp
      JOIN players p ON p.id = dp.player_id
      ORDER BY dp.team_name, dp.is_captain DESC, p.name
    `);

    const truffle = result.rows.filter(r => r.team_name === 'truffle_hogs');
    const syndicate = result.rows.filter(r => r.team_name === 'mycelium_syndicate');

    res.json({ truffle_hogs: truffle, mycelium_syndicate: syndicate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all matches
router.get('/matches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id, m.match_number,
        p1.id AS truffle_player_id, p1.name AS truffle_player_name, p1.photo_url AS truffle_photo,
        p2.id AS syndicate_player_id, p2.name AS syndicate_player_name, p2.photo_url AS syndicate_photo,
        (SELECT COUNT(*) FROM day3_holes h WHERE h.match_id = m.id) AS holes_played,
        (SELECT COUNT(*) FROM day3_holes h WHERE h.match_id = m.id AND h.winner = 'truffle_hogs') AS truffle_holes_won,
        (SELECT COUNT(*) FROM day3_holes h WHERE h.match_id = m.id AND h.winner = 'mycelium_syndicate') AS syndicate_holes_won,
        (SELECT COUNT(*) FROM day3_holes h WHERE h.match_id = m.id AND h.winner = 'tie') AS tied_holes
      FROM day3_matches m
      JOIN players p1 ON p1.id = m.truffle_player_id
      JOIN players p2 ON p2.id = m.syndicate_player_id
      ORDER BY m.match_number
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single match with hole details
router.get('/matches/:id', async (req, res) => {
  try {
    const matchRes = await pool.query(`
      SELECT
        m.id, m.match_number,
        p1.id AS truffle_player_id, p1.name AS truffle_player_name, p1.photo_url AS truffle_photo,
        p2.id AS syndicate_player_id, p2.name AS syndicate_player_name, p2.photo_url AS syndicate_photo
      FROM day3_matches m
      JOIN players p1 ON p1.id = m.truffle_player_id
      JOIN players p2 ON p2.id = m.syndicate_player_id
      WHERE m.id = $1
    `, [req.params.id]);

    if (matchRes.rows.length === 0) return res.status(404).json({ error: 'Match not found' });

    const holesRes = await pool.query(
      'SELECT * FROM day3_holes WHERE match_id = $1 ORDER BY hole_number',
      [req.params.id]
    );

    res.json({ ...matchRes.rows[0], holes: holesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create matches (captain sets up who plays who)
router.post('/matches', async (req, res) => {
  try {
    const { matches } = req.body;
    if (!matches || !Array.isArray(matches)) {
      return res.status(400).json({ error: 'matches array required' });
    }

    // Clear existing matches and holes
    await pool.query('DELETE FROM day3_holes');
    await pool.query('DELETE FROM day3_matches');

    const created = [];
    for (const m of matches) {
      const result = await pool.query(`
        INSERT INTO day3_matches (match_number, truffle_player_id, syndicate_player_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [m.match_number, m.truffle_player_id, m.syndicate_player_id]);
      created.push(result.rows[0]);
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: verify auth for a match — caller must be one of the two players or an admin
async function authorizeMatchAccess(matchId, { is_admin, auth_player_id, auth_pin }) {
  if (is_admin) return true;
  if (!auth_player_id || !auth_pin) return false;

  // Verify PIN
  const playerRes = await pool.query('SELECT pin FROM players WHERE id = $1', [auth_player_id]);
  if (playerRes.rows.length === 0 || playerRes.rows[0].pin !== String(auth_pin).trim()) return false;

  // Verify the player is one of the two in this match
  const matchRes = await pool.query(
    'SELECT truffle_player_id, syndicate_player_id FROM day3_matches WHERE id = $1',
    [matchId]
  );
  if (matchRes.rows.length === 0) return false;
  const { truffle_player_id, syndicate_player_id } = matchRes.rows[0];
  return parseInt(auth_player_id) === truffle_player_id || parseInt(auth_player_id) === syndicate_player_id;
}

// POST submit hole result
router.post('/holes', async (req, res) => {
  try {
    const { match_id, hole_number, winner, is_admin, auth_player_id, auth_pin } = req.body;
    if (!match_id || !hole_number || !winner) {
      return res.status(400).json({ error: 'match_id, hole_number, winner required' });
    }
    if (!['truffle_hogs', 'mycelium_syndicate', 'tie'].includes(winner)) {
      return res.status(400).json({ error: 'winner must be truffle_hogs, mycelium_syndicate, or tie' });
    }

    const authorized = await authorizeMatchAccess(match_id, { is_admin, auth_player_id, auth_pin });
    if (!authorized) {
      return res.status(403).json({ error: 'Only a player in this match (or an admin) can record hole results.' });
    }

    const result = await pool.query(`
      INSERT INTO day3_holes (match_id, hole_number, winner)
      VALUES ($1, $2, $3)
      ON CONFLICT (match_id, hole_number) DO UPDATE SET winner = $3
      RETURNING *
    `, [match_id, hole_number, winner]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE hole result (undo)
router.delete('/holes/:matchId/:holeNumber', async (req, res) => {
  try {
    const { is_admin, auth_player_id, auth_pin } = req.body;
    const authorized = await authorizeMatchAccess(req.params.matchId, { is_admin, auth_player_id, auth_pin });
    if (!authorized) {
      return res.status(403).json({ error: 'Only a player in this match (or an admin) can undo hole results.' });
    }

    await pool.query(
      'DELETE FROM day3_holes WHERE match_id = $1 AND hole_number = $2',
      [req.params.matchId, req.params.holeNumber]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET live leaderboard - team totals from match wins
router.get('/leaderboard', async (req, res) => {
  try {
    // Count total holes won across all matches per team
    const holesRes = await pool.query(`
      SELECT
        winner,
        COUNT(*) AS count
      FROM day3_holes
      WHERE winner != 'tie'
      GROUP BY winner
    `);

    // Count matches with the most holes won
    const matchWinsRes = await pool.query(`
      WITH match_results AS (
        SELECT
          match_id,
          SUM(CASE WHEN winner = 'truffle_hogs' THEN 1 ELSE 0 END) AS truffle_holes,
          SUM(CASE WHEN winner = 'mycelium_syndicate' THEN 1 ELSE 0 END) AS syndicate_holes,
          COUNT(*) AS holes_played
        FROM day3_holes
        GROUP BY match_id
      )
      SELECT
        SUM(CASE WHEN truffle_holes > syndicate_holes THEN 1 ELSE 0 END) AS truffle_match_wins,
        SUM(CASE WHEN syndicate_holes > truffle_holes THEN 1 ELSE 0 END) AS syndicate_match_wins,
        SUM(CASE WHEN truffle_holes = syndicate_holes AND holes_played = 18 THEN 1 ELSE 0 END) AS tied_matches,
        SUM(truffle_holes) AS truffle_total_holes,
        SUM(syndicate_holes) AS syndicate_total_holes
      FROM match_results
    `);

    const matchRes = await pool.query(`
      SELECT
        m.id, m.match_number,
        p1.name AS truffle_name, p2.name AS syndicate_name,
        SUM(CASE WHEN h.winner = 'truffle_hogs' THEN 1 ELSE 0 END) AS truffle_holes,
        SUM(CASE WHEN h.winner = 'mycelium_syndicate' THEN 1 ELSE 0 END) AS syndicate_holes,
        SUM(CASE WHEN h.winner = 'tie' THEN 1 ELSE 0 END) AS ties,
        COUNT(h.id) AS holes_played
      FROM day3_matches m
      JOIN players p1 ON p1.id = m.truffle_player_id
      JOIN players p2 ON p2.id = m.syndicate_player_id
      LEFT JOIN day3_holes h ON h.match_id = m.id
      GROUP BY m.id, m.match_number, p1.name, p2.name
      ORDER BY m.match_number
    `);

    const summary = matchWinsRes.rows[0] || {
      truffle_match_wins: 0,
      syndicate_match_wins: 0,
      tied_matches: 0,
      truffle_total_holes: 0,
      syndicate_total_holes: 0
    };

    res.json({
      summary,
      matches: matchRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST complete day 3
router.post('/complete', async (req, res) => {
  try {
    await pool.query('UPDATE tournament_state SET day3_complete = TRUE, current_day = 3 WHERE id = 1');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

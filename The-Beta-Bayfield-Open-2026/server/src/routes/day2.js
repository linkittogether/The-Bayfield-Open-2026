const express = require('express');
const router = express.Router();
const pool = require('../db');

function calcNet9(gross, handicap) {
  return gross - Math.floor(handicap / 2);
}

// GET all Day 2 teams
router.get('/teams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.pick_order,
        p1.id AS player1_id, p1.name AS player1_name, p1.handicap AS player1_handicap, p1.photo_url AS player1_photo,
        p2.id AS player2_id, p2.name AS player2_name, p2.handicap AS player2_handicap, p2.photo_url AS player2_photo
      FROM day2_teams t
      JOIN players p1 ON p1.id = t.player1_id
      JOIN players p2 ON p2.id = t.player2_id
      ORDER BY t.pick_order ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Day 2 live leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id AS team_id, t.name AS team_name,
        p1.id AS player1_id, p1.name AS player1_name, p1.handicap AS player1_handicap, p1.photo_url AS player1_photo,
        p2.id AS player2_id, p2.name AS player2_name, p2.handicap AS player2_handicap, p2.photo_url AS player2_photo,
        COALESCE(SUM(r.net_score), 0) AS total_net_score,
        COUNT(r.id) AS rounds_complete,
        json_agg(
          json_build_object(
            'round', r.round_number,
            'player1_gross', r.player1_gross,
            'player2_gross', r.player2_gross,
            'net_score', r.net_score
          ) ORDER BY r.round_number
        ) FILTER (WHERE r.id IS NOT NULL) AS round_scores
      FROM day2_teams t
      JOIN players p1 ON p1.id = t.player1_id
      JOIN players p2 ON p2.id = t.player2_id
      LEFT JOIN day2_round_scores r ON r.team_id = t.id
      GROUP BY t.id, t.name, p1.id, p1.name, p1.handicap, p1.photo_url, p2.id, p2.name, p2.handicap, p2.photo_url
      ORDER BY total_net_score ASC, rounds_complete DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET round scores for a team
router.get('/scores/:teamId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM day2_round_scores WHERE team_id = $1 ORDER BY round_number',
      [req.params.teamId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST submit round score
router.post('/scores', async (req, res) => {
  try {
    const { team_id, round_number, player1_gross, player2_gross, is_admin, auth_player_id, auth_pin } = req.body;
    if (!team_id || !round_number || player1_gross == null || player2_gross == null) {
      return res.status(400).json({ error: 'team_id, round_number, player1_gross, player2_gross required' });
    }
    if (![1, 2, 3].includes(parseInt(round_number))) {
      return res.status(400).json({ error: 'round_number must be 1, 2, or 3' });
    }

    // Authorization: only a player on this team or an admin may submit scores
    if (!is_admin) {
      if (!auth_player_id || !auth_pin) {
        return res.status(403).json({ error: 'You must be logged in as a player on this team to submit scores.' });
      }
      const pinRes = await pool.query('SELECT pin FROM players WHERE id = $1', [auth_player_id]);
      if (pinRes.rows.length === 0 || pinRes.rows[0].pin !== String(auth_pin).trim()) {
        return res.status(403).json({ error: 'Invalid credentials.' });
      }
      const memberRes = await pool.query(
        'SELECT id FROM day2_teams WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
        [team_id, auth_player_id]
      );
      if (memberRes.rows.length === 0) {
        return res.status(403).json({ error: 'You can only submit scores for your own team.' });
      }
    }

    // Get handicaps
    const teamRes = await pool.query(`
      SELECT p1.handicap AS h1, p2.handicap AS h2
      FROM day2_teams t
      JOIN players p1 ON p1.id = t.player1_id
      JOIN players p2 ON p2.id = t.player2_id
      WHERE t.id = $1
    `, [team_id]);
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    const { h1, h2 } = teamRes.rows[0];
    const net1 = calcNet9(parseInt(player1_gross), h1);
    const net2 = calcNet9(parseInt(player2_gross), h2);
    const net_score = net1 + net2;

    const result = await pool.query(`
      INSERT INTO day2_round_scores (team_id, round_number, player1_gross, player2_gross, net_score)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (team_id, round_number) DO UPDATE
        SET player1_gross = $3, player2_gross = $4, net_score = $5
      RETURNING *
    `, [team_id, round_number, player1_gross, player2_gross, net_score]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET draft state — who the winning captains have selected
router.get('/draft', async (req, res) => {
  try {
    const stateRes = await pool.query('SELECT * FROM tournament_state WHERE id = 1');
    const state = stateRes.rows[0];

    // Get top 2 teams by net score
    const lbRes = await pool.query(`
      SELECT
        t.id AS team_id,
        p1.id AS player1_id, p1.name AS player1_name,
        p2.id AS player2_id, p2.name AS player2_name,
        COALESCE(SUM(r.net_score), 0) AS total_net_score
      FROM day2_teams t
      JOIN players p1 ON p1.id = t.player1_id
      JOIN players p2 ON p2.id = t.player2_id
      LEFT JOIN day2_round_scores r ON r.team_id = t.id
      GROUP BY t.id, p1.id, p1.name, p2.id, p2.name
      ORDER BY total_net_score ASC
      LIMIT 2
    `);

    // All players for drafting
    const allPlayersRes = await pool.query('SELECT * FROM players ORDER BY name');
    const selectedRes = await pool.query('SELECT * FROM day3_players');

    res.json({
      state,
      winners: lbRes.rows,
      allPlayers: allPlayersRes.rows,
      selected: selectedRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add player to day3 team
router.post('/draft', async (req, res) => {
  try {
    const { player_id, team_name, is_captain } = req.body;
    if (!player_id || !team_name) {
      return res.status(400).json({ error: 'player_id and team_name required' });
    }
    if (!['truffle_hogs', 'mycelium_syndicate'].includes(team_name)) {
      return res.status(400).json({ error: 'team_name must be truffle_hogs or mycelium_syndicate' });
    }

    const result = await pool.query(`
      INSERT INTO day3_players (player_id, team_name, is_captain)
      VALUES ($1, $2, $3)
      ON CONFLICT (player_id) DO UPDATE SET team_name = $2, is_captain = $3
      RETURNING *
    `, [player_id, team_name, is_captain || false]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE remove player from day3 draft
router.delete('/draft/:playerId', async (req, res) => {
  try {
    await pool.query('DELETE FROM day3_players WHERE player_id = $1', [req.params.playerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST complete the draft
router.post('/draft/complete', async (req, res) => {
  try {
    const count = await pool.query('SELECT COUNT(*) FROM day3_players');
    if (parseInt(count.rows[0].count) < 20) {
      return res.status(400).json({ error: 'All 20 players must be assigned before completing draft' });
    }
    await pool.query(`
      UPDATE tournament_state SET day2_complete = TRUE, day2_draft_complete = TRUE, current_day = 2 WHERE id = 1
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

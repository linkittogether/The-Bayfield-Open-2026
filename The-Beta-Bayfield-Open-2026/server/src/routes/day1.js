const express = require('express');
const router = express.Router();
const pool = require('../db');

// Calculate net score for 9 holes
function calcNet9(gross, handicap) {
  return gross - Math.floor(handicap / 2);
}

// GET Day 1 leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.name, p.photo_url, p.handicap,
        d.gross_score, d.net_score,
        ROW_NUMBER() OVER (ORDER BY d.net_score ASC, d.gross_score ASC) AS rank
      FROM players p
      JOIN day1_scores d ON d.player_id = p.id
      ORDER BY d.net_score ASC, d.gross_score ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all day1 scores
router.get('/scores', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, p.name, p.handicap, p.photo_url
      FROM day1_scores d
      JOIN players p ON p.id = d.player_id
      ORDER BY d.net_score ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST submit score for a player
router.post('/scores', async (req, res) => {
  try {
    const { player_id, gross_score } = req.body;
    if (!player_id || gross_score == null) {
      return res.status(400).json({ error: 'player_id and gross_score required' });
    }

    const playerRes = await pool.query('SELECT handicap FROM players WHERE id = $1', [player_id]);
    if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const handicap = playerRes.rows[0].handicap;
    const net_score = calcNet9(parseInt(gross_score), handicap);

    const result = await pool.query(`
      INSERT INTO day1_scores (player_id, gross_score, net_score)
      VALUES ($1, $2, $3)
      ON CONFLICT (player_id) DO UPDATE SET gross_score = $2, net_score = $3
      RETURNING *
    `, [player_id, gross_score, net_score]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET pick state — who still needs to pick
router.get('/picks', async (req, res) => {
  try {
    const stateRes = await pool.query('SELECT * FROM tournament_state WHERE id = 1');
    const state = stateRes.rows[0];

    // Get ranked leaderboard
    const lbRes = await pool.query(`
      SELECT
        p.id, p.name, p.photo_url, p.handicap,
        d.gross_score, d.net_score,
        ROW_NUMBER() OVER (ORDER BY d.net_score ASC, d.gross_score ASC) AS rank
      FROM players p
      JOIN day1_scores d ON d.player_id = p.id
      ORDER BY d.net_score ASC, d.gross_score ASC
    `);
    const leaderboard = lbRes.rows;

    // Get existing teams to know who has been picked
    const teamsRes = await pool.query(`
      SELECT * FROM day2_teams ORDER BY pick_order ASC
    `);
    const teams = teamsRes.rows;

    // Determine next picker (starts at rank 10, goes to rank 1)
    const nextPickerRank = state.next_picker_rank;
    const nextPicker = leaderboard.find(p => parseInt(p.rank) === nextPickerRank);

    // Available picks: players ranked 11-20 who haven't been picked yet
    const pickedPlayerIds = teams.map(t => t.player2_id).filter(Boolean);
    const available = leaderboard.filter(p =>
      parseInt(p.rank) >= 11 && !pickedPlayerIds.includes(p.id)
    );

    res.json({
      state,
      leaderboard,
      teams,
      nextPicker,
      nextPickerRank,
      available,
      pickingComplete: state.day1_picking_complete
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST make a pick — assign partner
router.post('/picks', async (req, res) => {
  try {
    const { picker_player_id, picked_player_id, auth_player_id, auth_pin, is_admin } = req.body;
    if (!picker_player_id || !picked_player_id) {
      return res.status(400).json({ error: 'picker_player_id and picked_player_id required' });
    }

    // Authorization: only the picker themselves or an admin may submit this pick.
    let authorized = false;
    if (is_admin) {
      authorized = true;
    } else if (auth_player_id && auth_pin) {
      const authRes = await pool.query('SELECT pin FROM players WHERE id = $1', [auth_player_id]);
      if (
        authRes.rows.length > 0 &&
        authRes.rows[0].pin &&
        authRes.rows[0].pin === String(auth_pin).trim() &&
        parseInt(auth_player_id) === parseInt(picker_player_id)
      ) {
        authorized = true;
      }
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Only the player whose turn it is (or an admin) can make this pick.' });
    }

    const stateRes = await pool.query('SELECT * FROM tournament_state WHERE id = 1');
    const state = stateRes.rows[0];

    if (state.day1_picking_complete) {
      return res.status(400).json({ error: 'Picking is already complete' });
    }

    // Get the ranked leaderboard
    const lbRes = await pool.query(`
      SELECT
        p.id,
        ROW_NUMBER() OVER (ORDER BY d.net_score ASC, d.gross_score ASC) AS rank
      FROM players p
      JOIN day1_scores d ON d.player_id = p.id
      ORDER BY d.net_score ASC, d.gross_score ASC
    `);
    const leaderboard = lbRes.rows;

    const pickerEntry = leaderboard.find(p => p.id === parseInt(picker_player_id));
    if (!pickerEntry) return res.status(400).json({ error: 'Picker not on leaderboard' });

    const pickerRank = parseInt(pickerEntry.rank);
    const expectedRank = state.next_picker_rank;

    if (pickerRank !== expectedRank) {
      return res.status(400).json({ error: `It is rank ${expectedRank}'s turn to pick, not rank ${pickerRank}` });
    }

    // Verify picked player is available (ranked 11-20 and not yet picked)
    const pickedEntry = leaderboard.find(p => p.id === parseInt(picked_player_id));
    if (!pickedEntry || parseInt(pickedEntry.rank) < 11) {
      return res.status(400).json({ error: 'Picked player must be ranked 11-20' });
    }

    const alreadyPicked = await pool.query(
      'SELECT id FROM day2_teams WHERE player2_id = $1',
      [picked_player_id]
    );
    if (alreadyPicked.rows.length > 0) {
      return res.status(400).json({ error: 'That player has already been picked' });
    }

    // Create team
    const teamName = `Team ${11 - pickerRank + 10}`;
    await pool.query(
      'INSERT INTO day2_teams (player1_id, player2_id, pick_order, name) VALUES ($1, $2, $3, $4)',
      [picker_player_id, picked_player_id, pickerRank, teamName]
    );

    // Update tournament state — next picker is the one above (rank decrements)
    const nextRank = pickerRank - 1;
    const pickingComplete = nextRank < 1;

    await pool.query(`
      UPDATE tournament_state SET
        next_picker_rank = $1,
        day1_picking_started = TRUE,
        day1_picking_complete = $2
      WHERE id = 1
    `, [nextRank, pickingComplete]);

    res.json({ success: true, pickingComplete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST mark day1 as complete
router.post('/complete', async (req, res) => {
  try {
    await pool.query(`
      UPDATE tournament_state SET day1_complete = TRUE, current_day = 1 WHERE id = 1
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

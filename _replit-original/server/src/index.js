const express = require('express');
const cors = require('cors');
const path = require('path');

const playersRouter = require('./routes/players');
const day1Router = require('./routes/day1');
const day2Router = require('./routes/day2');
const day3Router = require('./routes/day3');
const tournamentRouter = require('./routes/tournament');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/players', playersRouter);
app.use('/api/day1', day1Router);
app.use('/api/day2', day2Router);
app.use('/api/day3', day3Router);
app.use('/api/tournament', tournamentRouter);
app.use('/api/auth', authRouter);

// Serve React client in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.use((req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bayfield Open server running on port ${PORT}`);
});

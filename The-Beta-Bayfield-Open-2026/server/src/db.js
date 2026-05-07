const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = pool;

try {
  // your pool setup
} catch (err) {
  console.error('DB connection failed:', err.message);
}

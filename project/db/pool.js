const { Pool } = require('pg');

// Пул соединений с PostgreSQL. Все запросы в проекте идут только
// через параметризованные запросы ($1, $2, ...) — это защита от SQL Injection.
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

module.exports = pool;

const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { ensureCsrfToken } = require('../middleware/csrf');

const router = express.Router();

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  // Базовая валидация входных данных
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }
  if (username.trim().length === 0 || username.length > 50) {
    return res.status(400).json({ error: 'Некорректный логин' });
  }
  if (password.length === 0 || password.length > 200) {
    return res.status(400).json({ error: 'Некорректный пароль' });
  }

  try {
    // Параметризованный запрос — защита от SQL Injection
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // Регенерируем сессию при входе (защита от session fixation)
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      const csrfToken = ensureCsrfToken(req);
      return res.json({ id: user.id, username: user.username, csrfToken });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

// GET /api/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const csrfToken = ensureCsrfToken(req);
  return res.json({ id: req.session.userId, username: req.session.username, csrfToken });
});

module.exports = router;

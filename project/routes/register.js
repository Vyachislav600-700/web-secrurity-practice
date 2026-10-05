const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');

const router = express.Router();

// POST /api/register — регистрация обычного покупателя
router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }
  if (username.trim().length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'Логин должен быть от 3 до 50 символов' });
  }
  if (password.length < 6 || password.length > 200) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Такой логин уже занят' });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'customer')
       RETURNING id, username, role`,
      [username.trim(), hash]
    );

    const user = result.rows[0];

    // Сразу логиним пользователя после регистрации
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      return res.status(201).json({ id: user.id, username: user.username, role: user.role });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const upload = require('../middleware/upload');

const router = express.Router();

// Весь раздел категорий доступен только авторизованному администратору
router.use(requireAuth);

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, image_path FROM categories ORDER BY id DESC'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/categories
router.post('/', verifyCsrfToken, upload.single('image'), async (req, res) => {
  const { name } = req.body || {};

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 150) {
    return res.status(400).json({ error: 'Название категории обязательно (до 150 символов)' });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      'INSERT INTO categories (name, image_path) VALUES ($1, $2) RETURNING id, name, image_path',
      [name.trim(), imagePath]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/categories/:id
router.put('/:id', verifyCsrfToken, upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Некорректный id' });
  }
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 150) {
    return res.status(400).json({ error: 'Название категории обязательно (до 150 символов)' });
  }

  try {
    let query, params;
    if (req.file) {
      const imagePath = `/uploads/${req.file.filename}`;
      query = 'UPDATE categories SET name = $1, image_path = $2 WHERE id = $3 RETURNING id, name, image_path';
      params = [name.trim(), imagePath, id];
    } else {
      query = 'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name, image_path';
      params = [name.trim(), id];
    }
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', verifyCsrfToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Некорректный id' });
  }

  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

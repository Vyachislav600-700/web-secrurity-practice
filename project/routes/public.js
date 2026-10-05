const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/public/categories — список категорий, без авторизации
router.get('/categories', async (req, res) => {
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

// GET /api/public/products?search=...&category=...&price_from=...&price_to=...
router.get('/products', async (req, res) => {
  const { search, category, price_from, price_to } = req.query;

  const conditions = [];
  const params = [];

  if (typeof search === 'string' && search.trim().length > 0) {
    params.push(`%${search.trim()}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
  }

  if (category !== undefined) {
    const categoryId = Number(category);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({ error: 'Некорректный параметр category' });
    }
    params.push(categoryId);
    conditions.push(`p.category_id = $${params.length}`);
  }

  if (price_from !== undefined) {
    const from = Number(price_from);
    if (Number.isNaN(from) || from < 0) {
      return res.status(400).json({ error: 'Некорректный параметр price_from' });
    }
    params.push(from);
    conditions.push(`p.price >= $${params.length}`);
  }

  if (price_to !== undefined) {
    const to = Number(price_to);
    if (Number.isNaN(to) || to < 0) {
      return res.status(400).json({ error: 'Некорректный параметр price_to' });
    }
    params.push(to);
    conditions.push(`p.price <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT p.id, p.name, p.description, p.price, p.category_id, p.image_path, c.name AS category_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    ${where}
    ORDER BY p.id DESC
  `;

  try {
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

// GET /api/products?search=...&category=...&price_from=...&price_to=...
router.get('/', async (req, res) => {
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

  // Все значения передаются только через параметры ($1, $2, ...),
  // текст запроса с пользовательскими данными не склеивается — защита от SQL Injection.
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

async function validateProductInput(body) {
  const errors = [];
  const { name, description, price, category_id: categoryId } = body;

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200) {
    errors.push('Название товара обязательно (до 200 символов)');
  }
  if (description !== undefined && typeof description === 'string' && description.length > 5000) {
    errors.push('Описание слишком длинное');
  }

  const priceNum = Number(price);
  if (price === undefined || price === '' || Number.isNaN(priceNum) || priceNum <= 0) {
    errors.push('Цена должна быть числом больше 0');
  }

  const categoryIdNum = Number(categoryId);
  if (!Number.isInteger(categoryIdNum) || categoryIdNum <= 0) {
    errors.push('Некорректная категория');
  }

  return { errors, priceNum, categoryIdNum };
}

// POST /api/products
router.post('/', verifyCsrfToken, upload.single('image'), async (req, res) => {
  const { name, description } = req.body || {};
  const { errors, priceNum, categoryIdNum } = await validateProductInput(req.body || {});

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  try {
    // Проверяем, что категория действительно существует
    const categoryCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [categoryIdNum]);
    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Категория не найдена' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO products (name, description, price, category_id, image_path)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, price, category_id, image_path`,
      [name.trim(), description ? description.trim() : null, priceNum, categoryIdNum, imagePath]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/products/:id
router.put('/:id', verifyCsrfToken, upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Некорректный id' });
  }

  const { name, description } = req.body || {};
  const { errors, priceNum, categoryIdNum } = await validateProductInput(req.body || {});

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  try {
    const categoryCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [categoryIdNum]);
    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Категория не найдена' });
    }

    let query, params;
    if (req.file) {
      const imagePath = `/uploads/${req.file.filename}`;
      query = `UPDATE products SET name=$1, description=$2, price=$3, category_id=$4, image_path=$5
               WHERE id=$6 RETURNING id, name, description, price, category_id, image_path`;
      params = [name.trim(), description ? description.trim() : null, priceNum, categoryIdNum, imagePath, id];
    } else {
      query = `UPDATE products SET name=$1, description=$2, price=$3, category_id=$4
               WHERE id=$5 RETURNING id, name, description, price, category_id, image_path`;
      params = [name.trim(), description ? description.trim() : null, priceNum, categoryIdNum, id];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', verifyCsrfToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Некорректный id' });
  }

  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

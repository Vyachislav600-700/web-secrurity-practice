const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');

const router = express.Router();

// Корзина доступна любому авторизованному пользователю (и покупателю, и админу)
router.use(requireAuth);

// Корзина хранится прямо в сессии: { productId: quantity }
function getCart(req) {
  if (!req.session.cart) {
    req.session.cart = {};
  }
  return req.session.cart;
}

// GET /api/cart — содержимое корзины с подробностями о товарах
router.get('/', async (req, res) => {
  const cart = getCart(req);
  const productIds = Object.keys(cart).map(Number);

  if (productIds.length === 0) {
    return res.json({ items: [], total: 0 });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, price, image_path FROM products WHERE id = ANY($1::int[])`,
      [productIds]
    );

    const items = result.rows.map((p) => ({
      productId: p.id,
      name: p.name,
      price: Number(p.price),
      image_path: p.image_path,
      quantity: cart[p.id],
      subtotal: Number(p.price) * cart[p.id],
    }));

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    return res.json({ items, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/cart/add — добавить товар в корзину
router.post('/add', verifyCsrfToken, async (req, res) => {
  const productId = Number(req.body?.productId);
  const quantity = Number(req.body?.quantity) || 1;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Некорректный товар' });
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
    return res.status(400).json({ error: 'Некорректное количество' });
  }

  try {
    const check = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const cart = getCart(req);
    cart[productId] = (cart[productId] || 0) + quantity;

    return res.json({ ok: true, cart });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/cart/:productId — убрать товар из корзины
router.delete('/:productId', verifyCsrfToken, (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Некорректный товар' });
  }

  const cart = getCart(req);
  delete cart[productId];

  return res.json({ ok: true, cart });
});

module.exports = router;
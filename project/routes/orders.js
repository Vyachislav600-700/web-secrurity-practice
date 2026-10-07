const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

// Заказы доступны любому авторизованному пользователю
router.use(requireAuth);

function getCart(req) {
  if (!req.session.cart) {
    req.session.cart = {};
  }
  return req.session.cart;
}

// POST /api/orders — оформить заказ из текущей корзины
router.post('/', verifyCsrfToken, async (req, res) => {
  const cart = getCart(req);
  const productIds = Object.keys(cart).map(Number);

  if (productIds.length === 0) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Берём актуальные цены из базы данных (а не доверяем тому, что могло быть на клиенте)
    const productsResult = await client.query(
      'SELECT id, price FROM products WHERE id = ANY($1::int[])',
      [productIds]
    );

    if (productsResult.rows.length !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Один из товаров в корзине больше не существует' });
    }

    const total = productsResult.rows.reduce(
      (sum, p) => sum + Number(p.price) * cart[p.id],
      0
    );

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status, total) VALUES ($1, 'new', $2) RETURNING id`,
      [req.session.userId, total]
    );
    const orderId = orderResult.rows[0].id;

    for (const p of productsResult.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4)`,
        [orderId, p.id, cart[p.id], p.price]
      );
    }

    await client.query('COMMIT');

    // Корзина очищается после успешного оформления заказа
    req.session.cart = {};

    return res.status(201).json({ ok: true, orderId, total });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// GET /api/orders/my — история заказов текущего пользователя
router.get('/my', async (req, res) => {
  try {
    const ordersResult = await pool.query(
      'SELECT id, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC',
      [req.session.userId]
    );

    const orders = [];
    for (const order of ordersResult.rows) {
      const itemsResult = await pool.query(
        `SELECT oi.product_id, oi.quantity, oi.price_at_purchase, p.name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1`,
        [order.id]
      );
      orders.push({ ...order, items: itemsResult.rows });
    }

    return res.json(orders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/orders/all — все заказы всех покупателей (только для администратора)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT o.id, o.status, o.total, o.created_at, u.username
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.id DESC`
    );

    const orders = [];
    for (const order of ordersResult.rows) {
      const itemsResult = await pool.query(
        `SELECT oi.product_id, oi.quantity, oi.price_at_purchase, p.name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1`,
        [order.id]
      );
      orders.push({ ...order, items: itemsResult.rows });
    }

    return res.json(orders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/orders/:id/status — сменить статус заказа (только для администратора)
router.put('/:id/status', requireAdmin, verifyCsrfToken, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  const allowedStatuses = ['new', 'processing', 'done', 'cancelled'];

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Некорректный id' });
  }
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
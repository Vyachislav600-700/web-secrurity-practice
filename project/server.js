require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { waf } = require('./middleware/waf');
const authRoutes = require('./routes/auth');
const categoriesRoutes = require('./routes/categories');
const productsRoutes = require('./routes/products');
const { requireAuth } = require('./middleware/auth');
const { ensureCsrfToken } = require('./middleware/csrf');

const app = express();

// Базовые security-заголовки (защищает в т.ч. от части XSS-сценариев)
app.use(
  helmet({
    contentSecurityPolicy: false, // отключено ради простоты локальной демонстрации
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // кука недоступна из JS -> меньше риск кражи через XSS
      sameSite: 'lax', // дополнительная защита от CSRF
      secure: false, // поставьте true, если сайт работает по HTTPS
      maxAge: 1000 * 60 * 60 * 2, // 2 часа
    },
  })
);

// WAF проверяет все запросы к API до того, как они попадут в бизнес-логику
app.use('/api', waf);

app.get('/api/csrf-token', (req, res) => {
  if (!req.session) {
    return res.status(500).json({ error: 'Session not initialized' });
  }
  return res.json({ csrfToken: ensureCsrfToken(req) });
});

app.use('/api', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);

// Загруженные изображения
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Frontend (статика)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Сервер запущен: http://localhost:${process.env.PORT || 3000}`);
});

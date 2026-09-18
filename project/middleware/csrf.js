const crypto = require('crypto');

// Простая, но рабочая защита от CSRF (double-submit token, привязанный к сессии).
// 1) При авторизации генерируем случайный токен и кладём в сессию.
// 2) Frontend получает токен через GET /api/csrf-token и шлёт его в заголовке
//    X-CSRF-Token в каждом POST/PUT/DELETE запросе.
// 3) Сервер сравнивает токен из заголовка с токеном в сессии.
// Так как токен известен только тому, кто уже получил ответ с "нашего" домена,
// сторонний сайт не может подставить его в свою форму/fetch-запрос.

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function verifyCsrfToken(req, res, next) {
  const headerToken = req.headers['x-csrf-token'];
  const sessionToken = req.session && req.session.csrfToken;

  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  return next();
}

module.exports = { ensureCsrfToken, verifyCsrfToken };

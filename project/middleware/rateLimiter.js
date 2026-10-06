const rateLimit = require('express-rate-limit');

// Ограничение количества попыток входа: не больше 5 попыток за 15 минут
// с одного IP-адреса. Защита от подбора пароля (brute-force).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.' },
});

module.exports = { loginLimiter };
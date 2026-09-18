// Проверка, что пользователь авторизован (сессия активна).
// Если нет — возвращаем 401 Unauthorized, как требуется в задании.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAuth };

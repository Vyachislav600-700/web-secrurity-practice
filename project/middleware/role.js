// Проверка, что у авторизованного пользователя роль admin.
// Используется ПОСЛЕ requireAuth — т.е. сессия уже точно есть.
function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Доступ разрешён только администратору' });
}

module.exports = { requireAdmin };
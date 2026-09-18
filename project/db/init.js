// Скрипт первоначальной настройки базы данных.
// Создаёт таблицы (если их ещё нет) и одного администратора.
// Запуск: npm run initdb

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./pool');

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Таблицы созданы (или уже существовали).');

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin12345';

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

  if (existing.rows.length > 0) {
    console.log(`Пользователь "${username}" уже существует, пропускаю создание.`);
  } else {
    // Пароль никогда не хранится в открытом виде — только bcrypt-хеш.
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hash]
    );
    console.log(`Создан пользователь "${username}" с паролем из .env (ADMIN_PASSWORD).`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Ошибка инициализации БД:', err);
  process.exit(1);
});

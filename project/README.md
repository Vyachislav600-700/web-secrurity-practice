# E-commerce Admin — безопасное Web-приложение

Административная панель интернет-магазина: категории, товары, поиск и
фильтрация, вход по логину/паролю с сессиями.

Стек: **Node.js + Express** (backend, REST API) · **PostgreSQL** (БД) ·
**HTML/CSS/JavaScript (Fetch API)** (frontend).

Реализованная защита (раздел 6 задания):
- пароли хранятся только как bcrypt-хеш;
- валидация всех входных данных на backend;
- защита от SQL Injection — везде только параметризованные запросы (`pg`, `$1,$2,...`);
- защита от XSS — вывод данных на фронте через `textContent` (без `innerHTML`), заголовки безопасности через `helmet`;
- защита от CSRF — токен, привязанный к сессии, плюс `SameSite=Lax` у cookie;
- все API, изменяющие данные, закрыты сессией (`401 Unauthorized` без входа);
- простой WAF-мидлвар, блокирующий подозрительные запросы (SQLi/XSS-паттерны) кодом `403`;
- безопасная загрузка файлов: проверка типа файла, ограничение размера, случайное имя файла на сервере.

---

## Что скачать и установить

1. **Node.js** (LTS, версия 18 или новее) — https://nodejs.org
   Проверка после установки: `node -v` и `npm -v` в терминале.

2. **PostgreSQL** (версия 14+) — https://www.postgresql.org/download/
   При установке запомните пароль пользователя `postgres`.
   Можно поставить и через GUI-программу **pgAdmin** (идёт вместе с установщиком) — так проще создать базу данных мышкой.

3. (не обязательно, но удобно) **VS Code** — https://code.visualstudio.com

Больше ничего ставить не нужно — все остальные зависимости (Express и т.д.) установятся одной командой `npm install`.

---

## Пошаговый запуск

### 1. Создать базу данных в PostgreSQL

Через `psql` (терминал):
```bash
psql -U postgres
CREATE DATABASE shop_admin;
\q
```
Или через pgAdmin: правой кнопкой на "Databases" → Create → Database → имя `shop_admin`.

### 2. Настроить проект

В папке проекта:
```bash
npm install
cp .env.example .env
```
Откройте `.env` и впишите свои данные PostgreSQL (хост/порт обычно остаются
как есть, поменяйте `PGPASSWORD` на свой пароль от postgres). Здесь же
задаётся логин/пароль будущего администратора (`ADMIN_USERNAME`,
`ADMIN_PASSWORD`).

### 3. Создать таблицы и администратора

```bash
npm run initdb
```
Эта команда создаст таблицы `users`, `categories`, `products` и одного
пользователя-администратора с паролем из `.env` (хранится как хеш).

### 4. Запустить сервер

```bash
npm start
```
Откройте в браузере: **http://localhost:3000**
Войдите под логином/паролем из `.env` (по умолчанию `admin` / `admin12345`).

---

## Структура проекта

```
server.js              — точка входа, настройка Express, сессий, WAF
db/schema.sql           — SQL-схема (users, categories, products)
db/init.js               — создание таблиц + администратора
db/pool.js                — подключение к PostgreSQL
middleware/auth.js         — проверка авторизации (сессия)
middleware/csrf.js          — выдача и проверка CSRF-токена
middleware/waf.js            — простой WAF (фильтр подозрительных запросов)
middleware/upload.js          — безопасная загрузка изображений (multer)
routes/auth.js                 — /api/login, /api/logout, /api/me
routes/categories.js            — CRUD категорий
routes/products.js               — CRUD товаров + поиск/фильтрация
public/login.html, admin.html     — страницы
public/js/login.js, admin.js       — логика фронтенда (Fetch API)
public/css/style.css                — стили
uploads/                              — загруженные картинки
```

## Список API (как в задании)

```
POST   /api/login
POST   /api/logout
GET    /api/me

GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

GET    /api/products
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id

GET /api/products?search=phone
GET /api/products?category=2
GET /api/products?price_from=50000&price_to=200000
```

Все методы, кроме `GET`, требуют:
- активную сессию (иначе `401`);
- заголовок `X-CSRF-Token` (иначе `403`) — токен фронтенд получает при входе (`/api/login` или `/api/me`).

## Если что-то не запускается

- **`ECONNREFUSED` при старте** — PostgreSQL не запущен или неверные данные в `.env`.
- **`password authentication failed`** — неверный `PGPASSWORD` в `.env`.
- **Порт 3000 занят** — поменяйте `PORT` в `.env`.

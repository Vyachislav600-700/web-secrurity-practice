const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Безопасная загрузка файлов:
// - принимаются только картинки (по MIME-типу и расширению);
// - ограничение размера файла;
// - имя файла генерируется случайно (не используется имя, присланное пользователем) —
//   это защищает от path traversal и перезаписи чужих файлов.

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
    return cb(new Error('Разрешены только изображения JPG, PNG, WEBP'));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
});

module.exports = upload;

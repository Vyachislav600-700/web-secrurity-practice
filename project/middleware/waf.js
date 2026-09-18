// Простейший Web Application Firewall.
// Проверяет query-параметры, body и параметры URL на признаки типовых атак
// (SQL Injection, XSS, попытки обхода пути) и блокирует подозрительные запросы
// кодом 403, ещё до того как они дойдут до бизнес-логики и базы данных.
//
// Это не замена параметризованным запросам и экранированию вывода —
// это дополнительный рубеж защиты, как и требуется в задании (п. 6.6).

const SQLI_PATTERNS = [
  /(\bunion\b.{0,40}\bselect\b)/i,
  /(\bselect\b.{0,40}\bfrom\b)/i,
  /(\bdrop\b\s+\btable\b)/i,
  /(\binsert\b\s+\binto\b)/i,
  /(\bor\b\s+\d+\s*=\s*\d+)/i,
  /('|")\s*(or|and)\s*('|")?\s*\d+\s*=\s*\d+/i,
  /(--|#|\/\*)/,
  /(\bxp_cmdshell\b)/i,
];

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /on\w+\s*=\s*["']/i, // onerror=, onclick=, ...
  /javascript:/i,
  /<iframe[\s>]/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
];

const ALL_PATTERNS = [...SQLI_PATTERNS, ...XSS_PATTERNS, ...PATH_TRAVERSAL_PATTERNS];

function containsSuspiciousContent(value) {
  if (typeof value === 'string') {
    return ALL_PATTERNS.some((re) => re.test(value));
  }
  if (Array.isArray(value)) {
    return value.some(containsSuspiciousContent);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsSuspiciousContent);
  }
  return false;
}

function waf(req, res, next) {
  const suspicious =
    containsSuspiciousContent(req.query) ||
    containsSuspiciousContent(req.body) ||
    containsSuspiciousContent(req.params);

  if (suspicious) {
    console.warn(`[WAF] Заблокирован подозрительный запрос: ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ error: 'Request blocked by WAF' });
  }

  return next();
}

module.exports = { waf };

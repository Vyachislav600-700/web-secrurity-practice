let csrfToken = null;

async function api(url, options = {}) {
  const opts = {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.headers || {}) },
  };

  const method = (opts.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method) && csrfToken) {
    opts.headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(url, opts);

  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }

  return res;
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

async function init() {
  const meRes = await api('/api/me');
  const me = await meRes.json();
  csrfToken = me.csrfToken;
  document.getElementById('whoami').textContent = me.username;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  await loadCategories();
  await loadProducts();

  document.getElementById('filter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadProducts();
  });

  document.getElementById('filter-reset').addEventListener('click', async () => {
    document.getElementById('filter-form').reset();
    await loadProducts();
  });
}

async function loadCategories() {
  const res = await api('/api/public/categories');
  const categories = await res.json();

  const select = document.getElementById('filter-category');
  clearChildren(select);
  select.appendChild(el('option', 'Все категории', { value: '' }));
  categories.forEach((cat) => {
    select.appendChild(el('option', cat.name, { value: cat.id }));
  });
}

async function loadProducts() {
  const search = document.getElementById('filter-search').value.trim();
  const category = document.getElementById('filter-category').value;
  const priceFrom = document.getElementById('filter-price-from').value;
  const priceTo = document.getElementById('filter-price-to').value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (priceFrom) params.set('price_from', priceFrom);
  if (priceTo) params.set('price_to', priceTo);

  const res = await api(`/api/public/products?${params.toString()}`);
  const products = await res.json();
  renderProducts(products);
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  clearChildren(grid);

  products.forEach((p) => {
    const card = el('div', null, { class: 'product-card' });

    if (p.image_path) {
      card.appendChild(el('img', null, { src: p.image_path, alt: '' }));
    }

    card.appendChild(el('h3', p.name));
    card.appendChild(el('p', p.category_name, { class: 'product-category' }));
    card.appendChild(el('p', `${p.price} ₸`, { class: 'product-price' }));

    const addBtn = el('button', 'В корзину', { type: 'button' });
    addBtn.addEventListener('click', () => addToCart(p.id));
    card.appendChild(addBtn);

    grid.appendChild(card);
  });
}

async function addToCart(productId) {
  const res = await api('/api/cart/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity: 1 }),
  });

  if (!res.ok) {
    const data = await res.json();
    alert(data.error || 'Ошибка добавления в корзину');
    return;
  }

  alert('Товар добавлен в корзину');
}

init();
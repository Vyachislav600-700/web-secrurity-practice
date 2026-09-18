let csrfToken = null;
let categoriesCache = [];

// ---------- Вспомогательные функции ----------

async function api(url, options = {}) {
  const opts = {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  };

  // CSRF-токен добавляется ко всем запросам, изменяющим данные
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

// Создаёт DOM-элемент безопасно (без innerHTML), чтобы данные из БД
// никогда не интерпретировались как HTML/JS — защита от XSS на фронтенде.
function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

// ---------- Инициализация ----------

async function init() {
  const meRes = await api('/api/me');
  const me = await meRes.json();
  csrfToken = me.csrfToken;
  document.getElementById('whoami').textContent = me.username;

  setupTabs();
  setupLogout();
  setupCategoryForm();
  setupProductForm();
  setupFilterForm();

  await loadCategories();
  await loadProducts();
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

function setupLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}

// ---------- Категории ----------

async function loadCategories() {
  const res = await api('/api/categories');
  categoriesCache = await res.json();
  renderCategoriesTable();
  renderCategorySelects();
}

function renderCategoriesTable() {
  const body = document.getElementById('categories-body');
  clearChildren(body);

  categoriesCache.forEach((cat) => {
    const tr = document.createElement('tr');

    tr.appendChild(el('td', String(cat.id)));

    const imgTd = document.createElement('td');
    if (cat.image_path) {
      const img = el('img', null, { src: cat.image_path, alt: '' });
      imgTd.appendChild(img);
    }
    tr.appendChild(imgTd);

    tr.appendChild(el('td', cat.name));

    const actionsTd = document.createElement('td');
    const editBtn = el('button', 'Изменить', { class: 'edit-btn', type: 'button' });
    editBtn.addEventListener('click', () => startEditCategory(cat));
    const delBtn = el('button', 'Удалить', { class: 'delete-btn', type: 'button' });
    delBtn.addEventListener('click', () => deleteCategory(cat.id));
    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);

    body.appendChild(tr);
  });
}

function renderCategorySelects() {
  const filterSelect = document.getElementById('filter-category');
  const productSelect = document.getElementById('product-category');

  clearChildren(filterSelect);
  filterSelect.appendChild(el('option', 'Все категории', { value: '' }));

  clearChildren(productSelect);
  productSelect.appendChild(el('option', 'Выберите категорию', { value: '' }));

  categoriesCache.forEach((cat) => {
    filterSelect.appendChild(el('option', cat.name, { value: cat.id }));
    productSelect.appendChild(el('option', cat.name, { value: cat.id }));
  });
}

function setupCategoryForm() {
  const form = document.getElementById('category-form');
  const cancelBtn = document.getElementById('category-cancel-edit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value;
    const imageFile = document.getElementById('category-image').files[0];

    const formData = new FormData();
    formData.append('name', name);
    if (imageFile) formData.append('image', imageFile);

    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';

    const res = await api(url, { method, body: formData });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Ошибка сохранения категории');
      return;
    }

    resetCategoryForm();
    await loadCategories();
    await loadProducts();
  });

  cancelBtn.addEventListener('click', resetCategoryForm);
}

function startEditCategory(cat) {
  document.getElementById('category-id').value = cat.id;
  document.getElementById('category-name').value = cat.name;
  document.getElementById('category-cancel-edit').style.display = 'inline-block';
}

function resetCategoryForm() {
  document.getElementById('category-form').reset();
  document.getElementById('category-id').value = '';
  document.getElementById('category-cancel-edit').style.display = 'none';
}

async function deleteCategory(id) {
  if (!confirm('Удалить категорию вместе со всеми её товарами?')) return;
  const res = await api(`/api/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error || 'Ошибка удаления');
    return;
  }
  await loadCategories();
  await loadProducts();
}

// ---------- Товары ----------

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

  const res = await api(`/api/products?${params.toString()}`);
  const products = await res.json();
  renderProductsTable(products);
}

function renderProductsTable(products) {
  const body = document.getElementById('products-body');
  clearChildren(body);

  products.forEach((p) => {
    const tr = document.createElement('tr');

    tr.appendChild(el('td', String(p.id)));

    const imgTd = document.createElement('td');
    if (p.image_path) {
      imgTd.appendChild(el('img', null, { src: p.image_path, alt: '' }));
    }
    tr.appendChild(imgTd);

    tr.appendChild(el('td', p.name));
    tr.appendChild(el('td', p.category_name));
    tr.appendChild(el('td', `${p.price}`));

    const actionsTd = document.createElement('td');
    const editBtn = el('button', 'Изменить', { class: 'edit-btn', type: 'button' });
    editBtn.addEventListener('click', () => startEditProduct(p));
    const delBtn = el('button', 'Удалить', { class: 'delete-btn', type: 'button' });
    delBtn.addEventListener('click', () => deleteProduct(p.id));
    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);

    body.appendChild(tr);
  });
}

function setupProductForm() {
  const form = document.getElementById('product-form');
  const cancelBtn = document.getElementById('product-cancel-edit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const description = document.getElementById('product-description').value;
    const price = document.getElementById('product-price').value;
    const categoryId = document.getElementById('product-category').value;
    const imageFile = document.getElementById('product-image').files[0];

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('category_id', categoryId);
    if (imageFile) formData.append('image', imageFile);

    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    const res = await api(url, { method, body: formData });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Ошибка сохранения товара');
      return;
    }

    resetProductForm();
    await loadProducts();
  });

  cancelBtn.addEventListener('click', resetProductForm);
}

function startEditProduct(p) {
  document.getElementById('product-id').value = p.id;
  document.getElementById('product-name').value = p.name;
  document.getElementById('product-description').value = p.description || '';
  document.getElementById('product-price').value = p.price;
  document.getElementById('product-category').value = p.category_id;
  document.getElementById('product-cancel-edit').style.display = 'inline-block';
}

function resetProductForm() {
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-cancel-edit').style.display = 'none';
}

async function deleteProduct(id) {
  if (!confirm('Удалить товар?')) return;
  const res = await api(`/api/products/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error || 'Ошибка удаления');
    return;
  }
  await loadProducts();
}

function setupFilterForm() {
  const form = document.getElementById('filter-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadProducts();
  });

  document.getElementById('filter-reset').addEventListener('click', async () => {
    form.reset();
    await loadProducts();
  });
}

init();

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

  document.getElementById('checkout-btn').addEventListener('click', checkout);

  await loadCart();
}

async function loadCart() {
  const res = await api('/api/cart');
  const data = await res.json();
  renderCart(data);
}

function renderCart(data) {
  const body = document.getElementById('cart-body');
  clearChildren(body);

  document.getElementById('cart-empty').style.display = data.items.length === 0 ? 'block' : 'none';
  document.getElementById('checkout-btn').style.display = data.items.length === 0 ? 'none' : 'inline-block';

  data.items.forEach((item) => {
    const tr = document.createElement('tr');

    const imgTd = document.createElement('td');
    if (item.image_path) {
      imgTd.appendChild(el('img', null, { src: item.image_path, alt: '' }));
    }
    tr.appendChild(imgTd);

    tr.appendChild(el('td', item.name));
    tr.appendChild(el('td', `${item.price} ₸`));
    tr.appendChild(el('td', String(item.quantity)));
    tr.appendChild(el('td', `${item.subtotal} ₸`));

    const actionsTd = document.createElement('td');
    const delBtn = el('button', 'Убрать', { class: 'delete-btn', type: 'button' });
    delBtn.addEventListener('click', () => removeItem(item.productId));
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);

    body.appendChild(tr);
  });

  document.getElementById('cart-total').textContent = `Итого: ${data.total} ₸`;
}

async function removeItem(productId) {
  await api(`/api/cart/${productId}`, { method: 'DELETE' });
  await loadCart();
}

async function checkout() {
  const msg = document.getElementById('checkout-msg');
  msg.textContent = '';

  const res = await api('/api/orders', { method: 'POST' });
  const data = await res.json();

  if (!res.ok) {
    msg.textContent = data.error || 'Ошибка оформления заказа';
    return;
  }

  window.location.href = '/my-orders.html';
}

init();
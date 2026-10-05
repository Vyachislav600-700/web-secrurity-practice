async function api(url, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  const res = await fetch(url, opts);

  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }

  return res;
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
  document.getElementById('whoami').textContent = me.username;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  const res = await api('/api/orders/my');
  const orders = await res.json();
  renderOrders(orders);
}

function renderOrders(orders) {
  const list = document.getElementById('orders-list');
  document.getElementById('orders-empty').style.display = orders.length === 0 ? 'block' : 'none';

  orders.forEach((order) => {
    const card = el('div', null, { class: 'product-card', style: 'margin-bottom:12px; max-width:500px;' });

    const date = new Date(order.created_at).toLocaleString('ru-RU');
    card.appendChild(el('h3', `Заказ №${order.id} — ${order.status}`));
    card.appendChild(el('p', `Дата: ${date}`));

    const itemsList = document.createElement('ul');
    order.items.forEach((item) => {
      itemsList.appendChild(
        el('li', `${item.name} — ${item.quantity} × ${item.price_at_purchase} ₸`)
      );
    });
    card.appendChild(itemsList);

    card.appendChild(el('p', `Итого: ${order.total} ₸`, { style: 'font-weight:600;' }));

    list.appendChild(card);
  });
}

init();
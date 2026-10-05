const form = document.getElementById('register-form');
const errorMsg = document.getElementById('error-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.error || 'Ошибка регистрации';
      return;
    }

    window.location.href = '/shop.html';
  } catch (err) {
    errorMsg.textContent = 'Не удалось связаться с сервером';
  }
});
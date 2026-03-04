const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Хранилище в памяти (для теста / Render free tier нормально)
const users = {};     // username → { password, name, photo, balance, premiumUntil, verified }
const posts = [];     // массив постов
let postIdCounter = 1;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Регистрация
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Заполни юзернейм и пароль' });
  }

  if (users[username]) {
    return res.status(400).json({ success: false, error: 'Такой юзернейм уже занят' });
  }

  users[username] = {
    password,           // В продакшене обязательно хешировать!
    name: username,
    photo: '',
    balance: 1000,
    premiumUntil: null,
    verified: false
  };

  console.log(`Зарегистрирован: ${username}`);
  res.json({ success: true, message: 'Добро пожаловать в Vikhrify!' });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!users[username] || users[username].password !== password) {
    return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }

  res.json({ success: true, username });
});

// Профиль — получить
app.post('/profile', (req, res) => {
  const { username } = req.body;
  if (!users[username]) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
  res.json({ success: true, user: users[username] });
});

// Обновить имя в профиле
app.post('/profile/update', (req, res) => {
  const { username, name } = req.body;
  if (!users[username]) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
  if (name) users[username].name = name;
  res.json({ success: true });
});

// Получить все посты
app.get('/posts', (req, res) => res.json(posts));

// Создать пост
app.post('/posts', (req, res) => {
  const { username, text, isPremium = false } = req.body;
  if (!users[username]) return res.status(403).json({ success: false, error: 'Сначала войди' });

  posts.unshift({
    id: postIdCounter++,
    username,
    text,
    likes: 0,
    comments: [],
    isPremium: !!isPremium,
    reactions: { '🔥': 0, '😂': 0 }
  });

  res.json({ success: true });
});

// Лайк
app.post('/posts/:id/like', (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (post) post.likes++;
  res.json({ success: true });
});

// Комментарий
app.post('/posts/:id/comment', (req, res) => {
  const { username, text } = req.body;
  const post = posts.find(p => p.id == req.params.id);
  if (post) post.comments.push({ username, text });
  res.json({ success: true });
});

// Реакция (только премиум-посты)
app.post('/posts/:id/react', (req, res) => {
  const { emoji } = req.body;
  const post = posts.find(p => p.id == req.params.id);
  if (!post || !post.isPremium) return res.status(403).json({ success: false, error: 'Только премиум-посты' });
  if (['🔥', '😂'].includes(emoji)) {
    post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;
  }
  res.json({ success: true });
});

// Купить премиум
app.post('/premium/buy', (req, res) => {
  const { username, method = 'VXR' } = req.body;
  if (!users[username]) return res.status(403).json({ success: false, error: 'Пользователь не найден' });

  const cost = method === 'VXR' ? 500 : 199;
  if (users[username].balance < cost) {
    return res.status(400).json({ success: false, error: 'Не хватает средств' });
  }

  users[username].balance -= cost;
  users[username].premiumUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
  users[username].verified = true;

  res.json({
    success: true,
    until: new Date(users[username].premiumUntil).toLocaleDateString('ru-RU')
  });
});

app.listen(PORT, () => {
  console.log(`Vikhrify запущен на порту ${PORT}`);
});
// =============================================
//          КРАСИВАЯ АДМИН-ПАНЕЛЬ
// =============================================
app.get('/admin', (req, res) => {
  const adminPass = 'sehpy9-qiqjux-hofgyN';

  if (req.query.pass !== adminPass) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Доступ запрещён</title>
        <style>
          body { font-family:sans-serif; background:#111; color:#eee; text-align:center; padding:100px 20px; }
          h1 { color:#f85149; }
        </style>
      </head>
      <body>
        <h1>Пароль неверный</h1>
        <p>Попробуй ещё раз или уходи</p>
      </body>
      </html>
    `);
  }

  const totalUsers = Object.keys(users).length;
  const totalPosts = posts.length;
  const activeUsers = new Set(posts.map(p => p.username)).size;

  const usersList = Object.entries(users).map(([username, data]) => ({
    username,
    hasPremium: !!data.premiumUntil,
    verified: data.verified,
    balance: data.balance || 0,
    premiumUntil: data.premiumUntil ? new Date(data.premiumUntil).toLocaleDateString('ru-RU') : '—'
  }));

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vikhrify Admin</title>
      <style>
        :root {
          --bg: #0d1117;
          --card: #161b22;
          --text: #c9d1d9;
          --accent: #58a6ff;
          --border: #30363d;
          --success: #3fb950;
          --danger: #f85149;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg);
          color: var(--text);
          margin: 0;
          padding: 20px 16px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: var(--accent); text-align: center; margin: 30px 0 40px; }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 50px;
        }
        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px 20px;
          text-align: center;
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        .card h3 { margin: 0 0 12px; color: #8b949e; font-size: 1rem; }
        .card .number { font-size: 3rem; font-weight: 700; color: var(--accent); line-height: 1; }
        table {
          width: 100%;
          border-collapse: collapse;
          background: var(--card);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        th, td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        th {
          background: #0e1117;
          color: var(--accent);
          font-weight: 600;
        }
        tr:hover { background: #1f2937; }
        .yes { color: var(--success); font-weight: bold; }
        .no  { color: var(--danger); }
        .premium-date { color: #79c0ff; }
        footer { text-align: center; margin-top: 60px; color: #444c56; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Vikhrify Admin Panel</h1>

        <div class="stats">
          <div class="card">
            <h3>Пользователей всего</h3>
            <div class="number">${totalUsers}</div>
          </div>
          <div class="card">
            <h3>Опубликовано постов</h3>
            <div class="number">${totalPosts}</div>
          </div>
          <div class="card">
            <h3>Активных авторов</h3>
            <div class="number">${activeUsers}</div>
          </div>
        </div>

        <h2 style="margin: 20px 0 16px; color:#8b949e;">Пользователи</h2>
        <table>
          <thead>
            <tr>
              <th>Юзернейм</th>
              <th>Премиум</th>
              <th>Верификация</th>
              <th>Баланс VXR</th>
              <th>Премиум до</th>
            </tr>
          </thead>
          <tbody>
            ${usersList.map(u => `
              <tr>
                <td><strong>@${u.username}</strong></td>
                <td class="${u.hasPremium ? 'yes' : 'no'}">${u.hasPremium ? 'Да' : 'Нет'}</td>
                <td class="${u.verified ? 'yes' : 'no'}">${u.verified ? '✓ Подтверждён' : '—'}</td>
                <td>${u.balance}</td>
                <td class="premium-date">${u.premiumUntil}</td>
              </tr>
            `).join('')}
            ${usersList.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:40px;">Пока нет пользователей</td></tr>' : ''}
          </tbody>
        </table>

        <footer>Обновлено: ${new Date().toLocaleString('ru-RU')}</footer>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Vikhrify сервер запущен на порту ${PORT}`);
});

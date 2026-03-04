const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

// Загрузка (если файл есть — сохраняем аккаунты и посты)
let users = {};
let posts = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    users = loaded.users || {};
    posts = loaded.posts || [];
  } catch {}
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Регистрация
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Заполни всё' });
  if (users ) return res.json({ success: false, error: 'Юзернейм занят' });

  users = {
    password,
    balance: 1000,
    verified: false,
    premiumUntil: null
  };
  saveData();
  res.json({ success: true });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users || users .password !== password) {
    return res.json({ success: false, error: 'Неверно' });
  }
  res.json({ success: true });
});

// Посты
app.get('/posts', (req, res) => res.json(posts));

app.post('/posts', (req, res) => {
  const { username, text } = req.body;
  if (!users ) return res.json({ success: false, error: 'Войди' });
  posts.unshift({ id: Date.now(), username, text, likes: 0, comments: [] });
  saveData();
  res.json({ success: true });
});

// Админка
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'sehpy9-qiqjux-hofgyN') return res.status(403).send('<h1 style="color:red;text-align:center">Пароль неверный</h1>');

  const userList = Object.keys(users).map(username => ({
    username,
    verified: users .verified,
    balance: users .balance || 0,
    premium: !!users .premiumUntil
  }));

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Админка</title>
      <style>
        body { background:#0d1117;color:#c9d1d9;font-family:Arial;padding:20px; }
        h1 { color:#58a6ff;text-align:center; }
        table { width:100%;border-collapse:collapse; }
        th,td { padding:10px;border:1px solid #30363d; }
        .yes { color:#3fb950; }
        .no { color:#f85149; }
        button { background:#238636;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer; }
      </style>
    </head>
    <body>
      <h1>Админка Vikhrify</h1>
      <table>
        <tr><th>Юзер</th><th>Галочка</th><th>Баланс</th><th>Действия</th></tr>
        ${userList.map(u => `
          <tr>
            <td>@${u.username}</td>
            <td class="${u.verified ? 'yes' : 'no'}">${u.verified ? '✓' : '—'}</td>
            <td>${u.balance} VXR</td>
            <td>
              ${!u.verified ? <button onclick="fetch('/admin/verify?user=${u.username}&pass=sehpy9-qiqjux-hofgyN').then(() => location.reload())">Выдать галку</button> : ''}
            </td>
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `);
});

app.get('/admin/verify', (req, res) => {
  if (req.query.pass !== 'sehpy9-qiqjux-hofgyN') return res.send('Нет');
  const u = req.query.user;
  if (users ) users .verified = true;
  saveData();
  res.send('Галка выдана');
});

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users, posts }, null, 2));
}

app.listen(PORT, () => console.log(`Запущено на ${PORT}`));

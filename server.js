const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

// Загрузка данных (аккаунты и посты сохраняются между деплоями)
let users = {};
let posts = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    users = loaded.users || {};
    posts = loaded.posts || [];
    console.log('База загружена: ' + Object.keys(users).length + ' юзеров');
  } catch (e) {
    console.log('data.json битый — стартуем пустыми');
  }
}

// Если хочешь чистую базу каждый раз — раскомментируй эти строки (но тогда аккаунты будут стираться при рестарте)
// if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
// console.log('База очищена при запуске');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Регистрация — любой юзернейм свободен, если не занят
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Заполни юзернейм и пароль' });
  if (users ) return res.json({ success: false, error: 'Юзернейм занят' });

  users = {
    password,
    balance: 1000,
    premiumUntil: null,
    verified: false
  };
  saveData();
  res.json({ success: true, message: 'Добро пожаловать в Vikhrify!' });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users || users .password !== password) {
    return res.json({ success: false, error: 'Неверный логин или пароль' });
  }
  res.json({ success: true, username });
});

// Посты
app.get('/posts', (req, res) => res.json(posts));

app.post('/posts', (req, res) => {
  const { username, text } = req.body;
  if (!users ) return res.json({ success: false, error: 'Сначала войди' });

  posts.unshift({
    id: Date.now(),
    username,
    text,
    likes: 0,
    comments: []
  });
  saveData();
  res.json({ success: true });
});

// Админка — полная
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'sehpy9-qiqjux-hofgyN') {
    return res.status(403).send(`
      <html><body style="background:#111;color:#eee;text-align:center;padding:100px;">
        <h1>Пароль неверный</h1>
        <p>Попробуй ещё раз</p>
      </body></html>
    `);
  }

  const userList = Object.entries(users).map(( ) => ({
    username,
    verified: u.verified,
    balance: u.balance || 0,
    premium: !!u.premiumUntil
  }));

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Админка Vikhrify</title>
      <style>
        body { background:#0d1117; color:#c9d1d9; font-family:Arial; padding:20px; }
        h1 { color:#58a6ff; text-align:center; }
        table { width:100%; border-collapse:collapse; margin-top:20px; }
        th,td { padding:12px; border:1px solid #30363d; text-align:left; }
        th { background:#161b22; }
        tr:hover { background:#1f2937; }
        .yes { color:#3fb950; font-weight:bold; }
        .no { color:#f85149; }
        button { background:#238636; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px; }
        input { padding:6px; width:80px; background:#222; color:white; border:1px solid #444; border-radius:4px; }
      </style>
    </head>
    <body>
      <h1>Админка Vikhrify</h1>
      <table>
        <tr><th>@Юзер</th><th>Галочка</th><th>Баланс VXR</th><th>Премиум</th><th>Действия</th></tr>
        ${userList.map(u => `
          <tr>
            <td>@${u.username}</td>
            <td class="${u.verified ? 'yes' : 'no'}">${u.verified ? '✓' : '—'}</td>
            <td>${u.balance}</td>
            <td class="${u.premium ? 'yes' : 'no'}">${u.premium ? 'Да' : 'Нет'}</td>
            <td>
              <input id="amt_${u.username}" type="number" placeholder="Сумма" min="1">
              <button onclick="giveTokens('${u.username}')">Дать VXR</button>
              ${!u.verified ? <button onclick="verify('${u.username}')">Выдать галку</button> : ''}
            </td>
          </tr>
        `).join('')}
      </table>

      <script>
        function giveTokens(username) {
          const amt = document.getElementById('amt_' + username).value;
          if (!amt || amt <= 0) return alert('Введи сумму больше 0');
          fetch('/admin/tokens?user=' + username + '&amt=' + amt + '&pass=sehpy9-qiqjux-hofgyN')
            .then(r => r.text()).then(text => alert(text)).then(() => location.reload());
        }
        function verify(username) {
          fetch('/admin/verify?user=' + username + '&pass=sehpy9-qiqjux-hofgyN')
            .then(r => r.text()).then(text => alert(text)).then(() => location.reload());
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/admin/verify', (req, res) => {
  if (req.query.pass !== 'sehpy9-qiqjux-hofgyN') return res.send('Нет доступа');
  const username = req.query.user;
  if (users ) {
    users .verified = true;
    saveData();
    res.send('Галка выдана');
  } else {
    res.send('Юзера нет');
  }
});

app.get('/admin/tokens', (req, res) => {
  if (req.query.pass !== 'sehpy9-qiqjux-hofgyN') return res.send('Нет доступа');
  const username = req.query.user;
  const amt = parseInt(req.query.amt);
  if (users && !isNaN(amt) && amt > 0) {
    users .balance += amt;
    saveData();
    res.send(`Дал ${amt} VXR юзеру ${username}`);
  } else {
    res.send('Ошибка: юзера нет или сумма хуйня');
  }
});

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users, posts }, null, 2));
}

app.listen(PORT, () => console.log(`Сервер запущен на ${PORT}`));

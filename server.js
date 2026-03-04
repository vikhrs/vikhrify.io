const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const users = {}; // username → { password, name, balance, premiumUntil, verified }
const posts = [];
let postIdCounter = 1;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Главная — просто index.html
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Регистрация — просто и надёжно
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Юзернейм и пароль обязательны' });
  }

  if (users ) {
    return res.status(400).json({ success: false, error: 'Юзернейм занят' });
  }

  users = {
    password, // в проде хешируй, но пока так
    name: username,
    balance: 1000,
    premiumUntil: null,
    verified: false
  };

  res.json({ success: true });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!users || users .password !== password) {
    return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }

  res.json({ success: true, username });
});

// Админка — красивая + выдача галочки + токены
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'sehpy9-qiqjux-hofgyN') {
    return res.status(403).send('<h1 style="color:red;text-align:center">Пароль неверный, пиздуй</h1>');
  }

  const userList = Object.entries(users).map(( ) => ({
    username,
    verified: data.verified,
    balance: data.balance || 0,
    premium: !!data.premiumUntil
  }));

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Vikhrify Admin</title>
      <style>
        body { background:#0d1117; color:#c9d1d9; font-family:Arial,sans-serif; padding:20px; }
        h1 { color:#58a6ff; text-align:center; }
        table { width:100%; border-collapse:collapse; margin-top:20px; }
        th, td { padding:12px; border:1px solid #30363d; text-align:left; }
        th { background:#161b22; }
        tr:hover { background:#1f2937; }
        .yes { color:#3fb950; font-weight:bold; }
        .no { color:#f85149; }
        button { background:#238636; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; }
        button:hover { background:#2ea043; }
        input { padding:6px; margin-right:8px; border-radius:4px; border:1px solid #444; background:#222; color:white; }
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
              ${!u.verified ? <button onclick="fetch('/admin/verify?user=${u.username}&pass=sehpy9-qiqjux-hofgyN').then(r=>location.reload())">Выдать галку</button> : ''}
              <input id="amt_${u.username}" type="number" placeholder="Сумма" min="1" style="width:80px;">
              <button onclick="giveTokens('${u.username}')">Дать VXR</button>
            </td>
          </tr>
        `).join('')}
      </table>

      <script>
        function giveTokens(username) {
          const amt = document.getElementById('amt_' + username).value;
          if (!amt || amt <= 0) return alert('Введи сумму >0');
          fetch('/admin/tokens?user=' + username + '&amt=' + amt + '&pass=sehpy9-qiqjux-hofgyN')
            .then(r => r.text())
            .then(text => alert(text))
            .then(() => location.reload());
        }
      </script>
    </body>
    </html>
  `);
});

// Выдать галочку
app.get('/admin/verify', (req, res) => {
  if (req.query.
      pass !== 'sehpy9-qiqjux-hofgyN') return res.send('Доступа нет');
  const username = req.query.user;
  if (users ) {
    users .verified = true;
    res.send('Галка выдана');
  } else {
    res.send('Юзера нет');
  }
});

// Выдать токены
app.get('/admin/tokens', (req, res) => {
  if (req.query.pass !== 'sehpy9-qiqjux-hofgyN') return res.send('Доступа нет');
  const username = req.query.user;
  const amt = parseInt(req.query.amt);
  if (isNaN(amt) || amt <= 0) return res.send('Сумма хуйня');
  if (users ) {
    users .balance += amt;
    res.send(`Дал ${amt} VXR юзеру ${username}`);
  } else {
    res.send('Юзера нет');
  }
});

app.listen(PORT, () => console.log(`Сервер на ${PORT}`));

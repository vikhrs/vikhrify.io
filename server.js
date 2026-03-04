const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(__dirname));

let data = { users: {} };

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Регистрация
app.post('/api/register', (req, res) => {
  const { name, username, password } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Юзернейм и пароль обязательны' });

  const clean = username.trim().toLowerCase();
  if (data.users[clean]) return res.json({ success: false, error: 'Юзернейм занят' });

  const user = {
    id: Date.now().toString(),
    name: name?.trim() || clean,
    username: clean,
    password,
    balance: 1000,
    isPremium: false,
    badge: 'none',
    referralCode: Math.random().toString(36).slice(2,10).toUpperCase(),
    followers: 0,
    avatar: 'https://via.placeholder.com/80?text=User'
  };

  data.users[clean] = user;
  saveData();
  res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, balance: user.balance, isPremium: false, badge: 'none' } });
});

// Вход
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const clean = username.trim().toLowerCase();
  const user = data.users[clean];

  if (!user || user.password !== password) return res.json({ success: false, error: 'Неверный юзернейм или пароль' });

  res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, balance: user.balance, isPremium: user.isPremium, badge: user.badge } });
});

// Покупка Premium
app.post('/api/buy-premium', (req, res) => {
  const { userId } = req.body;
  let user = null;
  for (let key in data.users) {
    if (data.users[key].id === userId) { user = data.users[key]; break; }
  }
  if (!user || user.balance < 499) return res.json({ success: false, error: 'Недостаточно VXR' });

  user.balance -= 499;
  user.isPremium = true;
  user.badge = 'yellow';
  saveData();
  res.json({ success: true, user });
});

// Накрутка подписчиков
app.post('/api/fake-followers', (req, res) => {
  const { targetUsername, amount } = req.body;
  const clean = targetUsername.trim().toLowerCase();
  const user = data.users[clean];
  if (!user) return res.json({ success: false, error: 'Пользователь не найден' });

  user.followers = (user.followers || 0) + parseInt(amount);
  saveData();
  res.json({ success: true, newFollowers: user.followers });
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));

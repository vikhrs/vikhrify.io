const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'users.json');

let users = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
}

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/register', (req, res) => {
  const { name, username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, error: 'Юзернейм и пароль обязательны' });
  }

  const cleanUsername = username.trim().toLowerCase();

  if (users[cleanUsername]) {
    return res.json({ success: false, error: 'Юзернейм занят' });
  }

  const user = {
    id: Date.now().toString(),
    name: name?.trim() || cleanUsername,
    username: cleanUsername,
    password,
  };

  users[cleanUsername] = user;
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));

  res.json({ success: true, user: { id: user.id, name: user.name, username: user.username } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const clean = username?.trim().toLowerCase();

  const user = users[clean];

  if (!user || user.password !== password) {
    return res.json({ success: false, error: 'Неверный юзернейм или пароль' });
  }

  res.json({ success: true, user: { id: user.id, name: user.name, username: user.username } });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен → http://localhost:${PORT}`);
});

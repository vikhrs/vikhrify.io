const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

let users = {};
let posts = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    users = loaded.users || {};
    posts = loaded.posts || [];
  } catch (e) {
    console.log('База битая — стартуем пустыми');
  }
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Заполни всё' });
  if (users[username]) return res.json({ success: false, error: 'Юзернейм занят' });

  users[username] = {
    password,
    balance: 1000,
    verified: false,
    premiumUntil: null
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users, posts }, null, 2));
  res.json({ success: true });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.json({ success: false, error: 'Неверно' });
  }
  res.json({ success: true });
});

app.get('/posts', (req, res) => res.json(posts));

app.post('/posts', (req, res) => {
  const { username, text } = req.body;
  if (!users[username]) return res.json({ success: false, error: 'Войди' });
  posts.unshift({ id: Date.now(), username, text, likes: 0, comments: [] });
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users, posts }, null, 2));
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Сервер запущен на ${PORT}`));

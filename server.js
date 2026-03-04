const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Храним всё в памяти (для теста нормально, потом подключи mongodb)
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

// РЕГИСТРАЦИЯ
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Заполни юзернейм и пароль' });
  }

  if (users[username]) {
    return res.status(400).json({ success: false, error: 'Такой юзернейм уже занят' });
  }

  users[username] = {
    password: password,           // в продакшене хешируй!
    name: username,
    photo: '',
    balance: 1000,
    premiumUntil: null,
    verified: false
  };

  console.log(`Новый пользователь: ${username}`);
  res.json({ success: true, message: 'Добро пожаловать в Vikhrify!' });
});

// ВХОД
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!users[username] || users[username].password !== password) {
    return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }

  res.json({ success: true, username });
});

// ПРОФИЛЬ — получить
app.post('/profile', (req, res) => {
  const { username } = req.body;
  if (!users[username]) {
    return res.status(404).json({ success: false, error: 'Пользователь не найден' });
  }
  res.json({ success: true, user: users[username] });
});

// ПРОФИЛЬ — обновить имя
app.post('/profile/update', (req, res) => {
  const { username, name } = req.body;
  if (!users[username]) {
    return res.status(404).json({ success: false, error: 'Пользователь не найден' });
  }
  if (name) users[username].name = name;
  res.json({ success: true });
});

// ПОСТЫ — получить все
app.get('/posts', (req, res) => {
  res.json(posts);
});

// ПОСТЫ — создать
app.post('/posts', (req, res) => {
  const { username, text, isPremium = false } = req.body;

  if (!users[username]) {
    return res.status(403).json({ success: false, error: 'Сначала войди' });
  }

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

// Коммент
app.post('/posts/:id/comment', (req, res) => {
  const { username, text } = req.body;
  const post = posts.find(p => p.id == req.params.id);
  if (post) {
    post.comments.push({ username, text });
  }
  res.json({ success: true });
});

// Реакция (только премиум посты)
app.post('/posts/:id/react', (req, res) => {
  const { emoji } = req.body;
  const post = posts.find(p => p.id == req.params.id);
  if (!post || !post.isPremium) {
    return res.status(403).json({ success: false, error: 'Реакции только на премиум-постах' });
  }
  if (['🔥', '😂'].includes(emoji)) {
    post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;
  }
  res.json({ success: true });
});

// Купить премиум (упрощённо)
app.post('/premium/buy', (req, res) => {
  const { username, method = 'VXR' } = req.body;
  if (!users[username]) {
    return res.status(403).json({ success: false, error: 'Пользователь не найден' });
  }

  const cost = method === 'VXR' ? 500 : 199; // просто пример
  if (users[username].balance < cost) {
    return res.status(400).json({ success: false, error: 'Не хватает средств' });
  }

  users[username].balance -= cost;
  users[username].premiumUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
  users[username].verified = true;

  res.
    json({
    success: true,
    until: new Date(users[username].premiumUntil).toLocaleDateString('ru-RU')
  });
});

// АДМИНКА (с твоим паролем)
app.get('/admin', (req, res) => {
  const adminPass = 'sehpy9-qiqjux-hofgyN';
  if (req.query.pass !== adminPass) {
    return res.status(403).send('Пароль неверный');
  }

  const totalUsers = Object.keys(users).length;
  const totalPosts = posts.length;
  const activeUsers = new Set(posts.map(p => p.username)).size;

  res.json({
    totalUsers,
    totalPosts,
    activeUsers,
    usersList: Object.keys(users).map(u => ({
      username: u,
      hasPremium: !!users[u].premiumUntil,
      verified: users[u].verified
    }))
  });
});

app.listen(PORT, () => {
  console.log(`Vikhrify запущен на порту ${PORT}`);
});

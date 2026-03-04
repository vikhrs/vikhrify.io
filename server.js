const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// В памяти (потом замени на базу)
const users = {}; // { username: { password, name, photo: '', balance: 1000, premiumUntil: null, verified: false } }
const posts = []; // [{ id, username, text, likes:0, comments:[], isPremium:false, reactions:{'🔥':0,'😂':0} }]
let postId = 1;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Регистрация
app.post('/register', (req, res) => {
  const { username, password, name = username } = req.body;
  if (users ) return res.status(400).json({ error: 'Юзер уже есть' });
  users = { 
    password, 
    name, 
    photo: '', 
    balance: 1000, // стартовый баланс
    premiumUntil: null, 
    verified: false 
  };
  res.json({ success: true, username });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users || users .password !== password) {
    return res.status(401).json({ error: 'Неправильный логин/пароль' });
  }
  res.json({ success: true, username });
});

// Получить профиль
app.post('/profile', (req, res) => {
  const { username } = req.body;
  if (!users ) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(users );
});

// Обновить профиль (имя пока)
app.post('/profile/update', (req, res) => {
  const { username, name } = req.body;
  if (!users ) return res.status(404).json({ error: 'Нет такого' });
  users .name = name || users .name;
  res.json({ success: true });
});

// Лента постов
app.get('/posts', (req, res) => res.json(posts));

// Создать пост
app.post('/posts', (req, res) => {
  const { username, text, isPremium = false } = req.body;
  if (!users ) return res.status(403).json({ error: 'Кто ты?' });
  
  posts.unshift({ 
    id: postId++, 
    username, 
    text, 
    likes: 0, 
    comments: [], 
    isPremium, 
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
  if (post) post.comments.push({ username, text });
  res.json({ success: true });
});

// Реакция (только для премиум-постов)
app.post('/posts/:id/react', (req, res) => {
  const { emoji } = req.body;
  const post = posts.find(p => p.id == req.params.id);
  if (!post || !post.isPremium) return res.status(403).json({ error: 'Только премиум-посты' });
  if (!['🔥', '😂'].includes(emoji)) return res.status(400).json({ error: 'Неподдерживаемая реакция' });
  post.reactions = (post.reactions || 0) + 1;
  res.json({ success: true });
});

// Купить премиум
app.post('/premium/buy', (req, res) => {
  const { username, method = 'VXR' } = req.body;
  if (!users ) return res.status(403).json({ error: 'Нет такого' });

  const cost = method === 'VXR' ? 500 : 0; // рубли — пока без оплаты
  if (users .balance < cost) return res.status(400).json({ error: 'Не хватает VXR' });

  users .balance -= cost;
  users .premiumUntil = Date.now() + 30 * 24 * 60 * 60 * 1000; // +30 дней
  users .verified = true;

  res.json({ 
    success: true, 
    until: new Date(users .premiumUntil).toLocaleDateString('ru-RU') 
  });
});

// Админ-панель (с твоим паролем)
app.get('/admin', (req, res) => {
  const adminPass = 'sehpy9-qiqjux-hofgyN'; // твой пароль
  if (req.query.pass !== adminPass) {
    return res.status(403).send('Пароль не тот, брат. Проваливай.');
  }

  const totalUsers = Object.keys(users).length;
  const totalPosts = posts.length;
  const activeUsers = new Set(posts.map(p => p.username)).size;

  res.json({
    totalUsers,
    totalPosts,
    activeUsers,
    users: Object.entries(users).map(( ) => ({
      username: u,
      premium: !!data.premiumUntil,
      verified: data.verified
    }))
  });
});

app.listen(PORT, () => console.log(`Vikhrify запущен на ${PORT}`));

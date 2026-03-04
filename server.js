import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.get('/',      (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// Хранилище в памяти (потом → MongoDB)
let users = [];
let posts = [];

// Регистрация
app.post('/api/register', (req, res) => {
  const { username, password, name } = req.body;
  if (!username  !password  !name) return res.status(400).json({ error: "Заполни всё" });

  const lowerUsername = username.toLowerCase().trim();
  if (users.some(u => u.username === lowerUsername)) {
    return res.status(409).json({ error: "Юзернейм уже занят" });
  }

  const newUser = {
    id: users.length + 1,
    username: lowerUsername,
    name: name.trim(),
    password,               // В продакшене → bcrypt.hash!
    avatar: https://i.pravatar.cc/150?u=${lowerUsername},
    balance: 0,
    isPremium: false,
    isVerified: false,
    isBlocked: false
  };

  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const lowerUsername = username.toLowerCase().trim();
  const user = users.find(u => u.username === lowerUsername && u.password === password);

  if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });
  res.json({ success: true, user });
});

// Профиль
app.get('/api/me/:id', (req, res) => {
  const user = users.find(u => u.id == req.params.id);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  res.json(user);
});

// Посты пользователя
app.get('/api/posts/:userId', (req, res) => {
  const userPosts = posts.filter(p => p.userId == req.params.userId);
  res.json(userPosts);
});

app.post('/api/posts', (req, res) => {
  const { userId, content } = req.body;
  if (!userId || !content) return res.status(400).json({ error: "Нет данных" });

  const post = {
    id: posts.length + 1,
    userId: Number(userId),
    content: content.trim(),
    createdAt: new Date().toISOString()
  };

  posts.push(post);
  res.json(post);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен → http://localhost:${PORT}`);
  console.log(`Админка:           http://localhost:${PORT}/admin`);
});

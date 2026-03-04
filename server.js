import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const USERS_FILE = join(__dirname, 'users.json');

// Загружаем пользователей при старте
let users = [];
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    users = JSON.parse(data);
    console.log(`Загружено ${users.length} пользователей из users.json`);
  } catch (err) {
    console.log('users.json не найден или ошибка → стартуем с пустым массивом');
    users = [];
  }
}

async function saveUsers() {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('users.json сохранён');
  } catch (err) {
    console.error('Ошибка сохранения users.json:', err);
  }
}

// Загружаем при запуске
loadUsers();

// Главная
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

// Админка
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, password, name } = req.body || {};
  if (!username  !password  !name) return res.status(400).json({ error: 'Заполни всё' });

  const cleanUsername = username.trim().toLowerCase();
  if (users.some(u => u.username === cleanUsername)) {
    return res.status(409).json({ error: 'Юзернейм занят' });
  }

  const newUser = {
    id: users.length + 1,
    username: cleanUsername,
    name: name.trim(),
    password,
    avatar: https://i.pravatar.cc/150?u=${cleanUsername},
    balance: 0,
    isPremium: false,
    isVerified: false,
    isBlocked: false
  };

  users.push(newUser);
  await saveUsers();
  res.json({ success: true, user: newUser });
});

// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = users.find(u => u.username === cleanUsername && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user });
});

// Профиль
app.get('/api/me/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(user);
});

// Посты (в памяти, можно тоже в файл перенести позже)
let posts = [];
app.get('/api/posts/:userId', (req, res) => {
  const userPosts = posts.filter(p => p.userId === Number(req.params.userId));
  res.json(userPosts);
});

app.post('/api/posts', (req, res) => {
  const { userId, content } = req.body || {};
  if (!userId || !content?.trim()) return res.status(400).json({ error: 'Нет данных' });
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
  console.log(`Сервер запущен на порту ${PORT}`);
});

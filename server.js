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
app.use(express.json({ limit: '10mb' }));

const DATA_FILE = join(__dirname, 'data.json');

let data = { users: [], posts: [], messages: [], follows: {} };

async function loadData() {
  try {
    data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch (e) {
    data = { users: [], posts: [], messages: [], follows: {} };
  }
}

async function saveData() {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

await loadData();

app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

// Регистрация и вход — без изменений
app.post('/api/register', async (req, res) => {
  const { name, username, password } = req.body || {};
  if (!name?.trim() || !username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Заполни имя, юзернейм и пароль' });
  }
  const cleanUsername = username.trim().toLowerCase();
  if (data.users.some(u => u.username === cleanUsername)) {
    return res.status(409).json({ error: 'Юзернейм занят' });
  }
  const newUser = {
    id: Date.now(),
    name: name.trim(),
    username: cleanUsername,
    password,
    avatar: 'https://via.placeholder.com/150?text=User',
    balance: 1000,
    isPremium: false,
    badge: 'none',
    referralCode: Math.random().toString(36).slice(2,8).toUpperCase()
  };
  data.users.push(newUser);
  data.follows[cleanUsername] = { following: [], followers: [] };
  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = data.users.find(u => u.username === cleanUsername && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// ─── Накрутка подписчиков (новый эндпоинт) ────────────────────────────────────────────────
app.post('/api/fake-followers', async (req, res) => {
  const { adminId, targetUsername, amount } = req.body;

  const admin = data.users.find(u => u.id == adminId);
  if (!admin || admin.username !== 'admin') {
    return res.status(403).json({ error: 'Доступ только администратору' });
  }

  const cleanTarget = targetUsername.trim().toLowerCase();
  const target = data.users.find(u => u.username === cleanTarget);
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
    return res.status(400).json({ error: 'Количество должно быть от 1 до 100000' });
  }

  if (!data.follows[cleanTarget]) {
    data.follows[cleanTarget] = { following: [], followers: [] };
  }

  const currentCount = data.follows[cleanTarget].followers.length;
  const newCount = currentCount + amount;

  // Добавляем фейковых подписчиков (просто строки-идентификаторы)
  data.follows[cleanTarget].followers = data.follows[cleanTarget].followers.concat(
    Array(amount).fill().map((_, i) => `fake_${Date.now() + i}`)
  );

  await saveData();

  res.json({ success: true, newFollowers: newCount });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

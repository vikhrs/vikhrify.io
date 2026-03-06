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

const USERS_FILE = join(__dirname, 'users.json');
const POSTS_FILE = join(__dirname, 'posts.json');
const MESSAGES_FILE = join(__dirname, 'messages.json');

let users = [];
let posts = [];
let messages = [];

async function loadData() {
  try { users    = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));    } catch(e) { users = []; }
  try { posts    = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8'));    } catch(e) { posts = []; }
  try { messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8')); } catch(e) { messages = []; }
}

async function saveData() {
  await fs.writeFile(USERS_FILE,   JSON.stringify(users, null, 2));
  await fs.writeFile(POSTS_FILE,   JSON.stringify(posts, null, 2));
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

await loadData();

// ─── Статические файлы ────────────────────────────────
app.get('/',               (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin',          (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// ─── Auth ─────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, username, password } = req.body || {};
  if (!name?.trim() || !username?.trim() || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  const clean = username.trim().toLowerCase().replace(/^@/, '');
  if (users.some(u => u.username === clean)) {
    return res.status(409).json({ error: 'Юзернейм занят' });
  }

  const newUser = {
    id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
    name: name.trim(),
    username: clean,
    password,
    avatar: 'https://via.placeholder.com/150?text=User',
    isVerified: false,
    isBlocked: false,
    followers: []
  };

  users.push(newUser);
  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const clean = username?.trim().toLowerCase().replace(/^@/, '');
  const found = users.find(u => u.username === clean && u.password === password);
  if (!found) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user: { ...found, password: undefined } });
});

app.get('/api/me/:id', (req, res) => {
  const u = users.find(u => u.id === Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Не найден' });
  res.json({ ...u, password: undefined });
});

app.patch('/api/profile', async (req, res) => {
  const { id, name, avatar } = req.body;
  const u = users.find(u => u.id === id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  if (name?.trim()) u.name = name.trim();
  if (avatar) u.avatar = avatar;
  await saveData();
  res.json({ ...u, password: undefined });
});

// ─── Посты ────────────────────────────────────────────
app.get('/api/posts', (req, res) => res.json(posts));

app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const author = users.find(u => u.id === userId);
  if (!author) return res.status(404).json({ error: 'Автор не найден' });

  const post = {
    id: posts.length ? Math.max(...posts.map(p => p.id)) + 1 : 1,
    userId,
    username: author.username,
    name: author.name,
    avatar: author.avatar,
    content: content.trim(),
    image: image || null,
    createdAt: new Date().toISOString()
  };

  posts.push(post);
  await saveData();
  res.json(post);
});

// ─── Пользователи и поиск ─────────────────────────────
app.get('/api/user/:id', (req, res) => {
  const u = users.find(u => u.id === Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Не найден' });
  res.json({ ...u, password: undefined });
});

app.get('/api/users/search', (req, res) => {
  const q = req.query.q?.toLowerCase() || '';
  const found = users.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.username.toLowerCase().includes(q)
  );
  res.json(found.map(u => ({ id: u.id, name: u.name, username: u.username, isVerified: u.isVerified })));
});

// ─── Подписки ─────────────────────────────────────────
app.post('/api/follow', async (req, res) => {
  const { followerId, targetId } = req.body;
  const follower = users.find(u => u.id === followerId);
  const target   = users.find(u => u.id === targetId);

  if (!follower || !target) return res.status(404).json({ error: 'Пользователь не найден' });

  if (target.followers.includes(followerId)) {
    target.followers = target.followers.filter(id => id !== followerId);
  } else {
    target.followers.push(followerId);
  }

  await saveData();
  res.json({ success: true, followers: target.followers.length });
});

// ─── Чаты и сообщения ─────────────────────────────────
app.get('/api/chats', (req, res) => {
  const userId = Number(req.query.userId);
  const interlocutors = new Set();

  messages.forEach(m => {
    if (m.from === userId) interlocutors.add(m.to);
    if (m.to   === userId) interlocutors.add(m.from);
  });

  const chats = [...interlocutors].map(id => {
    const u = users.find(u => u.id === id);
    return {
      withUser: { id: u.id, name: u.name, username: u.username },
      unread: messages.some(m => m.to === userId && m.from === id && !m.read)
    };
  });

  res.json(chats);
});

app.get('/api/messages', (req, res) => {
  const userId = Number(req.query.userId);
  const withId = Number(req.query.with);

  const msgs = messages.filter(m =>
    (m.from === userId && m.to === withId) ||
    (m.from === withId && m.to === userId)
  ).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.json(msgs);
});

app.post('/api/messages', async (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) return res.status(400).json({ error: 'Недостаточно данных' });

  const msg = {
    id: messages.length ? Math.max(...messages.map(m => m.id)) + 1 : 1,
    from, to, text,
    createdAt: new Date().toISOString(),
    read: false
  };

  messages.push(msg);
  await saveData();
  res.json(msg);
});

// ─── Admin ────────────────────────────────────────────
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-pass'];
  if (pass !== ADMIN_PASS) return res.status(403).json({ error: 'Доступ запрещён' });
  next();
}

app.get('/api/admin/stats', checkAdmin, (req, res) => {
  res.json({ usersCount: users.length, postsCount: posts.length });
});

app.get('/api/admin/users', checkAdmin, (req, res) => {
  res.json(users.map(u => ({ ...u, password: undefined })));
});

app.patch('/api/admin/user', checkAdmin, async (req, res) => {
  const { id, isVerified, isBlocked } = req.body;
  const u = users.find(u => u.id === Number(id));
  if (!u) return res.status(404).json({ error: 'Не найден' });

  if (isVerified !== undefined) u.isVerified = Boolean(isVerified);
  if (isBlocked  !== undefined) u.isBlocked  = Boolean(isBlocked);

  await saveData();
  res.json({ success: true });
});

app.post('/api/admin/add-followers', checkAdmin, async (req, res) => {
  const { id, count } = req.body;
  const u = users.find(u => u.id === Number(id));
  if (!u) return res.status(404).json({ error: 'Не найден' });

  for (let i = 0; i < count; i++) {
    const fakeId = 1000000 + Math.floor(Math.random() * 900000);
    if (!u.followers.includes(fakeId)) u.followers.push(fakeId);
  }

  await saveData();
  res.json({ success: true, followers: u.followers.length });
});

app.listen(PORT, () => console.log(`Vikhrify → http://localhost:${PORT}`));
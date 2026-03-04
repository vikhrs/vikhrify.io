const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function load(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function save(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

let users = load('users.json');
let chats = load('chats.json');

// Если первый запуск — создаём тестовых пользователей
if (users.length === 0) {
  users = [
    { id: 1, username: "test1", password: "123", emoji: "🧔", vxr: 3420, verified: true, blocked: false },
    { id: 2, username: "test2", password: "123", emoji: "👩", vxr: 890, verified: false, blocked: false },
    { id: 3, username: "test3", password: "123", emoji: "🕴️", vxr: 5640, verified: true, blocked: false }
  ];
  save('users.json', users);
}

// API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Имя занято' });
  const newUser = {
    id: users.length + 1,
    username,
    password,
    emoji: ['🌪️','🔥','💀','👽','🤡'][Math.floor(Math.random()*5)],
    vxr: 100,
    verified: false,
    blocked: false
  };
  users.push(newUser);
  save('users.json', users);
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

app.get('/api/users', (req, res) => {
  res.json(users.map(u => ({ ...u, password: undefined })));
});

app.get('/api/my-chats', (req, res) => {
  const userId = parseInt(req.query.userId);
  const myChats = chats.filter(c => c.participants.includes(userId));
  res.json(myChats);
});

app.post('/api/create-chat', (req, res) => {
  const { userId, withUserId } = req.body;
  const sorted = [userId, withUserId].sort((a,b)=>a-b).join(',');
  let chat = chats.find(c => c.participants.sort((a,b)=>a-b).join(',') === sorted);
  if (chat) {
    res.json({ success: true, chat });
  } else {
    const newChat = {
      id: chats.length + 1,
      participants: [userId, withUserId],
      messages: []
    };
    chats.push(newChat);
    save('chats.json', chats);
    res.json({ success: true, chat: newChat });
  }
});

app.post('/api/admin/action', (req, res) => {
  const { pass, action, targetId, value } = req.body;
  if (pass !== "sehpy9-qiqjux-hofgyN") return res.status(403).json({ error: 'Неверный пароль' });
  const user = users.find(u => u.id === targetId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  if (action === 'vxr') user.vxr = Math.max(0, user.vxr + value);
  else if (action === 'verify') user.verified = value;
  else if (action === 'block') user.blocked = value;

  save('users.json', users);
  res.json({ success: true });
});

io.on('connection', (socket) => {
  socket.on('join-chat', (chatId) => socket.join(`chat-${chatId}`));

  socket.on('send-message', (data) => {
    const { chatId, from, text } = data;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const msg = {
      from,
      text,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };
    chat.messages.push(msg);
    save('chats.json', chats);

    io.to(`chat-${chatId}`).emit('new-message', { chatId, msg });
  });
});

server.listen(3000, () => {
  console.
    log('🚀 Vikhrify запущен → http://localhost:3000');
});

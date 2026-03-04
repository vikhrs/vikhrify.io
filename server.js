const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ users: [], posts: [], messages: [] }).write();

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

const loggedUsers = {};      // socket.id → username
const usernameToSocket = {}; // username → socket.id

function findUserByUsername(un) {
  return db.get('users').find({ username: un }).value();
}

function findUserByToken(token) {
  return db.get('users').find({ token }).value();
}

function saveUser(user) {
  db.get('users').find({ username: user.username }).assign(user).write();
}

io.on('connection', (socket) => {
  console.log('Подключился:', socket.id);

  // Регистрация
  socket.on('register', async ({ username, password, ref }) => {
    if (!username  username.length < 3  !password || password.length < 4) {
      return socket.emit('error', 'Неверные данные');
    }
    if (findUserByUsername(username)) {
      return socket.emit('error', 'Имя уже занято');
    }

    const hash = await bcrypt.hash(password, 10);
    const referralCode = username + '-' + uuidv4().slice(0, 8);

    let referrer = null;
    if (ref) {
      referrer = db.get('users').find(u => u.referralCode === ref || u.username === ref).value();
      if (referrer) {
        referrer.balance = (referrer.balance || 100) + 50;
        saveUser(referrer);
      }
    }

    const newUser = {
      id: uuidv4(),
      username,
      passwordHash: hash,
      displayName: username,
      avatar: null,
      balance: 100,
      premium: false,
      verified: false,
      banned: false,
      token: null,
      referralCode,
      createdAt: Date.now()
    };

    db.get('users').push(newUser).write();
    socket.emit('register_success', { msg: 'Зарегистрировано! Теперь войдите.' });
  });

  // Логин
  socket.on('login', async ({ username, password }) => {
    const user = findUserByUsername(username);
    if (!user  !(await bcrypt.compare(password, user.passwordHash))  user.banned) {
      return socket.emit('error', 'Неверный логин или пароль');
    }

    const token = uuidv4();
    user.token = token;
    saveUser(user);

    loggedUsers[socket.id] = username;
    usernameToSocket[username] = socket.id;

    socket.emit('login_success', {
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      balance: user.balance,
      premium: user.premium,
      verified: user.verified,
      referralCode: user.referralCode,
      token
    });
  });

  // Авто-вход при обновлении страницы
  socket.on('auto_login', (token) => {
    const user = findUserByToken(token);
    if (user && !user.banned) {
      loggedUsers[socket.id] = user.username;
      usernameToSocket[user.username] = socket.id;

      socket.emit('login_success', {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        balance: user.balance,
        premium: user.premium,
        verified: user.verified,
        referralCode: user.referralCode,
        token: user.token
      });
    } else {
      socket.emit('auto_login_fail');
    }
  });

  // Публикация поста
  socket.on('post', ({ text, image, voice }) => {
    const username = loggedUsers[socket.id];
    if (!username) return;

    const user = findUserByUsername(username);
    if (!user || user.banned) return;

    if (voice && !user.premium) {
      return socket.emit('error', 'Голосовые посты — только для премиум');
    }

    const post = {
      id: uuidv4(),
      username,
      displayName: user.displayName,
      text: text || '',
      image: image || null,
      voice: voice || null,
      time: new Date().toLocaleString('ru-RU'),
      verified: user.verified
    };

    db.get('posts').push(post).write();
    io.emit('new_post', post);
  });

  // Получить все посты
  socket.on('get_posts', () => {
    const posts = db.get('posts').sortBy('id').reverse().value();
    socket.emit('posts_list', posts);
  });

  // Отправка сообщения в чат
  socket.on('send_message', ({ to, text }) => {
    const from = loggedUsers[socket.id];
    if (!from || !text.trim()) return;

    const msg = {
      id: uuidv4(),
      from,
      to,
      text: text.trim(),
      time: new Date().toLocaleString('ru-RU')
    };

    db.get('messages').push(msg).write();

    socket.emit('new_message', msg);
    const toSocket = usernameToSocket[to];
    if (toSocket) io.to(toSocket).emit('new_message', msg);
  });

  // Получить список чатов
  socket.on('get_chats', () => {
    const username = loggedUsers[socket.id];
    if (!username) return;

    const msgs = db.get('messages').filter(m => m.from === username || m.to === username).value();
    const chats = [...new Set(msgs.map(m => m.from === username ? m.to : m.from))];
    socket.emit('chats_list', chats);
  });

  // Получить сообщения чата
  socket.on('get_chat_messages', (withUser) => {
    const username = loggedUsers[socket.id];
    if (!username) return;

    const msgs = db.get('messages')
      .filter(m => (m.from === username && m.to === withUser) || (m.from === withUser && m.to === username))
      .sortBy('id')
      .value();

    socket.emit('chat_messages', msgs);
  });

  // Обновление профиля
  socket.on('update_profile', ({ displayName, avatar }) => {
    const username = loggedUsers[socket.id];
    const user = findUserByUsername(username);
    if (!user) return;

    if (displayName) user.displayName = displayName;
    if (avatar) user.avatar = avatar;

    saveUser(user);
    socket.emit('profile_updated', { displayName: user.displayName, avatar: user.avatar });
  });

  // Купить премиум
  socket.on('buy_premium', () => {
    const username = loggedUsers[socket.id];
    const user = findUserByUsername(username);
    if (!user  user.balance < 299  user.premium) {
      return socket.emit('error', 'Недостаточно VXR или уже есть премиум');
    }

    user.balance -= 299;
    user.premium = true;
    saveUser(user);

    socket.emit('premium_bought', { balance: user.balance, premium: true });
  });

  // Админ-панель
  socket.on('admin_action', ({ action, username, adminPass, amount }) => {
    if (adminPass !== 'sehpy9-qiqjux-hofgyN') {
      return socket.emit('error', 'Неверный пароль');
    }

    const user = findUserByUsername(username);
    if (!user) return;

    if (action === 'verify') user.verified = true;
    if (action === 'unverify') user.verified = false;
    if (action === 'ban') user.banned = true;
    if (action === 'unban') user.banned = false;
    if (action === 'add_balance') user.balance += Number(amount) || 0;

    saveUser(user);
    socket.emit('admin_success', 'Готово');
  });

  socket.on('get_all_users', () => {
    const list = db.get('users').map(u => ({
      username: u.username,
      balance: u.balance,
      verified: u.verified,
      banned: u.banned
    })).value();
    socket.emit('user_list', list);
  });

  socket.on('disconnect', () => {
    const un = loggedUsers[socket.id];
    if (un) delete usernameToSocket[un];
    delete loggedUsers[socket.id];
    console.log('Отключился:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Vikhrify запущен на порту ${PORT}`);
});
